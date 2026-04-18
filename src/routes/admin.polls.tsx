import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Lock, Sparkles } from "lucide-react";
import { backfillRestaurantDetails } from "@/server/places.functions";

export const Route = createFileRoute("/admin/polls")({
  component: AdminPolls,
});

type Poll = {
  id: string;
  slug: string;
  title: string;
  cuisine: string | null;
  status: string;
  week_end: string;
};

function AdminPolls() {
  const { user, signInWithGoogle } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    cuisine: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStats, setBackfillStats] = useState<{
    enriched: number;
    missed: number;
    remaining: number;
  } | null>(null);
  const stopRequestedRef = useRef(false);
  const [autoBackfilling, setAutoBackfilling] = useState(false);
  const [autoProgress, setAutoProgress] = useState<{
    batches: number;
    enriched: number;
    missed: number;
    remaining: number;
    total: number;
  } | null>(null);
  const backfillFn = useServerFn(backfillRestaurantDetails);

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await backfillFn({ data: { onlyMissing: true, limit: 50 } });
      setBackfillStats(res);
      toast.success(`Enriched ${res.enriched}, missed ${res.missed}. ${res.remaining} left.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBackfilling(false);
    }
  };

  const runBackfillAll = async () => {
    if (autoBackfilling) {
      stopRequestedRef.current = true;
      return;
    }
    stopRequestedRef.current = false;
    setAutoBackfilling(true);
    let batches = 0;
    let totalEnriched = 0;
    let totalMissed = 0;
    let initialRemaining = 0;
    let lastRemaining = Infinity;
    let stagnantRuns = 0;
    try {
      while (true) {
        const res = await backfillFn({ data: { onlyMissing: true, limit: 50 } });
        batches += 1;
        totalEnriched += res.enriched;
        totalMissed += res.missed;
        if (initialRemaining === 0) {
          // First batch: estimate the total backlog (already-processed in batch 1 + remaining).
          initialRemaining = res.enriched + res.missed + res.remaining;
        }
        setAutoProgress({
          batches,
          enriched: totalEnriched,
          missed: totalMissed,
          remaining: res.remaining,
          total: initialRemaining,
        });
        setBackfillStats(res);

        if (res.remaining === 0) break;
        if (stopRequestedRef.current) break;

        if (res.enriched + res.missed === 0 || res.remaining >= lastRemaining) {
          stagnantRuns += 1;
          if (stagnantRuns >= 2) {
            toast.warning("Backfill stalled — some restaurants can't be matched on Google.");
            break;
          }
        } else {
          stagnantRuns = 0;
        }
        lastRemaining = res.remaining;
        await new Promise((r) => setTimeout(r, 300));
      }
      toast.success(
        `Done. ${batches} batch${batches === 1 ? "" : "es"}, +${totalEnriched} enriched.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAutoBackfilling(false);
      stopRequestedRef.current = false;
    }
  };

  const load = () =>
    supabase
      .from("polls")
      .select("id,slug,title,cuisine,status,week_end")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPolls((data ?? []) as Poll[]));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <Lock className="size-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold">Admin only</h1>
        <p className="text-muted-foreground mt-2 mb-6">Sign in to continue.</p>
        <Button onClick={signInWithGoogle}>Sign in</Button>
      </div>
    );
  }

  if (roleLoading) {
    return <div className="max-w-4xl mx-auto py-20 text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <Lock className="size-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold">Not authorized</h1>
        <p className="text-muted-foreground mt-2">
          You don't have admin access.
        </p>
        <Link to="/" className="text-primary mt-4 inline-block">
          ← Home
        </Link>
      </div>
    );
  }

  const create = async () => {
    if (!form.title || !form.slug) {
      toast.error("Title and slug are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("polls").insert({
      title: form.title,
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      cuisine: form.cuisine || null,
      description: form.description || null,
      created_by: user.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Poll created.");
      setForm({ title: "", slug: "", cuisine: "", description: "" });
      load();
    }
    setSaving(false);
  };

  const toggleStatus = async (p: Poll) => {
    const next = p.status === "active" ? "closed" : "active";
    const { error } = await supabase.from("polls").update({ status: next }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Poll ${next}.`);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this poll and all votes?")) return;
    const { error } = await supabase.from("polls").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted.");
      load();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display font-bold text-3xl mb-6">Manage polls</h1>

      <div className="p-6 rounded-2xl border border-border bg-card mb-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-lg">Restaurant info backfill</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-fetch hours, phone, website, price, photos and service options from Google Places.
              {backfillStats && !autoBackfilling
                ? ` Last run: +${backfillStats.enriched} enriched, ${backfillStats.remaining} left.`
                : ""}
            </p>

            {autoBackfilling && autoProgress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>
                    Batch {autoProgress.batches} · {autoProgress.enriched} enriched ·{" "}
                    {autoProgress.missed} missed
                  </span>
                  <span>{autoProgress.remaining} remaining</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-500"
                    style={{
                      width: `${
                        autoProgress.total > 0
                          ? Math.min(
                              100,
                              ((autoProgress.total - autoProgress.remaining) /
                                autoProgress.total) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={runBackfill}
              disabled={backfilling || autoBackfilling}
              variant="outline"
            >
              <Sparkles className="size-4" /> {backfilling ? "Fetching…" : "Run batch (50)"}
            </Button>
            <Button
              onClick={runBackfillAll}
              disabled={backfilling}
              variant={autoBackfilling ? "destructive" : "default"}
            >
              {autoBackfilling ? "Stop" : "Backfill all"}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-border bg-card mb-10">
        <h2 className="font-display font-bold text-lg mb-4">New poll</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Best Biryani in Atlanta"
            />
          </div>
          <div>
            <Label>Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="best-biryani"
            />
          </div>
          <div>
            <Label>Cuisine keyword</Label>
            <Input
              value={form.cuisine}
              onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
              placeholder="biryani, shawarma, kebab…"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Restaurants matching this in name or cuisine become candidates.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <Button onClick={create} disabled={saving} className="mt-4">
          {saving ? "Creating…" : "Create poll"}
        </Button>
      </div>

      <h2 className="font-display font-bold text-lg mb-4">All polls</h2>
      <div className="space-y-2">
        {polls.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={p.status === "active" ? "default" : "secondary"}>
                  {p.status}
                </Badge>
                <Link
                  to="/polls/$slug"
                  params={{ slug: p.slug }}
                  className="font-semibold hover:text-primary truncate"
                >
                  {p.title}
                </Link>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                /{p.slug} · cuisine: {p.cuisine || "—"}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => toggleStatus(p)}>
              {p.status === "active" ? "Close" : "Reopen"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(p.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
