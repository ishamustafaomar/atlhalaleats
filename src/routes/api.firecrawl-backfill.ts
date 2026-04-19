import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ImageHit = { imageUrl?: string; imageWidth?: number; imageHeight?: number };

/**
 * Use Firecrawl's image search to grab real restaurant photos. Filters out
 * tiny thumbnails, Google UI chrome, and other junk that came back from
 * earlier HTML-scraping attempts.
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
        limit: 10,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { images?: ImageHit[] } };
    const images = json.data?.images ?? [];
    const blocked = [
      "gstatic.com",
      "google.com/logos",
      "google.com/images/branding",
      "googleusercontent.com/a/",
      "favicon",
      "ssl.gstatic",
    ];
    return images
      .map((i) => i.imageUrl)
      .filter((u): u is string => !!u && u.startsWith("http"))
      .filter((u) => !blocked.some((b) => u.includes(b)))
      .filter((_, idx, arr) => arr.indexOf(arr[idx]) === idx)
      .slice(0, max);
  } catch {
    return [];
  }
}

const BAD_URL_FRAGMENTS = [
  "gstatic.com",
  "google.com/logos",
  "google.com/images/branding",
  "ssl.gstatic",
  "googleusercontent.com/a/", // user avatars
  "favicon",
];

/** A row needs re-processing if ANY of its URLs looks like Google chrome/junk. */
function hasAnyBadUrl(urls: string[] | null): boolean {
  if (!urls || urls.length === 0) return false;
  return urls.some((u) => BAD_URL_FRAGMENTS.some((b) => u.includes(b)));
}

export const Route = createFileRoute("/api/firecrawl-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20"), 1), 50);

        // Pull rows that have no photos OR only junk Google UI URLs from earlier runs.
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
          .filter((r) => !r.photo_urls || r.photo_urls.length === 0 || hasOnlyBadUrls(r.photo_urls))
          .slice(0, limit);

        const results: { id: string; name: string; photos: number }[] = [];
        for (const r of candidates) {
          const q = `${r.name} ${r.address ?? "Atlanta GA"} restaurant food`;
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
          (r) => !r.photo_urls || r.photo_urls.length === 0 || hasOnlyBadUrls(r.photo_urls),
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
