import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ImageHit = { imageUrl?: string; url?: string; imageWidth?: number; imageHeight?: number };

/** Hosts/path fragments that always indicate Google UI chrome, not a real photo. */
const BAD_URL_FRAGMENTS = [
  "gstatic.com",
  "googleusercontent.com/a/", // user avatars
  "google.com/logos",
  "google.com/images/branding",
  "google.com/favicon",
  "google.com/intl/",
  "googlelogo",
  "favicon.ico",
  "/favicon",
  "data:image",
  ".svg",
];

/** Domains we trust to return real restaurant photography. */
const GOOD_HOST_HINTS = [
  "yelp",
  "ubereats",
  "doordash",
  "grubhub",
  "tripadvisor",
  "fbcdn", // facebook
  "cdninstagram",
  "squarespace",
  "wixstatic",
  "shopify",
  "cloudinary",
  "imgix",
  "amazonaws",
  "googleusercontent", // photo content (not /a/ avatars — already filtered above)
  "ggpht",
  "opentable",
  "resy",
  "toasttab",
  "menupages",
  "zomato",
  "eater",
  "atlantamagazine",
  "ajc.com",
  "wordpress",
  "wp.com",
];

function isJunk(u: string): boolean {
  if (!u || !u.startsWith("http")) return true;
  const lower = u.toLowerCase();
  if (BAD_URL_FRAGMENTS.some((b) => lower.includes(b))) return true;
  // Strip query and require an image-like extension OR a trusted CDN host.
  const path = lower.split("?")[0];
  const looksLikeImage = /\.(jpe?g|png|webp|avif)$/i.test(path);
  const trusted = GOOD_HOST_HINTS.some((h) => lower.includes(h));
  if (!looksLikeImage && !trusted) return true;
  return false;
}

/** A row needs re-processing if ANY of its URLs looks like junk. */
function hasAnyBadUrl(urls: string[] | null): boolean {
  if (!urls || urls.length === 0) return false;
  return urls.some(isJunk);
}

/**
 * Use Firecrawl's image search. We deliberately avoid generic words like
 * "restaurant food" because that triggers Google to serve its own G-logo
 * splash image at the top of results. Instead, we search the place name plus
 * its city, then aggressively filter the response.
 */
async function firecrawlImages(query: string, max = 6): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        sources: ["images"],
        limit: 20,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { images?: ImageHit[] } };
    const images = json.data?.images ?? [];
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const i of images) {
      const u = i.imageUrl || i.url;
      if (!u) continue;
      if (isJunk(u)) continue;
      // Reject obvious tiny thumbs.
      if ((i.imageWidth ?? 0) > 0 && (i.imageWidth ?? 0) < 200) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      clean.push(u);
      if (clean.length >= max) break;
    }
    return clean;
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/firecrawl-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 50);

        const { data: allRows, error } = await supabaseAdmin
          .from("restaurants")
          .select("id,name,address,photo_urls")
          .order("created_at", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const candidates = (allRows ?? [])
          .filter((r) => !r.photo_urls || r.photo_urls.length === 0 || hasAnyBadUrl(r.photo_urls))
          .slice(0, limit);

        const results: { id: string; name: string; photos: number }[] = [];
        for (const r of candidates) {
          // Specific query — name + address only. NO "restaurant food" suffix
          // because that string triggers Google to inject its own G logo.
          const q = r.address ? `"${r.name}" ${r.address}` : `"${r.name}" Atlanta`;
          const photos = await firecrawlImages(q);
          if (photos.length) {
            await supabaseAdmin
              .from("restaurants")
              .update({ photo_urls: photos })
              .eq("id", r.id);
          }
          results.push({ id: r.id, name: r.name, photos: photos.length });
          await new Promise((res) => setTimeout(res, 200));
        }

        const remaining = (allRows ?? []).filter(
          (r) => !r.photo_urls || r.photo_urls.length === 0 || hasAnyBadUrl(r.photo_urls),
        ).length - results.filter((r) => r.photos > 0).length;

        return new Response(
          JSON.stringify({
            processed: results.length,
            enriched: results.filter((r) => r.photos > 0).length,
            missed: results.filter((r) => r.photos === 0).length,
            remaining,
            results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
