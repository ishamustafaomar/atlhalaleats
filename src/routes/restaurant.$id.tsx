import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Trash2,
  MapPin,
  Phone,
  Globe,
  Clock,
  Utensils,
  ShoppingBag,
  Bike,
  CalendarCheck,
  Sparkles,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { enrichRestaurant } from "@/server/places.functions";
import { RestaurantLogo } from "@/components/RestaurantLogo";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/restaurant/$id")({
  component: RestaurantPage,
});

type Restaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  google_rating: number | null;
  note: string | null;
  avg_rating: number | null;
  review_count: number | null;
  logo_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  menu_url: string | null;
  price_level: number | null;
  opening_hours: { weekday?: string[]; open_now?: boolean | null } | null;
  service_options: {
    dine_in?: boolean | null;
    takeout?: boolean | null;
    delivery?: boolean | null;
    reservable?: boolean | null;
  } | null;
  plus_code: string | null;
  place_id: string | null;
  details_fetched_at: string | null;
};

type Review = {
  id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

type Comment = {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

function RestaurantPage() {
  const { id } = useParams({ from: "/restaurant/$id" });
  const { user, signInWithGoogle } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [commentsByReview, setCommentsByReview] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);

  // form state
  const [myRating, setMyRating] = useState(0);
  const [myBody, setMyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: rv }] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("reviews")
        .select("id,user_id,rating,body,created_at")
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setRestaurant(r as Restaurant | null);

    const reviewsRaw = (rv ?? []) as Array<Omit<Review, "profiles">>;

    const ids = reviewsRaw.map((x) => x.id);
    const { data: cs } = ids.length
      ? await supabase
          .from("comments")
          .select("id,review_id,user_id,body,created_at")
          .in("review_id", ids)
          .order("created_at", { ascending: true })
      : { data: [] as Array<Omit<Comment, "profiles">> };

    const commentsRaw = (cs ?? []) as Array<Omit<Comment, "profiles">>;

    const userIds = Array.from(
      new Set([...reviewsRaw.map((x) => x.user_id), ...commentsRaw.map((x) => x.user_id)])
    );
    const profilesMap: Record<string, { display_name: string | null; avatar_url: string | null }> =
      {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", userIds);
      profs?.forEach((p) => {
        profilesMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      });
    }

    const reviewsFinal: Review[] = reviewsRaw.map((x) => ({
      ...x,
      profiles: profilesMap[x.user_id] ?? null,
    }));
    setReviews(reviewsFinal);

    if (user) {
      const mine = reviewsFinal.find((x) => x.user_id === user.id);
      if (mine) {
        setMyRating(mine.rating);
        setMyBody(mine.body ?? "");
      }
    }

    const grouped: Record<string, Comment[]> = {};
    commentsRaw.forEach((c) => {
      (grouped[c.review_id] ??= []).push({
        ...c,
        profiles: profilesMap[c.user_id] ?? null,
      });
    });
    setCommentsByReview(grouped);

    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return signInWithGoogle();
    if (!myRating) return toast.error("Pick a star rating first");
    setSubmitting(true);
    const { error } = await supabase.from("reviews").upsert(
      {
        restaurant_id: id,
        user_id: user.id,
        rating: myRating,
        body: myBody.trim() || null,
      },
      { onConflict: "restaurant_id,user_id" }
    );
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Review saved");
    load();
  };

  const deleteReview = async (rid: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", rid);
    if (error) return toast.error(error.message);
    setMyRating(0);
    setMyBody("");
    toast.success("Review deleted");
    load();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <div className="h-10 w-1/2 rounded-lg bg-muted animate-pulse" />
        <div className="h-32 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Restaurant not found</h1>
        <Link to="/" className="text-primary underline mt-4 inline-block">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> All restaurants
      </Link>

      {/* Hero header */}
      <div className="rounded-3xl border border-border p-6 sm:p-10 shadow-[var(--shadow-soft)]" style={{ background: "var(--gradient-card)" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <RestaurantLogo
              name={restaurant.name}
              logoUrl={restaurant.logo_url}
              emoji="🍽️"
              emojiSize="text-3xl"
              className="size-20 rounded-2xl bg-background border border-border shadow-sm shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                {restaurant.cuisine}
              </p>
              <h1 className="font-display font-bold text-4xl sm:text-5xl text-foreground leading-tight">
                {restaurant.name}
              </h1>
            </div>
          </div>
          {restaurant.google_rating && (
            <Badge className="bg-accent/15 text-foreground border-accent/30 text-base px-3 py-1.5">
              ★ {restaurant.google_rating} Google
            </Badge>
          )}
        </div>

        {restaurant.note && (
          <div className="mt-4 p-3 rounded-xl bg-brick/10 border border-brick/20">
            <p className="text-sm text-brick">
              <strong>Halal note:</strong> {restaurant.note.replace(/\\\*/g, "*")}
            </p>
          </div>
        )}

        {restaurant.address && (
          <p className="mt-4 text-sm text-muted-foreground flex items-start gap-2">
            <MapPin className="size-4 mt-0.5 shrink-0" />
            <span>{restaurant.address}</span>
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4 pt-6 border-t border-border">
          <StarRating value={Number(restaurant.avg_rating ?? 0)} size="lg" />
          <div>
            <div className="font-display font-bold text-2xl text-foreground">
              {Number(restaurant.avg_rating ?? 0).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">
              {restaurant.review_count ?? 0} community{" "}
              {restaurant.review_count === 1 ? "review" : "reviews"}
            </div>
          </div>
          {(() => {
            const query =
              restaurant.latitude != null && restaurant.longitude != null
                ? `${restaurant.latitude},${restaurant.longitude}`
                : restaurant.address
                  ? `${restaurant.name} ${restaurant.address}`
                  : restaurant.name;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
            return (
              <Button
                asChild
                variant="outline"
                className="ml-auto rounded-full border-border bg-background hover:bg-accent/10"
              >
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <MapPin className="size-4" /> View on Google Maps
                </a>
              </Button>
            );
          })()}
        </div>
      </div>

      {/* Place info card (Google Places enrichment) */}
      <RestaurantInfoCard restaurant={restaurant} onRefresh={load} />

      {/* Review form */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold mb-4">
          {reviews.find((r) => r.user_id === user?.id) ? "Your review" : "Leave a review"}
        </h2>
        <form
          onSubmit={submitReview}
          className="rounded-2xl bg-card border border-border p-5 space-y-4"
        >
          <div>
            <p className="text-sm font-medium mb-2">Your rating</p>
            <StarRating value={myRating} onChange={setMyRating} size="lg" />
          </div>
          <Textarea
            placeholder={
              user
                ? "Share your experience — taste, service, halal certainty…"
                : "Sign in with Google to write a review"
            }
            value={myBody}
            onChange={(e) => setMyBody(e.target.value)}
            rows={4}
            disabled={!user}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-primary">
              {user ? (submitting ? "Saving…" : "Post review") : "Sign in to review"}
            </Button>
            {user && reviews.find((r) => r.user_id === user.id) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const mine = reviews.find((r) => r.user_id === user.id);
                  if (mine) deleteReview(mine.id);
                }}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Reviews list */}
      <section className="mt-10 space-y-6">
        <h2 className="font-display text-2xl font-bold">
          {reviews.length} {reviews.length === 1 ? "Review" : "Reviews"}
        </h2>
        {reviews.length === 0 && (
          <p className="text-muted-foreground">
            Be the first to review {restaurant.name}.
          </p>
        )}
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            comments={commentsByReview[r.id] ?? []}
            onRefresh={load}
          />
        ))}
      </section>
    </div>
  );
}

function ReviewCard({
  review,
  comments,
  onRefresh,
}: {
  review: Review;
  comments: Comment[];
  onRefresh: () => void;
}) {
  const { user, signInWithGoogle } = useAuth();
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return signInWithGoogle();
    if (!body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({
      review_id: review.id,
      user_id: user.id,
      body: body.trim(),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setBody("");
    setShowCommentBox(false);
    onRefresh();
  };

  const del = async (cid: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", cid);
    if (error) return toast.error(error.message);
    onRefresh();
  };

  const name = review.profiles?.display_name || "Anonymous";
  return (
    <article className="rounded-2xl bg-card border border-border p-5 sm:p-6">
      <header className="flex items-center gap-3">
        <Avatar className="size-10 border border-border">
          <AvatarImage src={review.profiles?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="font-medium text-foreground">{name}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
          </div>
        </div>
        <StarRating value={review.rating} size="sm" />
      </header>

      {review.body && (
        <p className="mt-4 text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {review.body}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => setShowCommentBox((s) => !s)}
          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
        >
          <MessageSquare className="size-3.5" />
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
          {!showCommentBox && " · Reply"}
        </button>

        {comments.length > 0 && (
          <ul className="mt-3 space-y-3">
            {comments.map((c) => {
              const cn = c.profiles?.display_name || "Anonymous";
              return (
                <li key={c.id} className="flex gap-3 text-sm">
                  <Avatar className="size-7 border border-border shrink-0">
                    <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {cn.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-xl bg-muted/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-xs text-foreground">{cn}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-foreground/90 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                  {user?.id === c.user_id && (
                    <button
                      onClick={() => del(c.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {showCommentBox && (
          <form onSubmit={post} className="mt-3 space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={user ? "Add a comment…" : "Sign in to comment"}
              rows={2}
              disabled={!user}
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCommentBox(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={posting}>
                {user ? (posting ? "Posting…" : "Post") : "Sign in"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
