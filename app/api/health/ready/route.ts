import { NextResponse } from "next/server";
import { user } from "@/lib/db/schema";
import { getDatabase } from "@/lib/db/client";
import { logOperationalError } from "@/lib/server/operational-logger";

export async function GET(request: Request) {
  try {
    await getDatabase().select({ id: user.id }).from(user).limit(1);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logOperationalError("health.readiness_check_failed", error, { method: request.method, path: new URL(request.url).pathname });
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
