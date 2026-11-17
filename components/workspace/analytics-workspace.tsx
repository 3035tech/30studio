"use client";

import { PublicationAnalytics } from "@/components/workspace/publication-analytics";
import { WORKSPACE_SECTION_IDS, type DashboardFilters } from "@/lib/constants";

type AnalyticsWorkspaceProps = {
  filters: DashboardFilters;
  organizationId: string;
  userId: string;
  onOpenConnection: (brandId: string) => void;
};

export function AnalyticsWorkspace({ filters, organizationId, userId, onOpenConnection }: AnalyticsWorkspaceProps) {
  return (
    <section className="analyticsWorkspace" id={WORKSPACE_SECTION_IDS.analytics}>
      <PublicationAnalytics organizationId={organizationId} userId={userId} filters={filters} onOpenConnection={onOpenConnection} />
    </section>
  );
}
