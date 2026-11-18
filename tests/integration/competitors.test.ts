import assert from "node:assert/strict";
import { after, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { claimCompetitorAnalysisBatch, claimDueCompetitorSource, completeCompetitorAnalysis, completeCompetitorFetch, createCompetitorSource, listCompetitorSources } from "@/lib/db/repositories/competitors";
import { closeDatabase, getDatabase } from "@/lib/db/client";
import { competitorObservations, organization, user } from "@/lib/db/schema";
import { createBrand } from "@/lib/db/repositories/brands";

const ids = {
  user: `competitor-test-user-${crypto.randomUUID()}`,
  organizationA: `competitor-test-org-a-${crypto.randomUUID()}`,
  organizationB: `competitor-test-org-b-${crypto.randomUUID()}`,
} as const;

let usersCreated = false;
let organizationsCreated = false;

after(async () => {
  const database = getDatabase();
  try {
    if (organizationsCreated) await database.delete(organization).where(inArray(organization.id, [ids.organizationA, ids.organizationB]));
    if (usersCreated) await database.delete(user).where(eq(user.id, ids.user));
  } finally {
    await closeDatabase();
  }
});

test("competitor observations persist through background collection and analysis within their tenant", async () => {
  const database = getDatabase();
  const now = new Date();
  await database.insert(user).values({
    id: ids.user,
    name: "Competitor integration test",
    email: `${ids.user}@example.invalid`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  usersCreated = true;
  await database.insert(organization).values([
    { id: ids.organizationA, name: "Competitor tenant A", slug: ids.organizationA, createdAt: now },
    { id: ids.organizationB, name: "Competitor tenant B", slug: ids.organizationB, createdAt: now },
  ]);
  organizationsCreated = true;

  const brandA = await createBrand({ name: "Competitor brand A", industry: "technology" }, ids.organizationA, ids.user);
  const brandB = await createBrand({ name: "Competitor brand B" }, ids.organizationB, ids.user);
  assert.ok(brandA);
  assert.ok(brandB);

  const source = await createCompetitorSource(ids.organizationA, brandA.id, ids.user, {
    name: "Public industry feed",
    feedUrl: "https://example.invalid/updates.xml",
  });
  assert.equal(source.kind, "created");
  if (source.kind !== "created") return;

  const queued = await listCompetitorSources(ids.organizationA, brandA.id);
  assert.equal(queued?.sources.length, 1);
  assert.equal(queued?.sources[0]?.observations.length, 0);
  assert.equal((await listCompetitorSources(ids.organizationB, brandB.id))?.sources.length, 0);

  const claimedSource = await claimDueCompetitorSource();
  assert.ok(claimedSource);
  assert.equal(claimedSource.id, source.id);
  await completeCompetitorFetch(claimedSource, [{
    externalId: "industry-update-1",
    title: "A new industry update",
    summary: "A bounded public summary.",
    sourceUrl: "https://example.invalid/updates/1",
    contentPublishedAt: now,
  }], { etag: "test-etag", lastModified: null });

  const [storedObservation] = await database.select().from(competitorObservations).where(and(
    eq(competitorObservations.organizationId, ids.organizationA),
    eq(competitorObservations.brandId, brandA.id),
    eq(competitorObservations.sourceId, source.id),
  ));
  assert.ok(storedObservation);
  assert.equal(storedObservation.title, "A new industry update");
  assert.equal(storedObservation.analysisStatus, "pending");
  await database.update(competitorObservations).set({ analysisNextAttemptAt: new Date(Date.now() - 1_000) }).where(and(
    eq(competitorObservations.organizationId, ids.organizationA),
    eq(competitorObservations.brandId, brandA.id),
    eq(competitorObservations.id, storedObservation.id),
  ));

  const analysisJobs = await claimCompetitorAnalysisBatch();
  assert.equal(analysisJobs.length, 1);
  assert.equal(analysisJobs[0]?.id, storedObservation.id);
  await completeCompetitorAnalysis(analysisJobs, "integration-model", [{
    observationId: storedObservation.id,
    topic: "industry_news",
    observedPatternEn: "The source covers an industry change.",
    observedPatternPt: "A fonte aborda uma mudança no setor.",
    editorialOpportunityEn: "Explain how the change affects customers.",
    editorialOpportunityPt: "Explique como a mudança afeta clientes.",
  }]);

  const finalState = await listCompetitorSources(ids.organizationA, brandA.id);
  assert.equal(finalState?.sources[0]?.observations[0]?.analysisStatus, "ready");
  assert.equal(finalState?.sources[0]?.observations[0]?.analysis?.topic, "industry_news");
  assert.equal((await listCompetitorSources(ids.organizationB, brandB.id))?.sources.length, 0);
});
