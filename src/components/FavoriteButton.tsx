"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star } from "lucide-react";

export default function FavoriteButton({ id, initial }: { id: number; initial: boolean }) {
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      title={fav ? "お気に入り解除" : "お気に入りに追加"}
      onClick={async () => {
        setBusy(true);
        const next = !fav;
        setFav(next);
        await fetch(`/api/cards/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: next }),
        });
        setBusy(false);
        router.refresh();
      }}
      className={`rounded-md border px-2 py-1 transition ${
        fav ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#ddd5c7] text-stone-400 hover:border-amber-300 hover:text-amber-500"
      }`}
    >
      <Star size={15} className={fav ? "fill-amber-400" : ""} />
    </button>
  );
}
