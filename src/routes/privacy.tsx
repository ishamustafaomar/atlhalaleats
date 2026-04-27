import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ATL Halal Eats" },
      {
        name: "description",
        content:
          "How ATL Halal Eats collects, uses, and protects information about you when you sign in, vote, rate, and review halal restaurants in Atlanta.",
      },
      { property: "og:title", content: "Privacy Policy — ATL Halal Eats" },
      {
        property: "og:description",
        content: "Plain-English privacy policy for the Atlanta halal restaurant community.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const updated = "April 27, 2026";
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
      <h1 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-2">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>

      <div className="prose prose-neutral max-w-none mt-10 space-y-8 text-foreground/90 leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Who we are</h2>
          <p className="mt-2">
            ATL Halal Eats (the “Site”) is a community-run guide to halal restaurants
            in greater Atlanta. We let visitors browse restaurants for free and let
            signed-in members rate, review, comment, and vote in weekly polls. This
            policy explains what data the Site collects, how it’s used, and the
            choices you have.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            Information we collect
          </h2>
          <ul className="mt-2 list-disc pl-6 space-y-2">
            <li>
              <strong>Account info</strong> — when you sign in with Google, we receive
              your email address, display name, and profile picture from Google. We do
              not see or store your Google password.
            </li>
            <li>
              <strong>Content you create</strong> — the ratings, reviews, comments, and
              poll votes you submit are stored with your user ID so we can attribute
              them to you.
            </li>
            <li>
              <strong>Restaurants you add</strong> — if you submit a new restaurant,
              that submission is linked to your account.
            </li>
            <li>
              <strong>Technical data</strong> — standard server logs (IP address,
              browser, pages requested) are kept briefly to operate the Site and
              prevent abuse.
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            We do <strong>not</strong> sell your data, and we do not run third-party
            advertising trackers on the Site.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            How we use your information
          </h2>
          <ul className="mt-2 list-disc pl-6 space-y-2">
            <li>To show your reviews, comments, and votes alongside your name and avatar.</li>
            <li>To prevent duplicate accounts, spam, and abuse.</li>
            <li>To operate weekly polls (one ranked-choice ballot per signed-in user).</li>
            <li>To respond if you contact us.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            What other people can see
          </h2>
          <p className="mt-2">
            Reviews, ratings, comments, and poll standings are public to everyone who
            visits the Site. Your display name and profile picture are shown next to
            anything you post. Your email address is <strong>not</strong> shown to
            other users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            Third-party services
          </h2>
          <ul className="mt-2 list-disc pl-6 space-y-2">
            <li>
              <strong>Google Sign-In</strong> — used for authentication. Subject to{" "}
              <a
                className="underline hover:text-primary"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google’s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Supabase &amp; Cloudflare</strong> — host the database, files,
              and the Site itself.
            </li>
            <li>
              <strong>Firecrawl &amp; Google Maps</strong> — used server-side to fetch
              public restaurant information (address, phone, hours, photos). These
              calls are not associated with your user account.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Your choices</h2>
          <ul className="mt-2 list-disc pl-6 space-y-2">
            <li>
              <strong>Access your data</strong> — email us and we will provide a copy
              of account-related data we store about you.
            </li>
            <li>
              <strong>Edit or delete your reviews and comments</strong> — you can do this
              at any time from a restaurant page while signed in.
            </li>
            <li>
              <strong>Sign out</strong> — use the Sign out button in the header.
            </li>
            <li>
              <strong>Delete your account</strong> — email us (see below) and we will
              remove your profile, reviews, comments, and votes within a reasonable
              time.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            GDPR and international privacy rights
          </h2>
          <p className="mt-2">
            If privacy laws such as GDPR apply to you, you may request access,
            correction, deletion, restriction, or portability of your personal data,
            and you may object to certain processing. We only use sign-in data to run
            community features you choose to use, and we do not sell personal data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            Data retention &amp; security
          </h2>
          <p className="mt-2">
            We keep your account and content for as long as you have an account. Data
            is stored on infrastructure that uses encryption in transit (HTTPS) and
            at rest. No system is perfectly secure — please use a strong, unique
            password on your Google account.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Children</h2>
          <p className="mt-2">
            The Site is not directed to children under 13, and we do not knowingly
            collect data from them.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">
            Changes to this policy
          </h2>
          <p className="mt-2">
            We may update this policy from time to time. When we do, we’ll change the
            “Last updated” date at the top of this page.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-foreground">Contact</h2>
          <p className="mt-2">
            Questions or requests? Reach us at{" "}
            <a
              className="underline hover:text-primary"
              href="mailto:hello@halalbites.net"
            >
              hello@halalbites.net
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to all restaurants
        </Link>
      </div>
    </div>
  );
}
