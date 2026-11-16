"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Building2, CalendarDays, ChevronDown, ChevronRight, ClipboardCheck, LayoutDashboard, LogOut, Plus, UserRound, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SelectField } from "@/components/ui/field";
import { Link } from "@/lib/i18n/routing";
import { BRAND_ASSETS, WORKSPACE_SECTION_IDS, WORKSPACE_UI_EVENTS, type Locale } from "@/lib/constants";

type WorkspaceOrganization = { id: string; name: string };
type WorkspaceSection = "overview" | "calendar" | "approvals" | "analytics" | "brands" | "team" | "profile";
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
  const languageLabel = nextLocale === "en" ? tNavigation("english") : tNavigation("portuguese");
  const sections = [
    { id: "overview" as const, href: WORKSPACE_SECTION_IDS.overview, icon: LayoutDashboard, label: tNavigation("overview") },
    { id: "calendar" as const, href: WORKSPACE_SECTION_IDS.calendar, icon: CalendarDays, label: tNavigation("calendar") },
    { id: "approvals" as const, href: WORKSPACE_SECTION_IDS.approvals, icon: ClipboardCheck, label: tNavigation("approvals") },
    { id: "analytics" as const, href: WORKSPACE_SECTION_IDS.analytics, icon: BarChart3, label: tNavigation("analytics") },
    { id: "brands" as const, href: WORKSPACE_SECTION_IDS.brands, icon: Building2, label: tNavigation("brands") },
    { id: "team" as const, href: WORKSPACE_SECTION_IDS.team, icon: UsersRound, label: tNavigation("team") },
    { id: "profile" as const, href: WORKSPACE_SECTION_IDS.profile, icon: UserRound, label: tNavigation("profile") },
  ];
  const navigationGroups = [
    { id: "workspace" as const, icon: LayoutDashboard, sections: [sections[0]] },
    { id: "planning" as const, icon: CalendarDays, sections: [sections[1], sections[2], sections[3]] },
    { id: "management" as const, icon: Building2, sections: [sections[4], sections[5]] },
  ];
  const currentSection = sections.find((section) => section.id === activeSection) ?? sections[0];
  const currentGroup = navigationGroups.find(({ sections: groupSections }) => groupSections.some((section) => section.id === activeSection))
    ?? navigationGroups.find(({ id }) => id === "management");

  useEffect(() => {
    function syncActiveSection() {
      const sectionId = window.location.hash.slice(1);
      setActiveSection(sectionId === WORKSPACE_SECTION_IDS.calendar ? "calendar" : sectionId === WORKSPACE_SECTION_IDS.approvals ? "approvals" : sectionId === WORKSPACE_SECTION_IDS.analytics ? "analytics" : sectionId === WORKSPACE_SECTION_IDS.brands ? "brands" : sectionId === WORKSPACE_SECTION_IDS.team ? "team" : sectionId === WORKSPACE_SECTION_IDS.profile ? "profile" : "overview");
    }

    window.addEventListener("hashchange", syncActiveSection);
    syncActiveSection();
    return () => window.removeEventListener("hashchange", syncActiveSection);
  }, []);

  return (
    <div className="workspaceShell">
      <div className="workspaceLayout">
        <aside className="workspaceSidebar">
          <nav className="workspaceAppRail" aria-label={tNavigation("workspaceShortcuts")}>
            <Link className="workspaceAppRail__brand" href={`#${WORKSPACE_SECTION_IDS.overview}`} aria-label={tWorkspace("title")}>
              <Image src={BRAND_ASSETS.icon32} width={36} height={36} alt="" priority />
            </Link>
            {navigationGroups.map(({ id, icon: Icon, sections: groupSections }) => {
              const selected = groupSections.some((section) => section.id === activeSection) || (id === "management" && activeSection === "profile");
              return (
                <a
                  className={selected ? "workspaceAppRail__link is-active" : "workspaceAppRail__link"}
                  href={`#${groupSections[0].href}`}
                  key={id}
                  aria-label={tNavigation(id)}
                  aria-current={selected ? "location" : undefined}
                  title={tNavigation(id)}
                >
                  <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                </a>
              );
            })}
            <span className="workspaceAppRail__spacer" />
          </nav>

          <nav className="workspaceNavigation" aria-label={tNavigation("workspaceNavigation")}>
            <Link className="workspaceNavigation__brand" href={`#${WORKSPACE_SECTION_IDS.overview}`} aria-label={tWorkspace("title")}>
              <BrandLogo />
            </Link>
            <Button className="workspaceNavigation__create" type="button" disabled={!canCreateContent} title={!canCreateContent ? tNavigation("createContentUnavailable") : undefined} onClick={() => { setActiveSection("calendar"); window.location.hash = WORKSPACE_SECTION_IDS.calendar; window.dispatchEvent(new Event(WORKSPACE_UI_EVENTS.createContent)); }}>
              <Plus aria-hidden="true" size={17} />{tNavigation("createContent")}
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
                  <div className="workspaceNavigation__groupLinks" id={`workspace-navigation-links-${id}`} hidden={collapsedGroups[id]}>
                    {groupSections.map(({ id: sectionId, href, icon: Icon, label }) => (
                      <a
                        className={activeSection === sectionId ? "workspaceNavigation__link is-active" : "workspaceNavigation__link"}
                        href={`#${href}`}
                        key={sectionId}
                        aria-current={activeSection === sectionId ? "location" : undefined}
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
                aria-current={activeSection === "profile" ? "location" : undefined}
              >
                <UserRound aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{tNavigation("profile")}</span>
              </a>
              <Button appearance="quiet" type="button" onClick={onSignOut} disabled={busy}>
                <LogOut aria-hidden="true" size={17} />{tWorkspace("signOut")}
              </Button>
            </footer>
          </nav>
        </aside>

        <div className="workspaceMain">
          <header className="workspaceHeader">
            <div className="workspaceHeaderActions">
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
