import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import {
  Search,
  MapPin,
  Plus,
  ArrowUpDown,
  X,
  Sparkles,
  TrendingUp,
  Clock,
  Trophy,
  ChevronRight,
  Navigation,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddRestaurantDialog } from "@/components/AddRestaurantDialog";
import { PollBanner } from "@/components/PollBanner";
import { RestaurantLogo } from "@/components/RestaurantLogo";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "top", label: "Highest rated", icon: Trophy },
  { value: "popular", label: "Most reviewed", icon: TrendingUp },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "near", label: "Nearest to me", icon: Navigation },
  { value: "name", label: "A → Z", icon: ArrowUpDown },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["top", "popular", "newest", "near", "name"]), "popular").default("popular"),
  cuisine: fallback(z.string(), "").default(""),
  nearMin: fallback(z.enum(["", "5", "10", "40"]), "").default(""),
});

// Approx avg city driving speed in km per minute (~30 mph = 0.804 km/min)
const KM_PER_MIN = 0.8;
const NEAR_OPTIONS = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "40", label: "40 min" },
] as const;

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  component: Index,
});

type Restaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  google_rating: number | null;
  note: string | null;
  avg_rating: number | null;
  review_count: number | null;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  logo_url: string | null;
};

// Haversine distance in kilometers
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Smart category system. Each category matches restaurants by keywords found in
// either the cuisine field or the restaurant name. Order matters — more specific
// categories first so things like "Persian Kebab" tag as Persian, not Kebab.
type Category = {
  key: string;
  label: string;
  emoji: string;
  // case-insensitive substrings to match against name + cuisine
  match: string[];
};

const CATEGORIES: Category[] = [
  { key: "biryani", label: "Biryani", emoji: "🍛", match: ["biryani", "bawarchi"] },
  { key: "shawarma", label: "Shawarma", emoji: "🌯", match: ["shawarma", "shwarma", "schawarma"] },
  { key: "kebab", label: "Kebab", emoji: "🍢", match: ["kebab", "kabob", "kabab", "souvlaki"] },
  { key: "mediterranean", label: "Mediterranean", emoji: "🥙", match: ["mediterranean", "greek", "athens", "aviva"] },
  { key: "lebanese", label: "Lebanese", emoji: "🧆", match: ["lebanese", "falafel", "baraka"] },
  { key: "turkish", label: "Turkish", emoji: "🥘", match: ["turkish", "turk", "ottoman", "anatolia"] },
  { key: "persian", label: "Persian", emoji: "🍢", match: ["persian", "iranian", "chelo", "kabob house", "farsi", "delbar", "dyar"] },
  { key: "afghan", label: "Afghan", emoji: "🥟", match: ["afghan", "kabul"] },
  { key: "yemeni", label: "Yemeni", emoji: "🍖", match: ["yemen", "yemeni", "mandi", "azouma"] },
  { key: "egyptian", label: "Egyptian", emoji: "🥙", match: ["egyptian", "egypt"] },
  { key: "moroccan", label: "Moroccan", emoji: "🍲", match: ["moroccan", "tagine", "marrakech"] },
  { key: "syrian", label: "Syrian / Iraqi", emoji: "🫓", match: ["syrian", "iraqi", "damascus", "aleppo"] },
  { key: "arab", label: "Arab / Middle Eastern", emoji: "🕌", match: ["arab", "middle eastern", "halal kitchen"] },
  { key: "pakistani", label: "Pakistani", emoji: "🍛", match: ["pakistani", "karachi", "lahore", "desi"] },
  { key: "indian", label: "Indian", emoji: "🍛", match: ["indian", "curry", "tandoor", "masala", "dhaba"] },
  { key: "asian", label: "Asian", emoji: "🥢", match: ["asian", "fusion asian", "bistro"] },
  { key: "chinese", label: "Chinese", emoji: "🥡", match: ["chinese", "wok", "dragon", "panda"] },
  { key: "thai", label: "Thai", emoji: "🍜", match: ["thai", "pad", "tom yum"] },
  { key: "korean", label: "Korean", emoji: "🍱", match: ["korean", "kimchi", "bulgogi"] },
  { key: "japanese", label: "Japanese / Sushi", emoji: "🍣", match: ["sushi", "japanese", "ramen", "budi"] },
  { key: "mexican", label: "Mexican", emoji: "🌮", match: ["mexican", "taco", "burrito", "arepa", "cocinita"] },
  { key: "burger", label: "Burgers", emoji: "🍔", match: ["burger", "cheesesteak", "smash"] },
  { key: "chicken", label: "Chicken", emoji: "🍗", match: ["chicken", "wing", "fried", "boss wings", "chick'n", "fryd"] },
  { key: "pizza", label: "Pizza", emoji: "🍕", match: ["pizza", "pizzeria"] },
  { key: "bbq", label: "BBQ & Grill", emoji: "🍖", match: ["bbq", "grill", "smoke", "briskfire"] },
  { key: "seafood", label: "Seafood", emoji: "🦐", match: ["seafood", "fish", "shrimp", "crab"] },
  { key: "cafe", label: "Cafe & Coffee", emoji: "☕", match: ["cafe", "coffee", "café"] },
  { key: "bakery", label: "Bakery & Sweets", emoji: "🥐", match: ["bakery", "bake", "pastry", "dessert", "cake", "sweet", "cone"] },
  { key: "soul", label: "Soul / Southern", emoji: "🍗", match: ["soul", "southern", "auntie", "kitchen"] },
];

function categoriesFor(r: { name: string; cuisine: string | null }): string[] {
  const haystack = `${r.name} ${r.cuisine ?? ""}`.toLowerCase();
  const tags: string[] = [];
  for (const cat of CATEGORIES) {
    if (cat.match.some((m) => haystack.includes(m))) {
      tags.push(cat.key);
    }
  }
  return tags;
}

function emojiFor(r: { name: string; cuisine: string | null } | string | null): string {
  if (!r) return "🍽️";
  const obj = typeof r === "string" ? { name: "", cuisine: r } : r;
  const tags = categoriesFor(obj);
  if (tags.length === 0) return "🍽️";
  const cat = CATEGORIES.find((c) => c.key === tags[0]);
  return cat?.emoji ?? "🍽️";
}

// Generate a stable accent gradient per card
function gradientFor(id: string): string {
  const hues = [
    "from-amber-400/30 via-orange-300/20 to-rose-300/20",
    "from-emerald-400/30 via-teal-300/20 to-lime-300/20",
    "from-rose-400/30 via-pink-300/20 to-orange-300/20",
    "from-sky-400/30 via-cyan-300/20 to-emerald-300/20",
    "from-violet-400/30 via-fuchsia-300/20 to-pink-300/20",
    "from-yellow-400/30 via-amber-300/20 to-orange-300/20",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hues[hash % hues.length];
}

function Index() {
  const { q, sort, cuisine, nearMin } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const [localQ, setLocalQ] = useState(q);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [winners, setWinners] = useState<Map<string, { pollSlug: string; pollTitle: string }>>(
    new Map(),
  );

  useEffect(() => {
    setLocalQ(q);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== q) {
        navigate({ search: { q: localQ, sort, cuisine, nearMin }, replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [localQ, q, navigate]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("restaurants")
      .select(
        "id,name,cuisine,google_rating,note,avg_rating,review_count,created_at,latitude,longitude,address,logo_url",
      );
    setRestaurants((data ?? []) as Restaurant[]);
    setLoading(false);
  };

  const requestLocation = (opts?: { thenSortNear?: boolean; thenNearMin?: "" | "5" | "10" | "40" }) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't supported on this device.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocLoading(false);
        toast.success("Location set — showing nearest spots.");
        if (opts?.thenSortNear) {
          navigate({ search: { q, sort: "near", cuisine, nearMin }, replace: true });
        } else if (opts?.thenNearMin !== undefined) {
          navigate({ search: { q, sort, cuisine, nearMin: opts.thenNearMin }, replace: true });
        }
      },
      (err) => {
        setLocLoading(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get your location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const clearLocation = () => {
    setUserLoc(null);
    if (sort === "near" || nearMin) {
      navigate({ search: { q, sort: sort === "near" ? "popular" : sort, cuisine, nearMin: "" }, replace: true });
    }
  };

  useEffect(() => {
    load();
    // Load winners (rank #1) for each poll, to show "Winner" badge on cards
    (async () => {
      const { data: polls } = await supabase
        .from("polls")
        .select("id, slug, title");
      if (!polls) return;
      const map = new Map<string, { pollSlug: string; pollTitle: string }>();
      await Promise.all(
        polls.map(async (p) => {
          const { data: res } = await supabase.rpc("poll_results", { _poll_id: p.id });
          const top = (res ?? [])[0] as { restaurant_id: string; points: number } | undefined;
          if (top && top.points > 0 && !map.has(top.restaurant_id)) {
            map.set(top.restaurant_id, { pollSlug: p.slug, pollTitle: p.title });
          }
        }),
      );
      setWinners(map);
    })();
  }, []);

  // Build category list with counts based on derived tags
  const categoryList = useMemo(() => {
    const counts = new Map<string, number>();
    restaurants.forEach((r) => {
      categoriesFor(r).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return CATEGORIES.filter((c) => (counts.get(c.key) ?? 0) > 0)
      .map((c) => ({ ...c, count: counts.get(c.key) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [restaurants]);

  const featured = useMemo(() => {
    return [...restaurants]
      .filter((r) => (r.review_count ?? 0) >= 1 && Number(r.avg_rating ?? 0) >= 4)
      .sort((a, b) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0))
      .slice(0, 8);
  }, [restaurants]);

  // Decorate with distance when user location is available
  const withDistance = useMemo(() => {
    if (!userLoc) return restaurants.map((r) => ({ ...r, _distance: null as number | null }));
    return restaurants.map((r) => ({
      ...r,
      _distance:
        r.latitude != null && r.longitude != null
          ? distanceKm(userLoc.lat, userLoc.lon, r.latitude, r.longitude)
          : null,
    }));
  }, [restaurants, userLoc]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const radiusKm = nearMin && userLoc ? Number(nearMin) * KM_PER_MIN : null;
    let list = withDistance.filter((r) => {
      const matchesTerm =
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.cuisine ?? "").toLowerCase().includes(term);
      const matchesCuisine = !cuisine || categoriesFor(r).includes(cuisine);
      const matchesRadius =
        radiusKm == null || (r._distance != null && r._distance <= radiusKm);
      return matchesTerm && matchesCuisine && matchesRadius;
    });

    if (sort === "near" || (radiusKm != null)) {
      // Pin restaurants without coords to the bottom
      list = [...list].sort((a, b) => {
        const ad = a._distance ?? Infinity;
        const bd = b._distance ?? Infinity;
        return ad - bd;
      });
      return list;
    }

    list = [...list].sort((a, b) => {
      switch (sort) {
        case "top": {
          const ar = Number(a.avg_rating ?? 0);
          const br = Number(b.avg_rating ?? 0);
          if (br !== ar) return br - ar;
          return (b.review_count ?? 0) - (a.review_count ?? 0);
        }
        case "popular": {
          const diff = (b.review_count ?? 0) - (a.review_count ?? 0);
          if (diff !== 0) return diff;
          return Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0);
        }
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [withDistance, q, sort, cuisine, nearMin, userLoc]);

  const setSort = (v: SortKey) => {
    if (v === "near" && !userLoc) {
      requestLocation({ thenSortNear: true });
      return;
    }
    navigate({ search: { q, sort: v, cuisine, nearMin }, replace: true });
  };
  const setCuisine = (v: string) =>
    navigate({ search: { q, sort, cuisine: v, nearMin }, replace: true });
  const setNearMin = (v: "" | "5" | "10" | "40") => {
    if (v && !userLoc) {
      requestLocation({ thenNearMin: v });
      return;
    }
    navigate({ search: { q, sort, cuisine, nearMin: v }, replace: true });
  };
  const clearFilters = () =>
    navigate({ search: { q: "", sort: "popular", cuisine: "", nearMin: "" }, replace: true });

  const hasFilters = q || cuisine || sort !== "popular" || nearMin;
  const showFeatured = !hasFilters && featured.length >= 4;

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div
          className="absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, oklch(0.78 0.16 70 / 0.6), transparent 45%), radial-gradient(circle at 85% 80%, oklch(0.55 0.18 35 / 0.5), transparent 50%)",
          }}
        />
        {/* subtle grain */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10 sm:pt-24 sm:pb-16">
          <Badge className="bg-background/20 text-primary-foreground border-background/30 backdrop-blur-md mb-6 px-3 py-1">
            <MapPin className="size-3 mr-1.5" /> Greater Atlanta
            <span className="mx-2 opacity-60">·</span>
            <Sparkles className="size-3 mr-1" />
            {restaurants.length} verified spots
          </Badge>

          <h1 className="font-display font-bold text-5xl sm:text-7xl lg:text-8xl text-primary-foreground max-w-4xl leading-[0.95] tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.4)]">
            Atlanta's <em className="not-italic text-accent italic">halal</em> table,
            <br />
            <span className="text-primary-foreground/90">curated by you.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-primary-foreground/95 max-w-xl leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
            Honest reviews, ratings, and conversation around the city's best halal kitchens.
          </p>

          {/* Search */}
          <div className="mt-10 max-w-2xl">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                placeholder="Search shawarma, biryani, kebab…"
                className="pl-14 pr-14 h-16 text-base bg-background border-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] rounded-2xl focus-visible:ring-2 focus-visible:ring-accent"
              />
              {localQ && (
                <button
                  onClick={() => setLocalQ("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-muted text-muted-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CUISINE PILLS — side scrolling */}
      <section className="border-b border-border bg-card/40 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 py-4 overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6">
            <CuisinePill
              active={!cuisine}
              onClick={() => setCuisine("")}
              emoji="🍽️"
              label="All"
              count={restaurants.length}
            />
            {categoryList.map((c) => (
              <CuisinePill
                key={c.key}
                active={cuisine === c.key}
                onClick={() => setCuisine(c.key)}
                emoji={c.emoji}
                label={c.label}
                count={c.count}
              />
            ))}
          </div>
        </div>
      </section>

      {/* WEEKLY POLL BANNER */}
      <PollBanner />
      {showFeatured && !loading && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-wider">
                <Trophy className="size-4" /> Top rated
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground mt-1">
                Community favorites
              </h2>
            </div>
            <button
              onClick={() => setSort("top")}
              className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              See all <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2 snap-x snap-mandatory">
            {featured.map((r, idx) => (
              <FeaturedCard key={r.id} restaurant={r} rank={idx + 1} />
            ))}
          </div>
        </section>
      )}

      {/* TOOLBAR */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground tracking-tight">
              {q ? (
                <>
                  Results for <span className="text-primary">"{q}"</span>
                </>
              ) : cuisine ? (
                (() => {
                  const cat = CATEGORIES.find((c) => c.key === cuisine);
                  return (
                    <>
                      <span className="mr-2">{cat?.emoji ?? "🍽️"}</span>
                      {cat?.label ?? cuisine}
                    </>
                  );
                })()
              ) : (
                "All restaurants"
              )}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              <span className="font-medium text-foreground">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "place" : "places"}
              {sort !== "popular" && (
                <>
                  {" "}· sorted by{" "}
                  <span className="text-foreground font-medium">
                    {SORT_OPTIONS.find((o) => o.value === sort)?.label.toLowerCase()}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-border bg-card overflow-hidden h-11">
              <button
                type="button"
                onClick={() => (userLoc ? clearLocation() : requestLocation({ thenSortNear: true }))}
                disabled={locLoading}
                className={`h-full px-3 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                  userLoc
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
                aria-label={userLoc ? "Clear location" : "Use my location"}
              >
                {locLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Navigation className={`size-4 ${userLoc ? "" : "text-primary"}`} />
                )}
                <span className="hidden sm:inline">
                  {userLoc ? "Near me" : "Near me"}
                </span>
                {userLoc && <X className="size-3.5 opacity-80 ml-0.5" />}
              </button>
              <div className="h-6 w-px bg-border" />
              {NEAR_OPTIONS.map((o) => {
                const active = nearMin === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setNearMin(active ? "" : o.value)}
                    disabled={locLoading}
                    className={`h-full px-3 text-xs font-semibold tabular-nums transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    aria-pressed={active}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-11 w-[200px] bg-card border-border rounded-xl">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    disabled={o.value === "near" && !userLoc && locLoading}
                  >
                    <span className="flex items-center gap-2">
                      <o.icon className="size-3.5" />
                      {o.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => (user ? setAddOpen(true) : signInWithGoogle())}
              className="h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-sm"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Add restaurant</span>
            </Button>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {q && (
              <FilterChip
                label={`"${q}"`}
                onRemove={() => {
                  setLocalQ("");
                  navigate({ search: { q: "", sort, cuisine, nearMin }, replace: true });
                }}
              />
            )}
            {cuisine && (
              <FilterChip
                label={CATEGORIES.find((c) => c.key === cuisine)?.label ?? cuisine}
                onRemove={() => setCuisine("")}
              />
            )}
            {nearMin && (
              <FilterChip
                label={`Within ${nearMin} min`}
                onRemove={() => setNearMin("")}
              />
            )}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* GRID */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-3xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border border-dashed border-border bg-card/40">
            <div className="text-5xl mb-3">🤷</div>
            <p className="font-display text-2xl text-foreground">No restaurants match</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try a different cuisine or clear your filters.
            </p>
            <Button onClick={clearFilters} variant="outline" className="mt-6 rounded-xl">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((r, idx) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                rank={sort === "top" && idx < 3 ? idx + 1 : null}
                distanceKm={r._distance ?? null}
                winner={winners.get(r.id) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <AddRestaurantDialog open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
    </div>
  );
}

function CuisinePill({
  active,
  onClick,
  emoji,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? "bg-foreground text-background border-foreground shadow-sm"
          : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      <span className="text-base leading-none">{emoji}</span>
      {label}
      <span
        className={`text-[10px] tabular-nums ${
          active ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FeaturedCard({ restaurant: r, rank }: { restaurant: Restaurant; rank: number }) {
  return (
    <Link
      to="/restaurant/$id"
      params={{ id: r.id }}
      className="group shrink-0 w-[280px] sm:w-[320px] snap-start rounded-3xl overflow-hidden border border-border bg-card shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-1 transition-all"
    >
      <div
        className={`relative h-44 sm:h-48 bg-gradient-to-br ${gradientFor(r.id)} flex items-center justify-center overflow-hidden`}
      >
        <RestaurantLogo
          name={r.name}
          logoUrl={r.logo_url}
          cuisine={r.cuisine}
          emoji={emojiFor(r)}
          emojiSize="text-5xl"
          className="size-full"
        />
        {r.logo_url && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
        )}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-foreground/90 text-background text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur">
          <Trophy className="size-3 text-accent" /> #{rank}
        </div>
        <div className="absolute top-3 right-3 z-10 bg-background/90 text-foreground text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur">
          ★ {Number(r.avg_rating ?? 0).toFixed(1)}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-lg text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1">
          {r.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.cuisine}</p>
        <div className="mt-3 flex items-center justify-between">
          <StarRating value={Number(r.avg_rating ?? 0)} size="sm" />
          <span className="text-xs text-muted-foreground">
            {r.review_count} {r.review_count === 1 ? "review" : "reviews"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function RestaurantCard({
  restaurant: r,
  rank,
  distanceKm: dist,
  winner,
}: {
  restaurant: Restaurant;
  rank: number | null;
  distanceKm?: number | null;
  winner?: { pollSlug: string; pollTitle: string } | null;
}) {
  const distLabel =
    dist == null
      ? null
      : dist < 1
        ? `${Math.round(dist * 1000)} m`
        : `${dist.toFixed(dist < 10 ? 1 : 0)} km`;
  return (
    <Link
      to="/restaurant/$id"
      params={{ id: r.id }}
      className="group relative rounded-3xl overflow-hidden border border-border bg-card shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-1 transition-all"
    >
      {rank !== null && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
          <Trophy className="size-3" /> #{rank}
        </div>
      )}
      {/* Visual header — full photo when uploaded, gradient + emoji otherwise */}
      <div
        className={`relative h-48 sm:h-52 bg-gradient-to-br ${gradientFor(r.id)} flex items-center justify-center overflow-hidden`}
      >
        <RestaurantLogo
          name={r.name}
          logoUrl={r.logo_url}
          cuisine={r.cuisine}
          emoji={emojiFor(r)}
          emojiSize="text-5xl"
          className="size-full"
        />
        {r.logo_url && (
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
        )}
        {distLabel && (
          <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
            <Navigation className="size-3" /> {distLabel}
          </div>
        )}
        {r.google_rating && (
          <div className="absolute top-3 right-3 z-10 bg-background/95 text-foreground text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur shadow-sm">
            ★ {r.google_rating}
          </div>
        )}
      </div>

      <div className="p-5">
        {winner && (
          <div className="mb-2 inline-flex items-center gap-1.5 bg-accent/15 text-accent border border-accent/30 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <Trophy className="size-3" />
            Poll winner · {winner.pollTitle}
          </div>
        )}
        <h3 className="font-display font-semibold text-xl text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1">
          {r.name}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">{r.cuisine}</p>

        {r.note && (
          <p className="text-xs text-brick mt-3 italic font-medium line-clamp-2">
            ⚠ {r.note.replace(/\\\*/g, "*")}
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StarRating value={Number(r.avg_rating ?? 0)} size="sm" />
            {r.review_count && r.review_count > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Number(r.avg_rating).toFixed(1)} · {r.review_count}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No reviews</span>
            )}
          </div>
          <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 transition-all">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-medium">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-primary/20 rounded-full p-0.5"
        aria-label={`Remove ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
