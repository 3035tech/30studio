"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { TEAM_API_PATHS, TEAM_FORM_ID_PREFIXES, TEAM_ROLES, TENANT_ROLE, TENANT_ROLES, WORKSPACE_SECTION_IDS, type TenantRole } from "@/lib/constants";
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

export function TeamManagement({ organizationId }: { organizationId: string | null }) {
  const t = useTranslations("team");
  const tRoles = useTranslations("roles");
  const formatter = useFormatter();
  const [teamData, setTeamData] = useState(INITIAL_TEAM_DATA);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, TenantRole>>({});
  const [loadState, setLoadState] = useState(INITIAL_LOAD_STATE);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [message, setMessage] = useState("");
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
    } finally {
      setBusyMemberId(null);
    }
  }

  async function removeMember(memberId: string) {
    setBusyMemberId(memberId);
    setMessage("");

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
    } finally {
      setBusyMemberId(null);
    }
  }

  function canManageMember(member: TeamMember) {
    if (!currentTeamData.canManage || member.userId === currentTeamData.actorUserId || member.role === TENANT_ROLE.owner) return false;
    if (currentTeamData.actorRole === TENANT_ROLE.admin && member.role === TENANT_ROLE.admin) return false;
    return true;
  }

  return (
    <section className="teamSection" id={WORKSPACE_SECTION_IDS.team} aria-labelledby="workspace-team-title">
      <div className="workspaceHeading">
        <div>
          <p className="entryKicker">{t("eyebrow")}</p>
          <h2 id="workspace-team-title">{t("title")}</h2>
          <p className="entryDescription">{t("description")}</p>
        </div>
      </div>
      {message ? <p className="entryMessage" role="status">{message}</p> : null}
      {currentLoadState.pending ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : null}
      {!currentLoadState.pending && currentLoadState.hasError ? (
        <div className="workspaceEmpty teamSection__error" role="alert">
          <span>{t("loadError")}</span>
          <Button appearance="quiet" type="button" onClick={() => { setLoadState({ organizationId, pending: true, hasError: false }); setReloadCount((count) => count + 1); }}>{t("retry")}</Button>
        </div>
      ) : null}
      {!currentLoadState.pending && !currentLoadState.hasError && !currentTeamData.canManage ? <p className="workspaceEmpty">{t("restricted")}</p> : null}
      {!currentLoadState.pending && !currentLoadState.hasError && currentTeamData.canManage && currentTeamData.members.length === 0 ? <p className="workspaceEmpty">{t("empty")}</p> : null}
      {!currentLoadState.pending && !currentLoadState.hasError && currentTeamData.canManage && currentTeamData.members.length > 0 ? (
        <ul className="teamCollection">
          {currentTeamData.members.map((member) => {
            const canManageMemberRow = canManageMember(member);
            const selectedRole = selectedRoles[member.id] ?? member.role;
            const roleChanged = selectedRole !== member.role;

            return (
              <li className="teamCollection__item" key={member.id}>
                <div className="teamCollection__identity">
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
                <p className="teamCollection__joined">{t("joined", { date: formatter.dateTime(new Date(member.createdAt), { dateStyle: "medium" }) })}</p>
                {canManageMemberRow ? (
                  <div className="teamCollection__actions">
                    <SelectField
                      id={`${TEAM_FORM_ID_PREFIXES.role}${member.id}`}
                      label={t("roleFor", { member: member.name })}
                      value={selectedRole}
                      disabled={busyMemberId === member.id}
                      onChange={(event) => {
                        const role = TENANT_ROLES.find((candidate) => candidate === event.target.value);
                        if (role) setSelectedRoles((current) => ({ ...current, [member.id]: role }));
                      }}
                    >
                      {TEAM_ROLES.filter((role) => role !== TENANT_ROLE.owner && (currentTeamData.actorRole === TENANT_ROLE.owner || role !== TENANT_ROLE.admin)).map((role) => (
                        <option key={role} value={role}>{tRoles(role)}</option>
                      ))}
                    </SelectField>
                    <Button type="button" disabled={!roleChanged || busyMemberId === member.id} onClick={() => void updateRole(member.id)}>
                      {busyMemberId === member.id ? t("working") : t("saveRole")}
                    </Button>
                    {removingMemberId === member.id ? (
                      <div className="teamCollection__confirmation" role="group" aria-label={t("removeConfirmationLabel", { member: member.name })}>
                        <span>{t("removeConfirmation", { member: member.name })}</span>
                        <Button appearance="quiet" type="button" disabled={busyMemberId === member.id} onClick={() => setRemovingMemberId(null)}>{t("cancel")}</Button>
                        <Button type="button" disabled={busyMemberId === member.id} onClick={() => void removeMember(member.id)}>{t("confirmRemove")}</Button>
                      </div>
                    ) : (
                      <Button appearance="quiet" type="button" disabled={busyMemberId === member.id} onClick={() => setRemovingMemberId(member.id)}>{t("remove")}</Button>
                    )}
                  </div>
                ) : (
                  <span className="teamCollection__role">{tRoles(member.role)}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
