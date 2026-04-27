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

const BAD_IMAGE_FRAGMENTS = [
  "fonts.gstatic.com/s/i/productlogos/googleg",
  "gstatic.com/images/branding",
  "gstatic.com/s2/favicons",
  "google.com/logos",
  "google.com/images/branding",
  "/productlogos/",
  "googleg_",
  "google_g_logo",
  "google-logo",
  "ssl.gstatic.com/gb/images",
  "googlelogo",
  "/favicon",
  "favicon.ico",
  ".svg",
];

function isUsableRestaurantImage(url?: string | null) {
  if (!url || !url.startsWith("http")) return false;
  const lower = url.toLowerCase();
  return !BAD_IMAGE_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

/**
 * Renders a real restaurant photo when available (Google Places photo or
 * uploaded logo). Falls back to a deterministic cuisine-themed gradient with
 * an emoji when no photo exists or the image fails to load.
 */
export function RestaurantLogo({
  name,
  logoUrl,
  photoUrls,
  emoji = "🍽️",
  className = "",
  emojiSize = "text-6xl",
}: Props) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const candidateUrls = useMemo(() => {
    const urls = [...(photoUrls ?? []), logoUrl].filter(isUsableRestaurantImage) as string[];
    return Array.from(new Set(urls));
  }, [logoUrl, photoUrls]);

  const imageSrc = useMemo(
    () => candidateUrls.find((url) => !failedUrls.includes(url)) ?? null,
    [candidateUrls, failedUrls],
  );

  // Deterministic gradient per restaurant so each fallback card looks distinct.
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

  if (imageSrc) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={imageSrc}
          alt={`${name} photo`}
          loading="lazy"
          onError={() => setFailedUrls((prev) => (prev.includes(imageSrc) ? prev : [...prev, imageSrc]))}
          className="size-full object-cover"
        />
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
