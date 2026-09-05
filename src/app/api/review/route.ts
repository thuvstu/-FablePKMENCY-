import { getDueQueue, submitReview } from "@/lib/srs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getDueQueue());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.cardId !== "number" || typeof body.grade !== "number") {
    return Response.json({ error: "cardId and grade required" }, { status: 400 });
  }
  const result = await submitReview(body.cardId, body.grade);
  return Response.json(result);
}
