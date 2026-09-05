import { importAll } from "@/lib/portable";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body === null) return Response.json({ error: "JSON body required" }, { status: 400 });
  const result = await importAll(body);
  return Response.json(result);
}
