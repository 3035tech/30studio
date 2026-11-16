"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CompetitorIntelligence } from "@/components/workspace/competitor-intelligence";
import { PublicationAnalytics } from "@/components/workspace/publication-analytics";
import { WORKSPACE_SECTION_IDS, type DashboardFilters } from "@/lib/constants";
import type { BrandListItem } from "@/lib/validation/brands";

type AnalyticsTab = "publications" | "competitors";

type AnalyticsWorkspaceProps = {
  filters: DashboardFilters;
  organizationId: string;
  userId: string;
  brands: BrandListItem[];
  onBrandChange: (brandId: string) => void;
  onOpenConnection: (brandId: string) => void;
};

const ANALYTICS_TABS = ["publications", "competitors"] as const;

export function AnalyticsWorkspace({ filters, organizationId, userId, brands, onBrandChange, onOpenConnection }: AnalyticsWorkspaceProps) {
  const t = useTranslations("analytics");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("publications");
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function resetOverviewTab() {
      if (!window.location.hash || window.location.hash === `#${WORKSPACE_SECTION_IDS.overview}`) setActiveTab("publications");
    }

    window.addEventListener("hashchange", resetOverviewTab);
    resetOverviewTab();
    return () => window.removeEventListener("hashchange", resetOverviewTab);
  }, []);

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = ANALYTICS_TABS.indexOf(activeTab);
    const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % ANALYTICS_TABS.length
      : event.key === "ArrowLeft" ? (currentIndex + ANALYTICS_TABS.length - 1) % ANALYTICS_TABS.length
        : event.key === "Home" ? 0
          : event.key === "End" ? ANALYTICS_TABS.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = ANALYTICS_TABS[nextIndex];
    setActiveTab(nextTab);
    tabListRef.current?.querySelector<HTMLButtonElement>(`#analytics-tab-${nextTab}`)?.focus();
  }

  return (
    <section className="analyticsWorkspace" id={WORKSPACE_SECTION_IDS.analytics} aria-label={t("tabs.label")}>
      <div className="analyticsWorkspace__tabList" role="tablist" aria-label={t("tabs.label")} onKeyDown={handleTabKeyDown} ref={tabListRef}>
        {ANALYTICS_TABS.map((tab) => (
          <Button
            appearance="quiet"
            className={`analyticsWorkspace__tab${activeTab === tab ? " is-selected" : ""}`}
            id={`analytics-tab-${tab}`}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`analytics-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
          >
            {t(`tabs.${tab}`)}
          </Button>
        ))}
      </div>

      <div className="analyticsWorkspace__panels">
        <section
          className="analyticsWorkspace__panel"
          id="analytics-panel-publications"
          role="tabpanel"
          aria-labelledby="analytics-tab-publications"
          tabIndex={0}
          hidden={activeTab !== "publications"}
        >
          <PublicationAnalytics
            organizationId={organizationId}
            userId={userId}
            filters={filters}
            onOpenConnection={onOpenConnection}
          />
        </section>
        <section
          className="analyticsWorkspace__panel"
          id="analytics-panel-competitors"
          role="tabpanel"
          aria-labelledby="analytics-tab-competitors"
          tabIndex={0}
          hidden={activeTab !== "competitors"}
        >
          <CompetitorIntelligence
            brands={brands}
            selectedBrandId={filters.brandId}
            onBrandChange={onBrandChange}
          />
        </section>
      </div>
    </section>
  );
}
