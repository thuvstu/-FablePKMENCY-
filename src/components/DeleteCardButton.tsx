"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteCardButton({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Delete “${title}”? Links pointing here will become red links.`)) return;
        setBusy(true);
        await fetch(`/api/cards/${id}`, { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
      className="rounded-md border border-transparent px-3 py-1 text-sm text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
