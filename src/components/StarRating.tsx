import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StarRating({ value, onChange, size = "md", className }: Props) {
  const sizes = { sm: "size-4", md: "size-5", lg: "size-7" };
  const interactive = !!onChange;
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            className={cn(
              interactive && "transition-transform hover:scale-110 cursor-pointer",
              !interactive && "cursor-default"
            )}
            aria-label={`${n} stars`}
          >
            <Star
              className={cn(
                sizes[size],
                filled ? "fill-accent text-accent" : "fill-transparent text-muted-foreground/40"
              )}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
