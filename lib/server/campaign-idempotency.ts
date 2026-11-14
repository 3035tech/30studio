import "server-only";
import { createHash } from "node:crypto";
import type { CalendarCampaignCreateInput } from "@/lib/validation/calendar";

export function getCampaignRequestFingerprint(input: Omit<CalendarCampaignCreateInput, "idempotencyKey">) {
  const canonicalRequest = {
    ...input,
    publications: [...input.publications].sort((left, right) => left.platform.localeCompare(right.platform)),
  };
  return createHash("sha256").update(JSON.stringify(canonicalRequest)).digest("hex");
}
