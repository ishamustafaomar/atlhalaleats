import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Scrape Google search results for a restaurant's name + city using Firecrawl,
 * then extract phone, website, address, and weekly hours from the markdown.
 * This is fragile by design — Google's HTML changes — but it lets us populate
 * basic info without paying for Places API.
 */

type Extracted = {
  phone: string | null;
  website: string | null;
  address: string | null;
  hours: string[] | null;
};

const PHONE_RE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const URL_RE = /https?:\/\/(?!(?:www\.)?(?:google|youtube|facebook|instagram|yelp|tripadvisor|ubereats|doordash|grubhub|wikipedia|bing|yahoo|maps\.google)\.[^\s)]+)[^\s)\]]+/i;
const ADDRESS_RE = /\b\d{1,6}\s+[A-Z][A-Za-z0-9.,'\- ]+(?:Ave|St|Street|Road|Rd|Blvd|Boulevard|Drive|Dr|Pkwy|Parkway|Hwy|Highway|Lane|Ln|Way|Ct|Court|Place|Pl|Trl|Trail|Cir|Circle|Sq|Square|Ter|Terrace)[^,\n]*,\s*[A-Z][A-Za-z .'\-]+,\s*GA\s*\d{5}/;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function extractFromText(text: string): Extracted {
  const phoneMatch = text.match(PHONE_RE);
  const urlMatch = text.match(URL_RE);
  const addressMatch = text.match(ADDRESS_RE);

  const hours: string[] = [];
  for (const day of DAYS) {
    // Look for "Monday: 11AM–9PM" or "Monday 11 AM to 9 PM" patterns.
    const re = new RegExp(`${day}[^\\n]{0,4}[:\\-–—]?\\s*([0-9][^\\n]{2,40}?)(?=\\s*(?:${DAYS.join("|")})|$|\\n)`, "i");
    const m = text.match(re);
    if (m && m[1]) {
      hours.push(`${day}: ${m[1].trim().replace(/\s+/g, " ")}`);
    }
  }

  return {
    phone: phoneMatch ? phoneMatch[0].trim() : null,
    website: urlMatch ? urlMatch[0].replace(/[)\]>,.]+$/, "") : null,
    address: addressMatch ? addressMatch[0].trim() : null,
    hours: hours.length ? hours : null,
  };
}

async function firecrawlScrape(query: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";
  const target = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url: target,
      formats: ["markdown"],
      onlyMainContent: false,
      waitFor: 1500,
    }),
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
  return json.data?.markdown ?? json.markdown ?? "";
}

type RestaurantRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: { weekday?: string[]; open_now?: boolean | null } | null;
};

function needsDetails(r: RestaurantRow): boolean {
  return !r.phone || !r.website || !r.address || !r.opening_hours?.weekday?.length;
}

export const Route = createFileRoute("/api/firecrawl-details")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "10"), 1), 30);
        const restaurantId = url.searchParams.get("id");

        let query = supabaseAdmin
          .from("restaurants")
          .select("id,name,address,phone,website,opening_hours")
          .order("created_at", { ascending: true });

        if (restaurantId) {
          query = query.eq("id", restaurantId);
        }

        const { data: allRows, error } = await query;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = (allRows ?? []) as RestaurantRow[];
        const candidates = restaurantId ? rows : rows.filter(needsDetails).slice(0, limit);

        const results: {
          id: string;
          name: string;
          updated: { phone?: boolean; website?: boolean; address?: boolean; hours?: boolean };
        }[] = [];

        for (const r of candidates) {
          const q = `${r.name} ${r.address ?? "Atlanta GA"} hours phone address`;
          const md = await firecrawlScrape(q);
          if (!md) {
            results.push({ id: r.id, name: r.name, updated: {} });
            continue;
          }
          const ext = extractFromText(md);

          // Only fill blanks; don't overwrite existing user-trusted data.
          const update: {
            phone?: string;
            website?: string;
            address?: string;
            opening_hours?: { weekday: string[]; open_now: boolean | null };
          } = {};
          const flags: { phone?: boolean; website?: boolean; address?: boolean; hours?: boolean } = {};
          if (!r.phone && ext.phone) {
            update.phone = ext.phone;
            flags.phone = true;
          }
          if (!r.website && ext.website) {
            update.website = ext.website;
            flags.website = true;
          }
          if (!r.address && ext.address) {
            update.address = ext.address;
            flags.address = true;
          }
          if ((!r.opening_hours?.weekday || r.opening_hours.weekday.length === 0) && ext.hours) {
            update.opening_hours = {
              weekday: ext.hours,
              open_now: r.opening_hours?.open_now ?? null,
            };
            flags.hours = true;
          }

          if (Object.keys(update).length > 0) {
            await supabaseAdmin.from("restaurants").update(update).eq("id", r.id);
          }
          results.push({ id: r.id, name: r.name, updated: flags });
          await new Promise((res) => setTimeout(res, 250));
        }

        const remaining = rows.filter(needsDetails).length - results.filter((x) => Object.keys(x.updated).length).length;

        return new Response(
          JSON.stringify({
            processed: results.length,
            updated: results.filter((x) => Object.keys(x.updated).length).length,
            remaining,
            results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
