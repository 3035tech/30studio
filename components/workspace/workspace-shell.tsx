"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Building2, CalendarDays, ChevronDown, ChevronRight, ClipboardCheck, LayoutDashboard, Link2, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Radar, UserRound, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SelectField } from "@/components/ui/field";
import { NotificationCenter } from "@/components/workspace/notification-center";
import { Link } from "@/lib/i18n/routing";
import { BRAND_ASSETS, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, type Locale } from "@/lib/constants";

type WorkspaceOrganization = { id: string; name: string };
type WorkspaceSection = "overview" | "calendar" | "approvals" | "analytics" | "competitors" | "brands" | "connections" | "team" | "profile";
type NavigationGroupId = "workspace" | "planning" | "management";

type WorkspaceShellProps = {
  children: ReactNode;
  organizations: readonly WorkspaceOrganization[];
  activeOrganizationId: string;
  userEmail: string;
  nextLocale: Locale;
  busy: boolean;
  canCreateContent: boolean;
  onOrganizationChange: (organizationId: string) => void;
  onSignOut: () => void;
};

export function WorkspaceShell({
  children,
  organizations,
  activeOrganizationId,
  userEmail,
  nextLocale,
  busy,
  canCreateContent,
  onOrganizationChange,
  onSignOut,
}: WorkspaceShellProps) {
  const tNavigation = useTranslations("navigation");
  const tWorkspace = useTranslations("workspace");
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const [collapsedGroups, setCollapsedGroups] = useState<Partial<Record<NavigationGroupId, boolean>>>({});
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(false);
  const languageLabel = nextLocale === "en" ? tNavigation("english") : tNavigation("portuguese");
  const sections = [
    { id: "overview" as const, href: WORKSPACE_SECTION_IDS.overview, icon: LayoutDashboard, label: tNavigation("overview") },
    { id: "calendar" as const, href: WORKSPACE_SECTION_IDS.calendar, icon: CalendarDays, label: tNavigation("calendar") },
    { id: "approvals" as const, href: WORKSPACE_SECTION_IDS.approvals, icon: ClipboardCheck, label: tNavigation("approvals") },
    { id: "analytics" as const, href: WORKSPACE_SECTION_IDS.analytics, icon: BarChart3, label: tNavigation("analytics") },
    { id: "competitors" as const, href: WORKSPACE_SECTION_IDS.competitors, icon: Radar, label: tNavigation("competitors") },
    { id: "brands" as const, href: WORKSPACE_SECTION_IDS.brands, icon: Building2, label: tNavigation("brands") },
    { id: "connections" as const, href: WORKSPACE_SECTION_IDS.connections, icon: Link2, label: tNavigation("connections") },
    { id: "team" as const, href: WORKSPACE_SECTION_IDS.team, icon: UsersRound, label: tNavigation("team") },
    { id: "profile" as const, href: WORKSPACE_SECTION_IDS.profile, icon: UserRound, label: tNavigation("profile") },
  ];
  const navigationGroups = [
    { id: "workspace" as const, icon: LayoutDashboard, sections: [sections[0]] },
    { id: "planning" as const, icon: CalendarDays, sections: [sections[1], sections[2], sections[3], sections[4]] },
    { id: "management" as const, icon: Building2, sections: [sections[5], sections[6], sections[7]] },
  ];
  const currentSection = sections.find((section) => section.id === activeSection) ?? sections[0];
  const currentGroup = navigationGroups.find(({ sections: groupSections }) => groupSections.some((section) => section.id === activeSection))
    ?? navigationGroups.find(({ id }) => id === "management");

  useEffect(() => {
    function syncActiveSection() {
      const sectionId = window.location.hash.slice(1);
      setActiveSection(sectionId === WORKSPACE_SECTION_IDS.calendar ? "calendar" : sectionId === WORKSPACE_SECTION_IDS.approvals ? "approvals" : sectionId === WORKSPACE_SECTION_IDS.analytics ? "analytics" : sectionId === WORKSPACE_SECTION_IDS.competitors ? "competitors" : sectionId === WORKSPACE_SECTION_IDS.brands ? "brands" : sectionId === WORKSPACE_SECTION_IDS.connections ? "connections" : sectionId === WORKSPACE_SECTION_IDS.team ? "team" : sectionId === WORKSPACE_SECTION_IDS.profile ? "profile" : "overview");
    }

    window.addEventListener("hashchange", syncActiveSection);
    syncActiveSection();
    return () => window.removeEventListener("hashchange", syncActiveSection);
  }, []);

  return (
    <div className="workspaceShell">
      <div className={`workspaceLayout${isNavigationCollapsed ? " is-navigation-collapsed" : ""}`}>
        <aside className={`workspaceSidebar${isNavigationCollapsed ? " is-collapsed" : ""}`}>
          <nav className="workspaceNavigation" aria-label={tNavigation("workspaceNavigation")}>
            <div className="workspaceNavigation__header">
              <Link className="workspaceNavigation__brand" href={`#${WORKSPACE_SECTION_IDS.overview}`} aria-label={tWorkspace("title")} title={tWorkspace("title")}>
                <BrandLogo />
                <Image className="workspaceNavigation__brandIcon" src={BRAND_ASSETS.icon32} width={36} height={36} alt="" priority />
              </Link>
              <Button appearance="quiet" className="workspaceNavigation__collapse" type="button" aria-label={tNavigation(isNavigationCollapsed ? "expandNavigation" : "collapseNavigation")} aria-expanded={!isNavigationCollapsed} title={tNavigation(isNavigationCollapsed ? "expandNavigation" : "collapseNavigation")} onClick={() => setIsNavigationCollapsed((collapsed) => !collapsed)}>
                {isNavigationCollapsed ? <PanelLeftOpen aria-hidden="true" size={18} /> : <PanelLeftClose aria-hidden="true" size={18} />}
              </Button>
            </div>
            <Button className="workspaceNavigation__create" type="button" aria-label={tNavigation("createContent")} disabled={!canCreateContent} title={!canCreateContent ? tNavigation("createContentUnavailable") : tNavigation("createContent")} onClick={() => { setActiveSection("calendar"); window.location.hash = WORKSPACE_SECTION_IDS.calendar; window.dispatchEvent(new Event(WORKSPACE_UI_EVENTS.createContent)); }}>
              <Plus aria-hidden="true" size={17} /><span>{tNavigation("createContent")}</span>
            </Button>
            <div className="workspaceNavigation__groups">
              {navigationGroups.map(({ id, sections: groupSections }) => (
                <section className="workspaceNavigation__group" key={id} aria-labelledby={`workspace-navigation-${id}`}>
                  <h2 className="workspaceNavigation__groupTitle" id={`workspace-navigation-${id}`}>
                    <Button
                      appearance="quiet"
                      className="workspaceNavigation__groupToggle"
                      type="button"
                      aria-expanded={!collapsedGroups[id]}
                      aria-controls={`workspace-navigation-links-${id}`}
                      onClick={() => setCollapsedGroups((current) => ({ ...current, [id]: !current[id] }))}
                    >
                      <span>{tNavigation(id)}</span>
                      <ChevronDown aria-hidden="true" className={collapsedGroups[id] ? "workspaceNavigation__groupChevron is-collapsed" : "workspaceNavigation__groupChevron"} size={15} />
                    </Button>
                  </h2>
                  <div className="workspaceNavigation__groupLinks" id={`workspace-navigation-links-${id}`} hidden={collapsedGroups[id] && !isNavigationCollapsed}>
                    {groupSections.map(({ id: sectionId, href, icon: Icon, label }) => (
                      <a
                        className={activeSection === sectionId ? "workspaceNavigation__link is-active" : "workspaceNavigation__link"}
                        href={`#${href}`}
                        key={sectionId}
                        aria-label={label}
                        aria-current={activeSection === sectionId ? "location" : undefined}
                        title={label}
                      >
                        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                        <span>{label}</span>
                      </a>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <footer className="workspaceNavigation__footer">
              <span className="workspaceNavigation__email" title={userEmail}>{userEmail}</span>
              <a
                className={activeSection === "profile" ? "workspaceNavigation__link is-active" : "workspaceNavigation__link"}
                href={`#${WORKSPACE_SECTION_IDS.profile}`}
                aria-label={tNavigation("profile")}
                aria-current={activeSection === "profile" ? "location" : undefined}
                title={tNavigation("profile")}
              >
                <UserRound aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{tNavigation("profile")}</span>
              </a>
              <Button appearance="quiet" className="workspaceNavigation__signOut" type="button" aria-label={tWorkspace("signOut")} title={tWorkspace("signOut")} onClick={onSignOut} disabled={busy}>
                <LogOut aria-hidden="true" size={17} /><span>{tWorkspace("signOut")}</span>
              </Button>
            </footer>
          </nav>
        </aside>

        <div className="workspaceMain">
          <header className="workspaceHeader">
            <div className="workspaceHeaderActions">
              <NotificationCenter />
              <SelectField
                id="organization"
                label={tWorkspace("switchOrganization")}
                value={activeOrganizationId}
                onChange={(event) => onOrganizationChange(event.target.value)}
                disabled={busy}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </SelectField>
              <Link className="localeLink" href="/" locale={nextLocale} aria-label={tNavigation("switchLanguage")}>
                {languageLabel}
              </Link>
            </div>
          </header>
          <div className="workspaceFrame" id="workspace">
            <nav className="workspaceBreadcrumbs" aria-label={tNavigation("breadcrumbs")}>
              <ol>
                <li>
                  <a href={`#${WORKSPACE_SECTION_IDS.overview}`}>{tNavigation("workspaceRoot")}</a>
                </li>
                {currentSection.id !== "overview" && currentGroup ? (
                  <>
                    <li className="workspaceBreadcrumbs__separator" aria-hidden="true"><ChevronRight size={14} /></li>
                    <li className="workspaceBreadcrumbs__parent">{tNavigation(currentGroup.id)}</li>
                  </>
                ) : null}
                <li className="workspaceBreadcrumbs__separator" aria-hidden="true"><ChevronRight size={14} /></li>
                <li aria-current="page">{currentSection.label}</li>
              </ol>
            </nav>
            <main className="workspaceContent" data-active-section={activeSection}>{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
