import { useMemo, useState } from "react";

type Props = {
  name: string;
  logoUrl?: string | null;
  /** Real Google Places photos for this restaurant — when present, used before any fallback. */
  photoUrls?: string[] | null;
  cuisine?: string | null;
  emoji?: string;
  className?: string;
  /** tailwind text size for the emoji */
  emojiSize?: string;
};

/**
 * Renders the real restaurant photo when available (Google Places or uploaded
 * logo). Otherwise shows a clean, cuisine-themed gradient with the emoji icon
 * — no generic stock photos.
 */
export function RestaurantLogo({
  name,
  logoUrl,
  photoUrls,
  emoji = "🍽️",
  className = "",
  emojiSize = "text-6xl",
}: Props) {
  const [errored, setErrored] = useState(false);
  const realPhoto =
    photoUrls && photoUrls.length > 0 ? photoUrls[0] : logoUrl ? logoUrl : null;

  // Deterministic gradient per restaurant so each card looks distinct.
  const gradient = useMemo(() => {
    const palettes = [
      "from-amber-200 via-orange-300 to-rose-300",
      "from-emerald-200 via-teal-300 to-cyan-300",
      "from-rose-200 via-pink-300 to-fuchsia-300",
      "from-sky-200 via-indigo-300 to-violet-300",
      "from-yellow-200 via-amber-300 to-orange-400",
      "from-lime-200 via-emerald-300 to-teal-400",
      "from-fuchsia-200 via-purple-300 to-indigo-400",
      "from-orange-200 via-red-300 to-rose-400",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return palettes[hash % palettes.length];
  }, [name]);

  if (realPhoto && !errored) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={realPhoto}
          alt={`${name} photo`}
          loading="lazy"
          onError={() => setErrored(true)}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <span className={`${emojiSize} drop-shadow-md select-none`} aria-hidden>
        {emoji}
      </span>
    </div>
  );
}
