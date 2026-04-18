import { useState } from "react";

type Props = {
  name: string;
  logoUrl?: string | null;
  emoji?: string;
  className?: string;
  /** tailwind text size for the fallback emoji */
  emojiSize?: string;
};

/**
 * Renders an actual restaurant logo when available, otherwise a clean emoji
 * tile derived from cuisine. Never falls back to a generic favicon service.
 */
export function RestaurantLogo({
  name,
  logoUrl,
  emoji = "🍽️",
  className = "",
  emojiSize = "text-4xl",
}: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = logoUrl && !errored;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          loading="lazy"
          onError={() => setErrored(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className={emojiSize}>{emoji}</span>
      )}
    </div>
  );
}
