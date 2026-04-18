import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.priceLevel",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.dineIn",
  "places.takeout",
  "places.delivery",
  "places.reservable",
  "places.servesBreakfast",
  "places.servesLunch",
  "places.servesDinner",
  "places.menuForChildren",
  "places.plusCode",
  "places.photos",
].join(",");

const MAX_PHOTOS = 6;
const PHOTO_MAX_WIDTH = 1200;

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string; // PRICE_LEVEL_INEXPENSIVE | MODERATE | EXPENSIVE | VERY_EXPENSIVE
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    weekdayDescriptions?: string[];
    periods?: unknown;
    openNow?: boolean;
  };
  currentOpeningHours?: {
    weekdayDescriptions?: string[];
    openNow?: boolean;
  };
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  servesBreakfast?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  plusCode?: { compoundCode?: string; globalCode?: string };
  photos?: { name?: string; widthPx?: number; heightPx?: number }[];
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/**
 * Last-resort: ask Firecrawl to scrape Google Images for the restaurant and
 * return up to N image URLs. Unreliable on purpose — used only when Google
 * Places returned zero photos for a restaurant.
 */
async function firecrawlImageSearch(query: string, max = 6): Promise<string[]> {
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
    if (!res.ok) {
      console.error(`[firecrawlImageSearch] failed [${res.status}]`);
      return [];
    }
    const json = (await res.json()) as { data?: { html?: string }; html?: string };
    const html = json.data?.html ?? json.html ?? "";
    if (!html) return [];

    // Extract image URLs from <img src> and any http(s)://...jpg|jpeg|png|webp in the HTML.
    const found = new Set<string>();
    const imgSrcRe = /<img[^>]+src=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = imgSrcRe.exec(html)) && found.size < max * 4) {
      const u = m[1];
      if (u.startsWith("http") && !u.includes("gstatic.com/images") && !u.includes("/logos/")) {
        found.add(u);
      }
    }
    const urlRe = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi;
    while ((m = urlRe.exec(html)) && found.size < max * 4) {
      found.add(m[0]);
    }

    // Filter out tiny google-owned thumbnails / icons.
    const filtered = Array.from(found).filter((u) => {
      if (u.includes("google.com/images/branding")) return false;
      if (u.includes("favicon")) return false;
      return true;
    });
    return filtered.slice(0, max);
  } catch (e) {
    console.error("[firecrawlImageSearch] error:", (e as Error).message);
    return [];
  }
}

async function searchPlace(query: string, biasLat?: number | null, biasLng?: number | null) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not configured");

  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
  if (biasLat != null && biasLng != null) {
    body.locationBias = {
      circle: {
        center: { latitude: biasLat, longitude: biasLng },
        radius: 5000.0,
      },
    };
  }

  const res = await fetch(PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places search failed [${res.status}]: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { places?: PlaceResult[] };
  return json.places?.[0] ?? null;
}

/**
 * Resolve a Google Places photo "name" (e.g. "places/XYZ/photos/ABC") to a stable
 * googleusercontent.com URL by following the redirect from the media endpoint.
 * We store the final URL so the client never needs the API key.
 */
async function resolvePhotoUrls(
  photos: PlaceResult["photos"],
  apiKey: string,
): Promise<string[]> {
  if (!photos?.length) return [];
  const picks = photos.slice(0, MAX_PHOTOS);
  const out: string[] = [];
  for (const p of picks) {
    if (!p.name) continue;
    const mediaUrl = `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=${PHOTO_MAX_WIDTH}&skipHttpRedirect=true`;
    try {
      const res = await fetch(mediaUrl, {
        headers: { "X-Goog-Api-Key": apiKey },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { photoUri?: string };
      if (json.photoUri) out.push(json.photoUri);
    } catch {
      // skip this photo
    }
  }
  return out;
}

function mapPlaceToColumns(p: PlaceResult) {
  const opening_hours = p.currentOpeningHours?.weekdayDescriptions?.length
    ? {
        weekday: p.currentOpeningHours.weekdayDescriptions,
        open_now: p.currentOpeningHours.openNow ?? null,
      }
    : p.regularOpeningHours?.weekdayDescriptions?.length
      ? {
          weekday: p.regularOpeningHours.weekdayDescriptions,
          open_now: p.regularOpeningHours.openNow ?? null,
        }
      : null;

  const service_options = {
    dine_in: p.dineIn ?? null,
    takeout: p.takeout ?? null,
    delivery: p.delivery ?? null,
    reservable: p.reservable ?? null,
  };
  const hasService = Object.values(service_options).some((v) => v !== null);

  return {
    place_id: p.id ?? null,
    address: p.formattedAddress ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    google_rating: p.rating ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    menu_url: null as string | null,
    price_level: p.priceLevel ? (PRICE_LEVEL_MAP[p.priceLevel] ?? null) : null,
    opening_hours,
    service_options: hasService ? service_options : null,
    plus_code: p.plusCode?.compoundCode ?? p.plusCode?.globalCode ?? null,
    details_fetched_at: new Date().toISOString(),
  };
}

/** Enrich a single restaurant by ID. Anyone signed in can trigger it for any restaurant. */
export const enrichRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { restaurantId: string }) => {
    if (!input?.restaurantId || typeof input.restaurantId !== "string") {
      return { restaurantId: "" };
    }
    return input;
  })
  .handler(async ({ data }) => {
    try {
      if (!data.restaurantId) {
        return { ok: false as const, reason: "restaurantId required" };
      }
      if (!process.env.GOOGLE_PLACES_API_KEY) {
        console.error("[enrichRestaurant] GOOGLE_PLACES_API_KEY missing");
        return { ok: false as const, reason: "Places API key not configured" };
      }

      const { data: r, error } = await supabaseAdmin
        .from("restaurants")
        .select("id,name,address,latitude,longitude")
        .eq("id", data.restaurantId)
        .maybeSingle();
      if (error) {
        console.error("[enrichRestaurant] DB lookup failed:", error.message);
        return { ok: false as const, reason: `DB error: ${error.message}` };
      }
      if (!r) return { ok: false as const, reason: "Restaurant not found" };

      const query = r.address ? `${r.name}, ${r.address}` : `${r.name} Atlanta GA`;
      const place = await searchPlace(query, r.latitude, r.longitude);
      if (!place) return { ok: false as const, reason: "No Places match" };

      const update = mapPlaceToColumns(place);
      let photo_urls = await resolvePhotoUrls(
        place.photos,
        process.env.GOOGLE_PLACES_API_KEY,
      );
      if (photo_urls.length === 0) {
        photo_urls = await firecrawlImageSearch(
          `${r.name} ${r.address ?? "Atlanta GA"} restaurant`,
        );
      }
      const { error: upErr } = await supabaseAdmin
        .from("restaurants")
        .update({ ...update, ...(photo_urls.length ? { photo_urls } : {}) })
        .eq("id", data.restaurantId);
      if (upErr) {
        console.error("[enrichRestaurant] DB update failed:", upErr.message);
        return { ok: false as const, reason: `DB update error: ${upErr.message}` };
      }

      return { ok: true as const, place_id: update.place_id, photos: photo_urls.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[enrichRestaurant] unhandled:", msg);
      return { ok: false as const, reason: msg };
    }
  });

/** Backfill ALL restaurants that have not been enriched yet. Returns counts. */
export const backfillRestaurantDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { onlyMissing?: boolean; limit?: number }) => ({
    onlyMissing: input?.onlyMissing ?? true,
    limit: Math.min(Math.max(input?.limit ?? 50, 1), 200),
  }))
  .handler(async ({ data }) => {
    try {
      if (!process.env.GOOGLE_PLACES_API_KEY) {
        return {
          processed: 0,
          enriched: 0,
          missed: 0,
          errors: [{ id: "", name: "", error: "GOOGLE_PLACES_API_KEY not configured" }],
          remaining: 0,
        };
      }
      let q = supabaseAdmin
        .from("restaurants")
        .select("id,name,address,latitude,longitude,details_fetched_at,photo_urls")
        .order("created_at", { ascending: true })
        .limit(data.limit);
      // "missing" = never fetched OR no photos yet (so we backfill photos onto previously-enriched rows)
      if (data.onlyMissing) {
        q = q.or("details_fetched_at.is.null,photo_urls.is.null,photo_urls.eq.{}");
      }
      const { data: rows, error } = await q;
      if (error) {
        return {
          processed: 0,
          enriched: 0,
          missed: 0,
          errors: [{ id: "", name: "", error: error.message }],
          remaining: 0,
        };
      }

      let enriched = 0;
      let missed = 0;
      const errors: { id: string; name: string; error: string }[] = [];

      for (const r of rows ?? []) {
        try {
          const query = r.address ? `${r.name}, ${r.address}` : `${r.name} Atlanta GA`;
          const place = await searchPlace(query, r.latitude, r.longitude);
          if (!place) {
            missed++;
            await supabaseAdmin
              .from("restaurants")
              .update({ details_fetched_at: new Date().toISOString() })
              .eq("id", r.id);
            continue;
          }
          const update = mapPlaceToColumns(place);
          const photo_urls = await resolvePhotoUrls(
            place.photos,
            process.env.GOOGLE_PLACES_API_KEY!,
          );
          const { error: upErr } = await supabaseAdmin
            .from("restaurants")
            .update({ ...update, ...(photo_urls.length ? { photo_urls } : {}) })
            .eq("id", r.id);
          if (upErr) throw upErr;
          enriched++;
        } catch (e) {
          errors.push({ id: r.id, name: r.name, error: (e as Error).message });
        }
        await new Promise((res) => setTimeout(res, 120));
      }

      const { count: remaining } = await supabaseAdmin
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .or("details_fetched_at.is.null,photo_urls.is.null,photo_urls.eq.{}");

      return {
        processed: (rows ?? []).length,
        enriched,
        missed,
        errors,
        remaining: remaining ?? 0,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[backfillRestaurantDetails] unhandled:", msg);
      return {
        processed: 0,
        enriched: 0,
        missed: 0,
        errors: [{ id: "", name: "", error: msg }],
        remaining: 0,
      };
    }
  });
