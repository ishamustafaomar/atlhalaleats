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
].join(",");

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
};

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

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
      throw new Error("restaurantId is required");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { data: r, error } = await supabaseAdmin
      .from("restaurants")
      .select("id,name,address,latitude,longitude")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Restaurant not found");

    const query = r.address ? `${r.name}, ${r.address}` : `${r.name} Atlanta GA`;
    const place = await searchPlace(query, r.latitude, r.longitude);
    if (!place) return { ok: false as const, reason: "No Places match" };

    const update = mapPlaceToColumns(place);
    const { error: upErr } = await supabaseAdmin
      .from("restaurants")
      .update(update)
      .eq("id", data.restaurantId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true as const, place_id: update.place_id };
  });

/** Backfill ALL restaurants that have not been enriched yet. Returns counts. */
export const backfillRestaurantDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { onlyMissing?: boolean; limit?: number }) => ({
    onlyMissing: input?.onlyMissing ?? true,
    limit: Math.min(Math.max(input?.limit ?? 50, 1), 200),
  }))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("restaurants")
      .select("id,name,address,latitude,longitude,details_fetched_at")
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (data.onlyMissing) q = q.is("details_fetched_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let enriched = 0;
    let missed = 0;
    const errors: { id: string; name: string; error: string }[] = [];

    for (const r of rows ?? []) {
      try {
        const query = r.address ? `${r.name}, ${r.address}` : `${r.name} Atlanta GA`;
        const place = await searchPlace(query, r.latitude, r.longitude);
        if (!place) {
          missed++;
          // Still mark as attempted so the next backfill skips it.
          await supabaseAdmin
            .from("restaurants")
            .update({ details_fetched_at: new Date().toISOString() })
            .eq("id", r.id);
          continue;
        }
        const update = mapPlaceToColumns(place);
        const { error: upErr } = await supabaseAdmin
          .from("restaurants")
          .update(update)
          .eq("id", r.id);
        if (upErr) throw upErr;
        enriched++;
      } catch (e) {
        errors.push({ id: r.id, name: r.name, error: (e as Error).message });
      }
      // Light pacing to stay polite with Places API.
      await new Promise((res) => setTimeout(res, 120));
    }

    const { count: remaining } = await supabaseAdmin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .is("details_fetched_at", null);

    return {
      processed: (rows ?? []).length,
      enriched,
      missed,
      errors,
      remaining: remaining ?? 0,
    };
  });
