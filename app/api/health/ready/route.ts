import { NextResponse } from "next/server";
import { user } from "@/lib/db/schema";
import { getDatabase } from "@/lib/db/client";

export async function GET() {
  try {
    await getDatabase().select({ id: user.id }).from(user).limit(1);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
