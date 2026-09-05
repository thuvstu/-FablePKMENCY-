import { approveCandidate, countPendingCandidates, listCandidates, rejectCandidate } from "@/lib/cards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const [items, count] = await Promise.all([listCandidates(status), countPendingCandidates()]);
  return Response.json({ items, count });
}

/** { id, action: "approve" | "reject" } | { action: "approve_all" } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "approve_all") {
    const pending = await listCandidates("pending");
    let approved = 0;
    for (const p of pending) {
      const c = await approveCandidate(p.id);
      if (c) approved++;
    }
    return Response.json({ ok: true, approved });
  }

  if (typeof body.id !== "number" || (body.action !== "approve" && body.action !== "reject")) {
    return Response.json({ error: "id and action (approve|reject) required" }, { status: 400 });
  }

  if (body.action === "approve") {
    const c = await approveCandidate(body.id);
    if (!c) return Response.json({ error: "Not found or not pending" }, { status: 404 });
    return Response.json({ ok: true });
  }

  await rejectCandidate(body.id);
  return Response.json({ ok: true });
}
