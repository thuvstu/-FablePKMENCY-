"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewBoardForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#1f1b16] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black"
      >
        + 新しいホワイトボード
      </button>
    );
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-[#e6e0d4] bg-white p-3 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        const res = await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        setBusy(false);
        if (res.ok) {
          const b = await res.json();
          router.push(`/boards/${b.id}`);
        }
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ボード名 — 問いから始めるのがおすすめ"
        className="rounded-md border border-[#ddd5c7] px-3 py-2 text-sm outline-none focus:border-[#b4532a]"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="説明（任意）"
        className="rounded-md border border-[#ddd5c7] px-3 py-2 text-sm outline-none focus:border-[#b4532a]"
      />
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-md bg-[#b4532a] px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {busy ? "作成中…" : "作成"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-[#ece6da]">
          キャンセル
        </button>
      </div>
    </form>
  );
}
