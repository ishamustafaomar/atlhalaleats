import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export function SiteHeader() {
  const { user, signInWithGoogle, signOut, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="size-9 rounded-xl bg-[var(--gradient-hero)] flex items-center justify-center text-primary-foreground font-display font-bold text-lg shadow-[var(--shadow-glow)]">
            ا
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-lg text-foreground">ATL Halal Eats</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Atlanta · Reviews
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Avatar className="size-9 border border-border">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                  {(user.user_metadata?.full_name || user.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={signInWithGoogle}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              <GoogleIcon />
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.7 4.1-5.4 4.1-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6L12 10.2z"
      />
    </svg>
  );
}
