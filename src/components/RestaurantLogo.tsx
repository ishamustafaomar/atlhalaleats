import { useMemo, useState } from "react";

type Props = {
  name: string;
  logoUrl?: string | null;
  cuisine?: string | null;
  emoji?: string;
  className?: string;
  /** tailwind text size for the emoji shown over the photo */
  emojiSize?: string;
};

/**
 * Renders the uploaded restaurant photo when available. Otherwise generates a
 * deterministic, food-themed photo from Unsplash Source so every card has a
 * real picture instead of a generic icon. The emoji is layered on top as a
 * subtle accent.
 */
export function RestaurantLogo({
  name,
  logoUrl,
  cuisine,
  emoji = "🍽️",
  className = "",
  emojiSize = "text-5xl",
}: Props) {
  const [errored, setErrored] = useState(false);

  const fallbackUrl = useMemo(() => {
    // Pick a search keyword from cuisine, falling back to a generic food term.
    const c = (cuisine || "").toLowerCase();
    let keyword = "restaurant,food";
    if (c.includes("shawarma") || c.includes("mediterranean") || c.includes("arab"))
      keyword = "shawarma,mediterranean";
    else if (c.includes("indian") || c.includes("biryani") || c.includes("pakistani"))
      keyword = "biryani,indian-food";
    else if (c.includes("mexican")) keyword = "tacos,mexican-food";
    else if (c.includes("chinese") || c.includes("asian")) keyword = "chinese-food,noodles";
    else if (c.includes("thai")) keyword = "thai-food";
    else if (c.includes("persian")) keyword = "persian-food,kebab";
    else if (c.includes("yemeni")) keyword = "mandi,yemeni-food";
    else if (c.includes("japanese") || c.includes("sushi")) keyword = "sushi,ramen";
    else if (c.includes("korean")) keyword = "korean-bbq";
    else if (c.includes("southern")) keyword = "fried-chicken,soul-food";
    else if (c.includes("turkish") || c.includes("istanbul")) keyword = "kebab,turkish-food";
    else if (c.includes("coffee") || c.includes("cafe")) keyword = "coffee-shop,latte";
    else if (c.includes("fast")) keyword = "burger,fries";
    else if (c.includes("halal")) keyword = "halal-food,grilled-meat";
    // Deterministic seed per restaurant so the same card always shows the same image.
    const seed = encodeURIComponent(name.slice(0, 40));
    return `https://source.unsplash.com/640x480/?${encodeURIComponent(keyword)}&sig=${seed}`;
  }, [name, cuisine]);

  const imageUrl = logoUrl && !errored ? logoUrl : fallbackUrl;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
    >
      <img
        src={imageUrl}
        alt={`${name} photo`}
        loading="lazy"
        onError={() => setErrored(true)}
        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {/* Gentle dark scrim so any text overlaid on top remains legible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      {!logoUrl && (
        <span
          className={`absolute bottom-2 right-2 ${emojiSize} drop-shadow-lg pointer-events-none`}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}
