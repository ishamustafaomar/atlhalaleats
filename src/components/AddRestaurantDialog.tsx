import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Navigation, Loader2, Check } from "lucide-react";

export function AddRestaurantDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const captureLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't supported on this device.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocLoading(false);
        toast.success("Location captured.");
      },
      (err) => {
        setLocLoading(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const reset = () => {
    setName("");
    setCuisine("");
    setNote("");
    setAddress("");
    setCoords(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("restaurants").insert({
      name: name.trim(),
      cuisine: cuisine.trim() || "Halal restaurant",
      note: note.trim() || null,
      address: address.trim() || null,
      latitude: coords?.lat ?? null,
      longitude: coords?.lon ?? null,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Restaurant added");
    reset();
    onOpenChange(false);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add a halal restaurant</DialogTitle>
          <DialogDescription>
            Help the community discover new spots in Atlanta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cuisine">Cuisine</Label>
            <Input
              id="cuisine"
              placeholder="e.g. Mediterranean, Pakistani, Mexican…"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              placeholder="e.g. 123 Buford Hwy NE, Atlanta, GA"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <Label>Location</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={captureLocation}
                disabled={locLoading}
                className="rounded-xl"
              >
                {locLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : coords ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <Navigation className="size-4" />
                )}
                {coords ? "Location captured" : "Use my current location"}
              </Button>
              {coords && (
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  clear
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Tap this while you're at the restaurant to pin it on the map.
            </p>
          </div>
          <div>
            <Label htmlFor="note">Halal note (optional)</Label>
            <Textarea
              id="note"
              placeholder="e.g. Halal chicken only, ask for halal options…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Adding…" : "Add restaurant"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
