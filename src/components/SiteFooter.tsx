import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/atl-halal-eats-logo.png";

/**
 * Real footer with brand mark, navigation, and legal/contact links.
 * Replaces the previous one-line footer in __root.tsx.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border bg-card/40 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="ATL Halal Eats logo"
              className="size-9 rounded-xl object-cover"
            />
            <div className="leading-tight">
              <div className="font-display font-bold text-base text-foreground">
                ATL Halal Eats
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Atlanta · Reviews · Polls
              </div>
            </div>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground max-w-md leading-relaxed">
            A community-run guide to halal restaurants across greater Atlanta. Built
            with care for the local Muslim community.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
            Explore
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="text-muted-foreground hover:text-primary">
                All restaurants
              </Link>
            </li>
            <li>
              <Link to="/polls" className="text-muted-foreground hover:text-primary">
                Weekly polls
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
            About
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/privacy" className="text-muted-foreground hover:text-primary">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-muted-foreground hover:text-primary">
                Terms of service
              </Link>
            </li>
            <li>
              <a
                href="mailto:hello@halalbites.net"
                className="text-muted-foreground hover:text-primary"
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {year} ATL Halal Eats · Privacy-first community guide</p>
          <p>
            Restaurant info from public sources. Always verify halal status with the
            restaurant directly.
          </p>
        </div>
      </div>
    </footer>
  );
}
