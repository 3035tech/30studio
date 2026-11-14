"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Building2, CalendarDays, LayoutDashboard, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { SelectField } from "@/components/ui/field";
import { Link } from "@/lib/i18n/routing";
import { WORKSPACE_SECTION_IDS, type Locale } from "@/lib/constants";

type WorkspaceOrganization = { id: string; name: string };
type WorkspaceSection = "overview" | "calendar" | "brands" | "team";

type WorkspaceShellProps = {
  children: ReactNode;
  organizations: readonly WorkspaceOrganization[];
  activeOrganizationId: string;
  userEmail: string;
  nextLocale: Locale;
  busy: boolean;
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
  onOrganizationChange,
  onSignOut,
}: WorkspaceShellProps) {
  const tNavigation = useTranslations("navigation");
  const tWorkspace = useTranslations("workspace");
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("overview");
  const languageLabel = nextLocale === "en" ? tNavigation("english") : tNavigation("portuguese");
  const sections = [
    { id: "overview" as const, href: WORKSPACE_SECTION_IDS.overview, icon: LayoutDashboard, label: tNavigation("overview") },
    { id: "calendar" as const, href: WORKSPACE_SECTION_IDS.calendar, icon: CalendarDays, label: tNavigation("calendar") },
    { id: "brands" as const, href: WORKSPACE_SECTION_IDS.brands, icon: Building2, label: tNavigation("brands") },
    { id: "team" as const, href: WORKSPACE_SECTION_IDS.team, icon: UsersRound, label: tNavigation("team") },
  ];

  useEffect(() => {
    function syncActiveSection() {
      const sectionId = window.location.hash.slice(1);
      setActiveSection(sectionId === WORKSPACE_SECTION_IDS.calendar ? "calendar" : sectionId === WORKSPACE_SECTION_IDS.brands ? "brands" : sectionId === WORKSPACE_SECTION_IDS.team ? "team" : "overview");
    }

    window.addEventListener("hashchange", syncActiveSection);
    syncActiveSection();
    return () => window.removeEventListener("hashchange", syncActiveSection);
  }, []);

  return (
    <div className="workspaceShell">
      <header className="workspaceHeader">
        <Link className="workspaceBrand" href={`#${WORKSPACE_SECTION_IDS.overview}`} aria-label={tWorkspace("title")}>
          <BrandLogo />
        </Link>
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
          <span className="workspaceEmail">{userEmail}</span>
          <Link className="localeLink" href="/" locale={nextLocale} aria-label={tNavigation("switchLanguage")}>
            {languageLabel}
          </Link>
          <Button appearance="quiet" type="button" onClick={onSignOut} disabled={busy}>
            {tWorkspace("signOut")}
          </Button>
        </div>
      </header>

      <div className="workspaceFrame" id="workspace">
        <nav className="workspaceNavigation" aria-label={tNavigation("workspaceNavigation")}>
          {sections.map(({ id, href, icon: Icon, label }) => (
            <a
              className={activeSection === id ? "workspaceNavigation__link is-active" : "workspaceNavigation__link"}
              href={`#${href}`}
              key={id}
              aria-current={activeSection === id ? "location" : undefined}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <main className="workspaceContent">{children}</main>
      </div>
    </div>
  );
}
