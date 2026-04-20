import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ATL Halal Eats — Atlanta Halal Restaurant Reviews" },
      {
        name: "description",
        content:
          "Discover, rate, and review halal restaurants across Atlanta. Real reviews from the local Muslim community.",
      },
      { property: "og:title", content: "ATL Halal Eats — Atlanta Halal Restaurant Reviews" },
      {
        property: "og:description",
        content: "Discover, rate, and review halal restaurants across Atlanta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "ATL Halal Eats — Atlanta Halal Restaurant Reviews" },
      { name: "description", content: "Your ultimate guide to Halal food in Atlanta. Explore restaurant reviews, community ratings, and hidden gems across the A." },
      { property: "og:description", content: "Your ultimate guide to Halal food in Atlanta. Explore restaurant reviews, community ratings, and hidden gems across the A." },
      { name: "twitter:description", content: "Your ultimate guide to Halal food in Atlanta. Explore restaurant reviews, community ratings, and hidden gems across the A." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ec711524-5344-4e91-af7a-20dab337c949" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ec711524-5344-4e91-af7a-20dab337c949" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster />
    </AuthProvider>
  );
}
