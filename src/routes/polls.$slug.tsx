import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RestaurantLogo } from "@/components/RestaurantLogo";
import { toast } from "sonner";
import {
  Vote,
  Trophy,
  ArrowLeft,
  X,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/polls/$slug")({
  component: PollDetail,
  notFoundComponent: () => (
    <div className="max-w-md mx-auto py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Poll not found</h1>
      <Link to="/polls" className="text-primary mt-4 inline-block">
        ← All polls
      </Link>
    </div>
  ),
});

type Poll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  status: string;
  week_end: string;
};

type Restaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  avg_rating: number | null;
  review_count: number | null;
  logo_url: string | null;
  photo_urls: string[] | null;
};

type ResultRow = {
  restaurant_id: string;
  name: string;
  cuisine: string | null;
  points: number;
  vote_count: number;
};

function PollDetail() {
  const { slug } = Route.useParams();
  const { user, signInWithGoogle } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [candidates, setCandidates] = useState<Restaurant[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"vote" | "results">("vote");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: pollData } = await supabase
        .from("polls")
        .select("id,slug,title,description,cuisine,status,week_end")
        .eq("slug", slug)
        .maybeSingle();
      if (!pollData) {
        if (!cancelled) setLoading(false);
        throw notFound();
      }
      const p = pollData as Poll;
      if (cancelled) return;
      setPoll(p);

      // Auto from category: fetch all restaurants and filter client-side.
      // (Server .or() filters with many keywords blow up the URL length.)
      const { data: allRestaurants } = await supabase
        .from("restaurants")
        .select("id,name,cuisine,note,avg_rating,review_count,logo_url,photo_urls")
        .order("avg_rating", { ascending: false });
      if (cancelled) return;

      const cuisineTerm = (p.cuisine ?? "").trim().toLowerCase();
      const relatedKeywords: Record<string, string[]> = {
        shawarma: ["shawarma", "mediterranean", "halal", "arab", "lebanese", "syrian", "turkish", "kebab", "yemen", "persian"],
        biryani: ["biryani", "indian", "pakistani", "halal", "hyderabad"],
        kebab: ["kebab", "turkish", "persian", "mediterranean", "halal", "arab"],
        mediterranean: ["mediterranean", "lebanese", "greek", "halal", "arab"],
      };
      const keywords = (relatedKeywords[cuisineTerm] ?? [cuisineTerm]).filter(Boolean);
      const matches = (allRestaurants ?? []).filter((r) => {
        if (!cuisineTerm) return true;
        const hay = `${r.name ?? ""} ${r.cuisine ?? ""} ${r.note ?? ""}`.toLowerCase();
        return keywords.some((kw) => hay.includes(kw));
      });
      // Cap at top 10 — sorted by avg_rating from the query, ties broken by review_count
      const top10 = matches
        .sort((a, b) => {
          const ar = Number(a.avg_rating ?? 0);
          const br = Number(b.avg_rating ?? 0);
          if (br !== ar) return br - ar;
          return (b.review_count ?? 0) - (a.review_count ?? 0);
        })
        .slice(0, 10);
      setCandidates(top10 as Restaurant[]);

      // Load existing vote
      if (user) {
        const { data: vote } = await supabase
          .from("poll_votes")
          .select("id, poll_vote_items(restaurant_id, rank)")
          .eq("poll_id", p.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (vote && (vote as any).poll_vote_items) {
          const items = ((vote as any).poll_vote_items as { restaurant_id: string; rank: number }[])
            .sort((a, b) => a.rank - b.rank)
            .map((i) => i.restaurant_id);
          if (!cancelled) setPicks(items);
        }
      }

      // Load results
      const { data: res } = await supabase.rpc("poll_results", { _poll_id: p.id });
      if (!cancelled) setResults((res ?? []) as ResultRow[]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, user]);

  const candidateMap = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  );

  const togglePick = (id: string) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 5) {
        toast.error("You can only rank 5 restaurants. Remove one first.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const movePick = (idx: number, dir: -1 | 1) => {
    setPicks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const submitVote = async () => {
    if (!user) {
      await signInWithGoogle();
      return;
    }
    if (!poll || picks.length === 0) {
      toast.error("Pick at least one restaurant.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("cast_poll_vote", {
      _poll_id: poll.id,
      _restaurant_ids: picks,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Vote saved!");
      const { data: res } = await supabase.rpc("poll_results", { _poll_id: poll.id });
      setResults((res ?? []) as ResultRow[]);
      setTab("results");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-muted-foreground">Loading…</div>;
  }
  if (!poll) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(poll.week_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/polls"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> All polls
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={poll.status === "active" ? "default" : "secondary"}>
            {poll.status === "active" ? "Active" : "Closed"}
          </Badge>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {poll.status === "active" ? `${daysLeft} days left` : "Ended"}
          </span>
        </div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl text-foreground leading-tight">
          {poll.title}
        </h1>
        {poll.description && (
          <p className="mt-3 text-muted-foreground max-w-2xl">{poll.description}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-8">
        <button
          onClick={() => setTab("vote")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === "vote"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Vote className="size-4 inline mr-1.5" />
          Cast your vote
        </button>
        <button
          onClick={() => setTab("results")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === "results"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="size-4 inline mr-1.5" />
          Live results
        </button>
      </div>

      {tab === "vote" ? (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Pick list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-lg">Your ranking</h3>
              <span className="text-xs text-muted-foreground">{picks.length}/5</span>
            </div>
            {picks.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                Tap restaurants on the right to add them to your ranked list.
              </div>
            ) : (
              <ol className="space-y-2">
                {picks.map((id, idx) => {
                  const r = candidateMap.get(id);
                  if (!r) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                    >
                      <div className="size-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <RestaurantLogo
                        name={r.name}
                        logoUrl={r.logo_url}
                        photoUrls={r.photo_urls}
                        emoji="🍽️"
                        emojiSize="text-xl"
                        className="size-10 rounded-lg bg-muted shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{r.name}</div>
                        {r.cuisine && (
                          <div className="text-xs text-muted-foreground truncate">
                            {r.cuisine}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <button
                          onClick={() => movePick(idx, -1)}
                          disabled={idx === 0}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => movePick(idx, 1)}
                          disabled={idx === picks.length - 1}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        onClick={() => togglePick(id)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                        aria-label="Remove"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <Button
              onClick={submitVote}
              disabled={saving || picks.length === 0}
              className="w-full mt-6 h-12"
              size="lg"
            >
              {saving
                ? "Saving…"
                : user
                  ? "Submit ranking"
                  : "Sign in to vote"}
            </Button>
          </div>

          {/* Candidates */}
          <div>
            <h3 className="font-display font-bold text-lg mb-3">
              Candidates{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({candidates.length})
              </span>
            </h3>
            {candidates.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                No restaurants tagged with "{poll.cuisine}" yet. Add one from the home page.
              </div>
            ) : (
              <ul className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {candidates.map((r) => {
                  const picked = picks.includes(r.id);
                  const rankIdx = picks.indexOf(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => togglePick(r.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                          picked
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div
                          className={`size-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                            picked
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {picked ? rankIdx + 1 : "·"}
                        </div>
                        <RestaurantLogo
                          name={r.name}
                          logoUrl={r.logo_url}
                          photoUrls={r.photo_urls}
                          emoji="🍽️"
                          emojiSize="text-xl"
                          className="size-10 rounded-lg bg-muted shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{r.name}</div>
                          {r.cuisine && (
                            <div className="text-xs text-muted-foreground truncate">
                              {r.cuisine}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          ★ {Number(r.avg_rating ?? 0).toFixed(1)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            Ranked-choice voting: the candidate with the fewest top-choice votes is eliminated each
            round and their voters' next pick is counted, until one restaurant has a majority.
          </p>
          {results.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground">
              No votes yet. Be the first!
            </div>
          ) : (
            <ol className="space-y-2">
              {results.map((r, idx) => {
                const max = results[0]?.points || 1;
                const pct = Math.round((r.points / max) * 100);
                return (
                  <li
                    key={r.restaurant_id}
                    className="relative p-4 rounded-xl border border-border bg-card overflow-hidden"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/10"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center gap-4">
                      <div
                        className={`size-10 rounded-xl flex items-center justify-center font-display font-bold text-lg shrink-0 ${
                          idx === 0
                            ? "bg-accent text-accent-foreground"
                            : idx < 3
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx === 0 ? <Trophy className="size-5" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{r.name}</div>
                        {r.cuisine && (
                          <div className="text-xs text-muted-foreground truncate">
                            {r.cuisine}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-lg">
                          {r.points}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            1st-place
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.vote_count} {r.vote_count === 1 ? "ballot" : "ballots"}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
