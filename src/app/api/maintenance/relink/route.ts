import { relinkAll } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function POST() {
  const count = await relinkAll();
  return Response.json({ ok: true, relinked: count });
}
