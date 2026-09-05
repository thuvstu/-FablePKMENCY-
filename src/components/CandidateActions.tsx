"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X } from "lucide-react";

export default function CandidateActions({ id, compact = false }: { id: number; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    await fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setDone(action === "approve" ? "approved" : "rejected");
    setBusy(null);
    router.refresh();
  }

  if (done) {
    return (
      <span className={`text-xs ${done === "approved" ? "text-emerald-600" : "text-stone-400"}`}>
        {done === "approved" ? "承認しました" : "却下しました（再提案なし）"}
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        disabled={busy !== null}
        onClick={() => act("approve")}
        title="承認してリンクに昇格"
        className={`flex items-center gap-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 ${
          compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
        }`}
      >
        <Check size={12} /> {busy === "approve" ? "…" : "承認"}
      </button>
      <button
        disabled={busy !== null}
        onClick={() => act("reject")}
        title="却下（再提案しない）"
        className={`flex items-center gap-1 rounded-md border border-[#ddd5c7] text-stone-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 ${
          compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
        }`}
      >
        <X size={12} /> {busy === "reject" ? "…" : "却下"}
      </button>
    </span>
  );
}
