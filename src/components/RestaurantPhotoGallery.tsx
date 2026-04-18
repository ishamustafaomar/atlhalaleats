import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  name: string;
  photos: string[];
};

/** Photo gallery with a hero + thumbnail strip. Click any photo to open a lightbox. */
export function RestaurantPhotoGallery({ name, photos }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!photos.length) return null;

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  const hero = photos[0];
  const thumbs = photos.slice(1, 5);
  const extra = photos.length - 5;

  return (
    <>
      <section className="mt-6 grid grid-cols-4 gap-2 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="col-span-4 sm:col-span-2 row-span-2 aspect-[4/3] sm:aspect-auto sm:h-80 relative group"
          aria-label={`Open ${name} photo 1`}
        >
          <img
            src={hero}
            alt={`${name} photo 1`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        {thumbs.map((src, i) => {
          const idx = i + 1;
          const isLast = i === thumbs.length - 1 && extra > 0;
          return (
            <button
              key={src}
              type="button"
              onClick={() => openAt(idx)}
              className="hidden sm:block col-span-1 h-[154px] relative group overflow-hidden"
              aria-label={`Open ${name} photo ${idx + 1}`}
            >
              <img
                src={src}
                alt={`${name} photo ${idx + 1}`}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              {isLast && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-display font-bold text-lg">
                  +{extra} more
                </div>
              )}
            </button>
          );
        })}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-0 bg-black/95 border-0">
          <div className="relative aspect-video w-full">
            <img
              src={photos[index]}
              alt={`${name} photo ${index + 1}`}
              className="size-full object-contain"
            />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 size-9 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            {photos.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center"
                  aria-label="Next photo"
                >
                  <ChevronRight className="size-6" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-2 py-1 rounded-full">
                  {index + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
