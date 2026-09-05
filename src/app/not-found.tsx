import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">404</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">この項目はまだ存在しません</h1>
      <p className="mt-3 text-stone-600">百科事典のこのページはまだ書かれていません。</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="rounded-md border border-[#ddd5c7] bg-white px-4 py-2 text-sm hover:bg-[#faf7f1]">
          索引に戻る
        </Link>
        <Link href="/new" className="rounded-md bg-[#b4532a] px-4 py-2 text-sm text-white hover:bg-[#9a4522]">
          執筆する
        </Link>
      </div>
    </main>
  );
}
