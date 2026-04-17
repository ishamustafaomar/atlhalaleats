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
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("restaurants").insert({
      name: name.trim(),
      cuisine: cuisine.trim() || "Halal restaurant",
      note: note.trim() || null,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Restaurant added");
    setName("");
    setCuisine("");
    setNote("");
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
