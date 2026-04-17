import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vote, ArrowRight } from "lucide-react";

type Poll = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  week_end: string;
};

export function PollBanner() {
  const [poll, setPoll] = useState<Poll | null>(null);

  useEffect(() => {
    supabase
      .from("polls")
      .select("id,slug,title,description,cuisine,week_end")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPoll(data as Poll | null));
  }, []);

  if (!poll) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(poll.week_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
      <Link
        to="/polls/$slug"
        params={{ slug: poll.slug }}
        className="group block relative overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elegant)] transition-all hover:shadow-[var(--shadow-glow)]"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-background/20 backdrop-blur-md flex items-center justify-center text-primary-foreground">
              <Vote className="size-6" />
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary-foreground/80 sm:hidden">
              Weekly Poll · {daysLeft}d left
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="hidden sm:block text-[10px] uppercase tracking-[0.2em] font-semibold text-primary-foreground/80 mb-1">
              Weekly Poll · {daysLeft} days left
            </div>
            <h3 className="font-display font-bold text-xl sm:text-2xl text-primary-foreground leading-tight">
              {poll.title}
            </h3>
            {poll.description && (
              <p className="text-sm text-primary-foreground/85 mt-1 line-clamp-1">
                {poll.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-primary-foreground font-semibold">
            <span>Rank top 5</span>
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </section>
  );
}
