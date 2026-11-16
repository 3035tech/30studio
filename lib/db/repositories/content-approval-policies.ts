import "server-only";
import { and, eq } from "drizzle-orm";
import { CONTENT_APPROVAL_POLICY } from "@/lib/constants";
import { getDatabase } from "@/lib/db/client";
import { brands, contentApprovalPolicies } from "@/lib/db/schema";

export async function listContentApprovalPolicies(organizationId: string) {
  const rows = await getDatabase().select({ id: contentApprovalPolicies.id, scopeKey: contentApprovalPolicies.scopeKey, brandId: contentApprovalPolicies.brandId, brandName: brands.name, requiredApprovals: contentApprovalPolicies.requiredApprovals, updatedAt: contentApprovalPolicies.updatedAt })
    .from(contentApprovalPolicies).leftJoin(brands, and(eq(brands.organizationId, contentApprovalPolicies.organizationId), eq(brands.id, contentApprovalPolicies.brandId)))
    .where(eq(contentApprovalPolicies.organizationId, organizationId));
  const organizationPolicy = rows.find((row) => row.scopeKey === CONTENT_APPROVAL_POLICY.defaultScopeKey);
  return {
    defaultRequiredApprovals: organizationPolicy?.requiredApprovals ?? CONTENT_APPROVAL_POLICY.defaultRequiredApprovals,
    brandOverrides: rows.filter((row) => row.brandId !== null).map((row) => ({ brandId: row.brandId!, brandName: row.brandName ?? "", requiredApprovals: row.requiredApprovals })),
  };
}

export async function saveContentApprovalPolicy(organizationId: string, userId: string, brandId: string | null, requiredApprovals: number) {
  const database = getDatabase();
  const scopeKey = brandId ? `${CONTENT_APPROVAL_POLICY.brandScopePrefix}${brandId}` : CONTENT_APPROVAL_POLICY.defaultScopeKey;
  if (brandId) {
    const [brand] = await database.select({ id: brands.id }).from(brands).where(and(eq(brands.organizationId, organizationId), eq(brands.id, brandId), eq(brands.isActive, true))).limit(1);
    if (!brand) return false;
  }
  await database.insert(contentApprovalPolicies).values({ organizationId, updatedBy: userId, brandId, scopeKey, requiredApprovals })
    .onConflictDoUpdate({ target: [contentApprovalPolicies.organizationId, contentApprovalPolicies.scopeKey], set: { brandId, requiredApprovals, updatedBy: userId, updatedAt: new Date() } });
  return true;
}

export async function deleteBrandApprovalPolicy(organizationId: string, brandId: string) {
  await getDatabase().delete(contentApprovalPolicies).where(and(eq(contentApprovalPolicies.organizationId, organizationId), eq(contentApprovalPolicies.brandId, brandId)));
}
