import { useMemo, useState } from "react";

type Props = {
  name: string;
  logoUrl?: string | null;
  /** Real Google Places photos for this restaurant — when present, used before any fallback. */
  photoUrls?: string[] | null;
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
  photoUrls,
  cuisine,
  emoji = "🍽️",
  className = "",
  emojiSize = "text-5xl",
}: Props) {
  const [errored, setErrored] = useState(false);
  const googlePhoto = photoUrls && photoUrls.length > 0 ? photoUrls[0] : null;

  const fallbackUrl = useMemo(() => {
    // Curated, hand-picked Unsplash photos per cuisine. Unsplash Source API is
    // deprecated, so we use direct image URLs from Unsplash with a deterministic
    // pick per restaurant so each card always shows the same image.
    const c = (cuisine || "").toLowerCase();
    type Pool = string[];
    const pools: Record<string, Pool> = {
      shawarma: [
        "photo-1561651823-34feb02250e4", // shawarma wrap
        "photo-1633321702518-7feccafb94d5", // mediterranean platter
        "photo-1599487488170-d11ec9c172f0", // grilled meat
        "photo-1529006557810-274b9b2fc783", // kebab plate
      ],
      indian: [
        "photo-1563379091339-03b21ab4a4f8", // biryani
        "photo-1631452180519-c014fe946bc7", // indian curry
        "photo-1601050690597-df0568f70950", // tikka
        "photo-1585937421612-70a008356fbe", // butter chicken
      ],
      mexican: [
        "photo-1565299585323-38d6b0865b47", // tacos
        "photo-1551504734-5ee1c4a1479b", // burritos
        "photo-1599974579688-8dbdd335c77f", // mexican plate
      ],
      asian: [
        "photo-1552611052-33e04de081de", // noodles
        "photo-1585032226651-759b368d7246", // dumplings
        "photo-1617093727343-374698b1b08d", // chinese food
      ],
      thai: [
        "photo-1559314809-0d155014e29e", // pad thai
        "photo-1562565652-a0d8f0c59eb4", // thai curry
      ],
      persian: [
        "photo-1547573854-74d2a71d0826", // kebab
        "photo-1544025162-d76694265947", // grilled meats
      ],
      yemeni: [
        "photo-1596797038530-2c107229654b", // mandi rice
        "photo-1604908176997-125f25cc6f3d", // arabic platter
      ],
      sushi: [
        "photo-1579871494447-9811cf80d66c", // sushi
        "photo-1553621042-f6e147245754", // ramen
      ],
      korean: [
        "photo-1583224994076-ae3f8b4b25d0", // korean bbq
        "photo-1632778149955-e80f8ceca2e8", // bibimbap
      ],
      southern: [
        "photo-1626082927389-6cd097cdc6ec", // fried chicken
        "photo-1562967914-608f82629710", // soul food
      ],
      turkish: [
        "photo-1561626423-a51b45aef0a1", // turkish kebab
        "photo-1599050751795-6cdaafbc2319", // doner
      ],
      coffee: [
        "photo-1495474472287-4d71bcdd2085", // coffee shop
        "photo-1497935586351-b67a49e012bf", // latte
      ],
      fast: [
        "photo-1568901346375-23c9450c58cd", // burger
        "photo-1576107232684-1279f390859f", // fries
      ],
      halal: [
        "photo-1544025162-d76694265947", // grilled meats
        "photo-1633321702518-7feccafb94d5", // halal platter
      ],
      default: [
        "photo-1517248135467-4c7edcad34c4", // restaurant table
        "photo-1555396273-367ea4eb4db5", // food spread
        "photo-1414235077428-338989a2e8c0", // dining
        "photo-1504674900247-0877df9cc836", // plated dish
      ],
    };
    let pool = pools.default;
    if (c.includes("shawarma") || c.includes("mediterranean") || c.includes("arab"))
      pool = pools.shawarma;
    else if (c.includes("indian") || c.includes("biryani") || c.includes("pakistani"))
      pool = pools.indian;
    else if (c.includes("mexican")) pool = pools.mexican;
    else if (c.includes("chinese") || c.includes("asian")) pool = pools.asian;
    else if (c.includes("thai")) pool = pools.thai;
    else if (c.includes("persian")) pool = pools.persian;
    else if (c.includes("yemeni")) pool = pools.yemeni;
    else if (c.includes("japanese") || c.includes("sushi")) pool = pools.sushi;
    else if (c.includes("korean")) pool = pools.korean;
    else if (c.includes("southern")) pool = pools.southern;
    else if (c.includes("turkish") || c.includes("istanbul")) pool = pools.turkish;
    else if (c.includes("coffee") || c.includes("cafe")) pool = pools.coffee;
    else if (c.includes("fast")) pool = pools.fast;
    else if (c.includes("halal")) pool = pools.halal;
    // Deterministic pick from the pool based on the restaurant name.
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const id = pool[hash % pool.length];
    return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;
  }, [name, cuisine]);

  const imageUrl = googlePhoto && !errored
    ? googlePhoto
    : logoUrl && !errored
      ? logoUrl
      : fallbackUrl;
  const isRealPhoto = !!(googlePhoto || logoUrl);

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
      {!isRealPhoto && (
        <span
          className={`absolute bottom-2 right-2 ${emojiSize} drop-shadow-lg pointer-events-none`}
        >
          {emoji}
        </span>
      )}
    </div>
  );
}
