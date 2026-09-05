"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";

export default function ApproveAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm("すべての候補を承認しますか？（毛玉化に注意：一括承認は厳選された候補だけで使ってください）")) return;
        setBusy(true);
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve_all" }),
        });
        setBusy(false);
        if (res.ok) {
          const r = await res.json();
          alert(`${r.approved} 件を承認しました`);
          router.refresh();
        }
      }}
      className="flex items-center gap-1.5 rounded-lg border border-[#ddd5c7] px-3 py-1.5 text-sm hover:bg-[#faf7f1] disabled:opacity-50"
    >
      <CheckCheck size={14} /> {busy ? "承認中…" : "すべて承認"}
    </button>
  );
}
