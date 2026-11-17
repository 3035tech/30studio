"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { TeamAccessManagement } from "@/components/workspace/team-access-management";
import { ApprovalPolicySettings } from "@/components/workspace/approval-policy-settings";
import type { BrandListItem } from "@/lib/validation/brands";
import { TEAM_API_PATHS, TEAM_FORM_ID_PREFIXES, TEAM_ROLES, TENANT_ROLE, TENANT_ROLES, WORKSPACE_SECTION_IDS, type Locale, type TenantRole } from "@/lib/constants";
import { teamListResponseSchema, type TeamMember } from "@/lib/validation/team";

type TeamData = {
  organizationId: string | null;
  members: TeamMember[];
  canManage: boolean;
  actorRole: TenantRole;
  actorUserId: string;
};

const INITIAL_TEAM_DATA: TeamData = { organizationId: null, members: [], canManage: false, actorRole: TENANT_ROLE.analyst, actorUserId: "" };

type TeamLoadState = { organizationId: string | null; pending: boolean; hasError: boolean };

const INITIAL_LOAD_STATE: TeamLoadState = { organizationId: null, pending: true, hasError: false };

export function TeamManagement({ organizationId, brands }: { organizationId: string | null; brands: BrandListItem[] }) {
  const t = useTranslations("team");
  const tRoles = useTranslations("roles");
  const formatter = useFormatter();
  const locale = useLocale() as Locale;
  const [teamData, setTeamData] = useState(INITIAL_TEAM_DATA);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, TenantRole>>({});
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "access" | "approval">("members");
  const currentTeamData = teamData.organizationId === organizationId ? teamData : INITIAL_TEAM_DATA;
  const currentLoadState = organizationId === null
    ? { organizationId, pending: true, hasError: false }
    : loadState.organizationId === organizationId ? loadState : { organizationId, pending: true, hasError: false };

  useEffect(() => {
    const controller = new AbortController();
    if (!organizationId) return () => controller.abort();
    fetch(TEAM_API_PATHS.collection, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = teamListResponseSchema.safeParse(await response.json());
        if (!result.success) throw new Error();
        setTeamData({
          organizationId,
          members: result.data.data,
          canManage: result.data.canManage,
          actorRole: result.data.actorRole,
          actorUserId: result.data.actorUserId,
        });
        setLoadState({ organizationId, pending: false, hasError: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState({ organizationId, pending: false, hasError: true });
      });

    return () => controller.abort();
  }, [organizationId, reloadCount]);

  async function updateRole(memberId: string) {
    const role = selectedRoles[memberId];
    if (!role) return;
    setBusyMemberId(memberId);
    setMessage("");
    setMessageIsError(false);

    try {
      const response = await fetch(`${TEAM_API_PATHS.collection}/${memberId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error();
      setTeamData((current) => ({
        ...current,
        organizationId,
        members: current.members.map((member) => member.id === memberId ? { ...member, role } : member),
      }));
      setSelectedRoles((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
      setMessage(t("roleUpdated"));
    } catch {
      setMessage(t("updateError"));
      setMessageIsError(true);
    } finally {
      setBusyMemberId(null);
    }
  }

  async function removeMember(memberId: string) {
    setBusyMemberId(memberId);
    setMessage("");
    setMessageIsError(false);

    try {
      const response = await fetch(`${TEAM_API_PATHS.collection}/${memberId}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      setTeamData((current) => ({
        ...current,
        organizationId,
        members: current.members.filter((member) => member.id !== memberId),
      }));
      setRemovingMemberId(null);
      setMessage(t("memberRemoved"));
    } catch {
      setMessage(t("removeError"));
      setMessageIsError(true);
    } finally {
      setBusyMemberId(null);
    }
  }

  function canManageMember(member: TeamMember) {
    if (!currentTeamData.canManage || member.userId === currentTeamData.actorUserId || member.role === TENANT_ROLE.owner) return false;
    if (currentTeamData.actorRole === TENANT_ROLE.admin && member.role === TENANT_ROLE.admin) return false;
    return true;
  }

  const memberColumns: DataTableColumn<TeamMember>[] = [
    { id: "name", label: t("memberName"), sortValue: (member) => member.name, render: (member) => <div className="teamCollection__identity"><strong>{member.name}</strong><span>{member.email}</span></div> },
    { id: "joined", label: t("memberJoined"), sortValue: (member) => member.createdAt, render: (member) => formatter.dateTime(new Date(member.createdAt), { dateStyle: "medium" }) },
    { id: "role", label: t("memberRole"), sortValue: (member) => tRoles(member.role), render: (member) => {
      const manageable = canManageMember(member);
      const selectedRole = selectedRoles[member.id] ?? member.role;
      const roleChanged = selectedRole !== member.role;
      return manageable ? <div className="teamCollection__actions">
        <SelectField id={`${TEAM_FORM_ID_PREFIXES.role}${member.id}`} label={t("roleFor", { member: member.name })} value={selectedRole} disabled={busyMemberId === member.id} onChange={(event) => {
          const role = TENANT_ROLES.find((candidate) => candidate === event.target.value);
          if (role) setSelectedRoles((current) => ({ ...current, [member.id]: role }));
        }}>
          {TEAM_ROLES.filter((role) => role !== TENANT_ROLE.owner && (currentTeamData.actorRole === TENANT_ROLE.owner || role !== TENANT_ROLE.admin)).map((role) => <option key={role} value={role}>{tRoles(role)}</option>)}
        </SelectField>
        <Button type="button" disabled={!roleChanged || busyMemberId === member.id} onClick={() => void updateRole(member.id)}>{busyMemberId === member.id ? t("working") : t("saveRole")}</Button>
      </div> : <span className="teamCollection__role">{tRoles(member.role)}</span>;
    } },
    { id: "actions", label: t("memberActions"), sortValue: (member) => member.name, render: (member) => !canManageMember(member) ? <span>{t("noMemberActions")}</span> : removingMemberId === member.id ? (
      <div className="teamCollection__actions" role="group" aria-label={t("removeConfirmationLabel", { member: member.name })}>
        <span>{t("removeConfirmation", { member: member.name })}</span>
        <Button appearance="quiet" type="button" disabled={busyMemberId === member.id} onClick={() => setRemovingMemberId(null)}>{t("cancel")}</Button>
        <Button type="button" disabled={busyMemberId === member.id} onClick={() => void removeMember(member.id)}>{t("confirmRemove")}</Button>
      </div>
    ) : <Button appearance="quiet" type="button" disabled={busyMemberId === member.id} onClick={() => setRemovingMemberId(member.id)}>{t("remove")}</Button> },
  ];

  return (
    <section className="teamSection" id={WORKSPACE_SECTION_IDS.team} aria-labelledby="workspace-team-title">
      <div className="workspaceHeading">
        <div>
          <p className="entryKicker">{t("eyebrow")}</p>
          <h2 id="workspace-team-title">{t("title")}</h2>
          <p className="entryDescription">{t("description")}</p>
        </div>
      </div>
      {message ? <p className={messageIsError ? "entryMessage entryMessage--error" : "entryMessage"} role={messageIsError ? "alert" : "status"}>{message}</p> : null}
      {currentLoadState.pending ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : null}
      {!currentLoadState.pending && currentLoadState.hasError ? (
        <div className="workspaceEmpty teamSection__error" role="alert">
          <span>{t("loadError")}</span>
          <Button appearance="quiet" type="button" onClick={() => { setLoadState({ organizationId, pending: true, hasError: false }); setReloadCount((count) => count + 1); }}>{t("retry")}</Button>
        </div>
      ) : null}
      {!currentLoadState.pending && !currentLoadState.hasError && !currentTeamData.canManage ? <p className="workspaceEmpty">{t("restricted")}</p> : null}
      {!currentLoadState.pending && !currentLoadState.hasError && currentTeamData.canManage ? <>
        <div className="teamSection__tabs" role="tablist" aria-label={t("sectionsLabel")} onKeyDown={(event) => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='tab']"));
          const current = tabs.findIndex((tab) => tab === document.activeElement);
          const next = event.key === "ArrowRight" ? (current + 1) % tabs.length : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click(); }
        }}>
          <button className="teamSection__tab" id="team-tab-members" type="button" role="tab" tabIndex={activeTab === "members" ? 0 : -1} aria-selected={activeTab === "members"} aria-controls="team-panel-members" onClick={() => setActiveTab("members")}>{t("membersTab")}</button>
          <button className="teamSection__tab" id="team-tab-access" type="button" role="tab" tabIndex={activeTab === "access" ? 0 : -1} aria-selected={activeTab === "access"} aria-controls="team-panel-access" onClick={() => setActiveTab("access")}>{t("accessTab")}</button>
          <button className="teamSection__tab" id="team-tab-approval" type="button" role="tab" tabIndex={activeTab === "approval" ? 0 : -1} aria-selected={activeTab === "approval"} aria-controls="team-panel-approval" onClick={() => setActiveTab("approval")}>{t("approvalTab")}</button>
        </div>
        <div className="teamSection__panel" id="team-panel-members" role="tabpanel" aria-labelledby="team-tab-members" tabIndex={0} hidden={activeTab !== "members"}>
          {activeTab === "members" ? <DataTable
            id="team-members" rows={currentTeamData.members} columns={memberColumns} getRowId={(member) => member.id} initialSortColumnId="name"
            searchValue={(member) => `${member.name} ${member.email} ${member.role}`} searchLabel={t("memberSearch")}
            pageSizeLabel={t("tablePageSize")} emptyMessage={t("empty")} noMatchesMessage={t("tableNoMatches")} locale={locale}
          /> : null}
        </div>
        <div className="teamSection__panel" id="team-panel-access" role="tabpanel" aria-labelledby="team-tab-access" tabIndex={0} hidden={activeTab !== "access"}>{activeTab === "access" ? <TeamAccessManagement organizationId={organizationId ?? ""} canManage={currentTeamData.canManage} actorRole={currentTeamData.actorRole} /> : null}</div>
        <div className="teamSection__panel" id="team-panel-approval" role="tabpanel" aria-labelledby="team-tab-approval" tabIndex={0} hidden={activeTab !== "approval"}>{activeTab === "approval" ? <ApprovalPolicySettings brands={brands} /> : null}</div>
      </> : null}
    </section>
  );
}
