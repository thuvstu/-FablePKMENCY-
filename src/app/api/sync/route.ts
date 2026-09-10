import { syncStatus } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await syncStatus());
}
