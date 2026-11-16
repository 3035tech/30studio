import { WorkspaceEntry } from "@/components/workspace/workspace-entry";

export default async function LocaleHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const socialConnectionResult = typeof query.social_connection === "string" ? query.social_connection : null;
  const socialConnectionBrandId = typeof query.brand === "string" ? query.brand : null;
  return <WorkspaceEntry socialConnectionResult={socialConnectionResult} socialConnectionBrandId={socialConnectionBrandId} />;
}
