import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/StarRating";
import { Search, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddRestaurantDialog } from "@/components/AddRestaurantDialog";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
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
};

function Index() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const { user, signInWithGoogle } = useAuth();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("restaurants")
      .select("id,name,cuisine,google_rating,note,avg_rating,review_count")
      .order("review_count", { ascending: false })
      .order("name");
    setRestaurants(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.cuisine ?? "").toLowerCase().includes(term)
    );
  }, [restaurants, q]);

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
          <Badge className="bg-background/15 text-primary-foreground border-background/20 backdrop-blur-sm mb-6">
            <MapPin className="size-3 mr-1" /> Greater Atlanta · {restaurants.length} spots
          </Badge>
          <h1 className="font-display font-bold text-5xl sm:text-7xl text-primary-foreground max-w-3xl leading-[1.05] text-gray-950">
            Find your next <em className="not-italic text-accent">halal</em> favorite in Atlanta.
          </h1>
          <p className="mt-6 text-lg text-primary-foreground/80 max-w-xl">
            Honest reviews, ratings, and conversation around the city's halal restaurants — from
            shawarma joints to biryani houses.
          </p>

          <div className="mt-10 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or cuisine…"
                className="pl-12 h-14 text-base bg-background border-0 shadow-[var(--shadow-soft)] rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display font-bold text-3xl text-foreground">
              {q ? `Results for "${q}"` : "All restaurants"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} {filtered.length === 1 ? "place" : "places"}
            </p>
          </div>
          <Button
            onClick={() => (user ? setAddOpen(true) : signInWithGoogle())}
            variant="outline"
            className="border-primary/30 hover:bg-primary/5"
          >
            <Plus className="size-4" />
            Add a restaurant
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to="/restaurant/$id"
                params={{ id: r.id }}
                className="group rounded-2xl bg-[var(--gradient-card)] border border-border p-6 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5 transition-all"
              >
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
                  <p className="text-xs text-brick mt-2 italic">⚠ {r.note.replace(/\\\*/g, "*")}</p>
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
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            No restaurants match "{q}".
          </div>
        )}
      </section>

      <AddRestaurantDialog open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
    </div>
  );
}
