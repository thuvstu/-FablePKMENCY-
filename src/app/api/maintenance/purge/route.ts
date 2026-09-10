import { purgeTombstones } from "@/lib/cards";

export const dynamic = "force-dynamic";

/** Hard-delete tombstones. Only safe once every replica has pulled them. */
export async function POST() {
  const purged = await purgeTombstones();
  return Response.json({ ok: true, purged });
}
