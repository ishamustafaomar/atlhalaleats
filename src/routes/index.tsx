import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import { Search, MapPin, Plus, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddRestaurantDialog } from "@/components/AddRestaurantDialog";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "top", label: "Highest rated" },
  { value: "popular", label: "Most reviewed" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A → Z" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["top", "popular", "newest", "name"]), "popular").default("popular"),
  cuisine: fallback(z.string(), "").default(""),
});

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
};

function Index() {
  const { q, sort, cuisine } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const [localQ, setLocalQ] = useState(q);

  // keep input in sync if URL changes externally
  useEffect(() => {
    setLocalQ(q);
  }, [q]);

  // debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (localQ !== q) {
        navigate({ search: (prev) => ({ ...prev, q: localQ }), replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [localQ, q, navigate]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("restaurants")
      .select("id,name,cuisine,google_rating,note,avg_rating,review_count,created_at");
    setRestaurants((data ?? []) as Restaurant[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => {
      if (r.cuisine) set.add(r.cuisine);
    });
    return Array.from(set).sort();
  }, [restaurants]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = restaurants.filter((r) => {
      const matchesTerm =
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.cuisine ?? "").toLowerCase().includes(term);
      const matchesCuisine = !cuisine || r.cuisine === cuisine;
      return matchesTerm && matchesCuisine;
    });

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
  }, [restaurants, q, sort, cuisine]);

  const setSort = (v: SortKey) =>
    navigate({ search: (prev) => ({ ...prev, sort: v }), replace: true });
  const setCuisine = (v: string) =>
    navigate({ search: (prev) => ({ ...prev, cuisine: v === "__all" ? "" : v }), replace: true });
  const clearFilters = () =>
    navigate({ search: { q: "", sort: "popular", cuisine: "" }, replace: true });

  const hasFilters = q || cuisine || sort !== "popular";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-hero)] opacity-95" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.78 0.16 70 / 0.4), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.55 0.18 35 / 0.3), transparent 45%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <Badge className="bg-background/20 text-primary-foreground border-background/30 backdrop-blur-sm mb-6">
            <MapPin className="size-3 mr-1" /> Greater Atlanta · {restaurants.length} spots
          </Badge>
          <h1 className="font-display font-bold text-5xl sm:text-7xl text-primary-foreground max-w-3xl leading-[1.05] drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
            Find your next <em className="not-italic text-accent">halal</em> favorite in Atlanta.
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/95 max-w-xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
            Honest reviews, ratings, and conversation around the city's halal restaurants — from
            shawarma joints to biryani houses.
          </p>

          <div className="mt-10 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                value={localQ}
                onChange={(e) => setLocalQ(e.target.value)}
                placeholder="Search by name or cuisine…"
                className="pl-12 h-14 text-base bg-background border-0 shadow-[var(--shadow-soft)] rounded-2xl"
              />
              {localQ && (
                <button
                  onClick={() => setLocalQ("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-3xl text-foreground">
              {q ? `Results for "${q}"` : cuisine ? cuisine : "All restaurants"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} {filtered.length === 1 ? "place" : "places"}
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
            {cuisines.length > 0 && (
              <Select value={cuisine || "__all"} onValueChange={setCuisine}>
                <SelectTrigger className="h-10 w-[180px] bg-card border-border">
                  <SelectValue placeholder="All cuisines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All cuisines</SelectItem>
                  {cuisines.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-10 w-[180px] bg-card border-border">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => (user ? setAddOpen(true) : signInWithGoogle())}
              variant="outline"
              className="h-10 border-primary/30 hover:bg-primary/5"
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
                  navigate({ search: (prev) => ({ ...prev, q: "" }), replace: true });
                }}
              />
            )}
            {cuisine && <FilterChip label={cuisine} onRemove={() => setCuisine("__all")} />}
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-16">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-border bg-card/40">
            <p className="font-display text-xl text-foreground">No restaurants match your filters</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try a different cuisine or clear your filters.
            </p>
            <Button onClick={clearFilters} variant="outline" className="mt-5">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((r, idx) => {
              const isTop = sort === "top" && idx < 3 && Number(r.avg_rating ?? 0) >= 4.5;
              return (
                <Link
                  key={r.id}
                  to="/restaurant/$id"
                  params={{ id: r.id }}
                  className="group relative rounded-2xl bg-[var(--gradient-card)] border border-border p-6 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 transition-all"
                >
                  {isTop && (
                    <div className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shadow-md">
                      #{idx + 1}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display font-semibold text-xl text-foreground leading-tight group-hover:text-primary transition-colors">
                      {r.name}
                    </h3>
                    {r.google_rating && (
                      <Badge className="shrink-0 bg-accent/15 text-foreground border-accent/30 hover:bg-accent/20">
                        ★ {r.google_rating}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.cuisine}</p>
                  {r.note && (
                    <p className="text-xs text-brick mt-2 italic font-medium">
                      ⚠ {r.note.replace(/\\\*/g, "*")}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating value={Number(r.avg_rating ?? 0)} size="sm" />
                      {r.review_count && r.review_count > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {Number(r.avg_rating).toFixed(1)} · {r.review_count}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No reviews yet</span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <AddRestaurantDialog open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
    </div>
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
