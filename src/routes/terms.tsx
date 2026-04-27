import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ATL Halal Eats" },
      {
        name: "description",
        content:
          "Terms for using ATL Halal Eats, including community reviews, restaurant information, polls, and account responsibilities.",
      },
      { property: "og:title", content: "Terms of Service — ATL Halal Eats" },
      {
        property: "og:description",
        content: "Plain-English terms for the Atlanta halal restaurant community.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const updated = "April 27, 2026";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
      <h1 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-2">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

      <div className="prose prose-neutral max-w-none mt-10 space-y-8 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Using the site</h2>
          <p className="mt-2">
            ATL Halal Eats is a community guide for discovering and discussing halal
            restaurants in greater Atlanta. You may browse restaurant information without an
            account. Signing in is only needed when you want to add restaurants, post reviews,
            comment, or vote in polls.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Community content</h2>
          <p className="mt-2">
            Reviews, comments, ratings, and poll votes should be honest, respectful, and based
            on your own experience. We may remove spam, abusive content, or content that appears
            to be misleading.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Restaurant information</h2>
          <p className="mt-2">
            Restaurant details may come from public sources or community submissions and can be
            outdated. Always confirm hours, menu details, pricing, and halal status directly with
            the restaurant before visiting.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Accounts and privacy</h2>
          <p className="mt-2">
            If you sign in, you are responsible for activity under your account. Our Privacy
            Policy explains what account data we collect, how it is used, and how to request
            access or deletion.
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to all restaurants
        </Link>
        <Link to="/privacy" className="text-sm text-primary hover:underline">
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}