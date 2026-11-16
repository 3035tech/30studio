import "server-only";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { organization } from "@/lib/db/auth-schema";

export async function getOrganizationSettings(organizationId: string) {
  const [row] = await getDatabase()
    .select({ id: organization.id, name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return row ?? null;
}
