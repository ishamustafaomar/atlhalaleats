import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vote, Trophy, ArrowRight, Calendar, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/polls/")({
  head: () => ({
    meta: [
      { title: "Weekly Polls — ATL Halal Eats" },
      {
        name: "description",
        content:
          "Vote on Atlanta's best halal spots each week — shawarma, biryani, kebab and more. Rank your top 5.",
      },
      { property: "og:title", content: "Weekly Polls — ATL Halal Eats" },
      {
        property: "og:description",
        content: "Rank Atlanta's best halal restaurants by category each week.",
      },
    ],
  }),
  component: PollsPage,
});

type Poll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  status: string;
  week_start: string;
  week_end: string;
};

function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("polls")
      .select("id,slug,title,description,cuisine,status,week_start,week_end")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPolls((data ?? []) as Poll[]);
        setLoading(false);
      });
  }, []);

  const active = polls.filter((p) => p.status === "active");
  const closed = polls.filter((p) => p.status !== "active");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>

      <div className="mb-10">
        <div className="flex items-center gap-2 text-accent text-sm font-semibold uppercase tracking-wider">
          <Vote className="size-4" /> Community polls
        </div>
        <h1 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-2 leading-tight">
          What's Atlanta voting on this week?
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Each week we run a poll based on what Atlanta is searching for. Rank
          your top 5 — winners are decided by a points system (1st = 5pts, 2nd =
          4, etc.).
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading polls…</div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {active.map((p) => (
                <PollCard key={p.id} poll={p} />
              ))}
            </div>
          )}

          {closed.length > 0 && (
            <>
              <h2 className="font-display font-bold text-2xl text-foreground mt-12 mb-4 flex items-center gap-2">
                <Trophy className="size-5 text-accent" /> Past polls
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {closed.map((p) => (
                  <PollCard key={p.id} poll={p} closed />
                ))}
              </div>
            </>
          )}

          {polls.length === 0 && (
            <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-2xl">
              No polls yet. Check back soon!
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PollCard({ poll, closed = false }: { poll: Poll; closed?: boolean }) {
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(poll.week_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );
  return (
    <Link
      to="/polls/$slug"
      params={{ slug: poll.slug }}
      className="group block p-6 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-[var(--shadow-elegant)] transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant={closed ? "secondary" : "default"}>
          {closed ? "Closed" : "Active"}
        </Badge>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Calendar className="size-3" />
          {closed ? "Ended" : `${daysLeft}d left`}
        </span>
      </div>
      <h3 className="font-display font-bold text-xl text-foreground leading-tight group-hover:text-primary transition-colors">
        {poll.title}
      </h3>
      {poll.description && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {poll.description}
        </p>
      )}
      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        {closed ? "See results" : "Cast your vote"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
