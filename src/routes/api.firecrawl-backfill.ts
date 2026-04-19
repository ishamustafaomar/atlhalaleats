import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function firecrawlImages(query: string, max = 6): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return [];
  const target = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: target,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 1500,
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { html?: string }; html?: string };
    const html = json.data?.html ?? json.html ?? "";
    if (!html) return [];
    const found = new Set<string>();
    const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html)) && found.size < max * 4) {
      const u = m[1];
      if (
        u.startsWith("http") &&
        !u.includes("gstatic.com/images") &&
        !u.includes("/logos/")
      ) {
        found.add(u);
      }
    }
    const urlRe = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
    while ((m = urlRe.exec(html)) && found.size < max * 4) {
      found.add(m[0]);
    }
    return Array.from(found)
      .filter((u) => !u.includes("google.com/images/branding") && !u.includes("favicon"))
      .slice(0, max);
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

        const { data: rows, error } = await supabaseAdmin
          .from("restaurants")
          .select("id,name,address")
          .or("photo_urls.is.null,photo_urls.eq.{}")
          .order("created_at", { ascending: true })
          .limit(limit);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: { id: string; name: string; photos: number }[] = [];
        for (const r of rows ?? []) {
          const q = `${r.name} ${r.address ?? "Atlanta GA"} restaurant`;
          const photos = await firecrawlImages(q);
          if (photos.length) {
            await supabaseAdmin
              .from("restaurants")
              .update({ photo_urls: photos })
              .eq("id", r.id);
          }
          results.push({ id: r.id, name: r.name, photos: photos.length });
          await new Promise((res) => setTimeout(res, 250));
        }

        const { count: remaining } = await supabaseAdmin
          .from("restaurants")
          .select("id", { count: "exact", head: true })
          .or("photo_urls.is.null,photo_urls.eq.{}");

        return new Response(
          JSON.stringify({
            processed: results.length,
            enriched: results.filter((r) => r.photos > 0).length,
            missed: results.filter((r) => r.photos === 0).length,
            remaining: remaining ?? 0,
            results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
