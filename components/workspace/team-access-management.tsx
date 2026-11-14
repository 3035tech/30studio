"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { API_ERROR_CODES, INVITATION_STATUS, TEAM_API_PATHS, TEAM_FORM_ID_PREFIXES, TEAM_AUDIT_ACTIONS, TEAM_ROLES, TENANT_ROLE, type Locale, type TenantRole } from "@/lib/constants";
import { teamAuditResponseSchema, teamInvitationsResponseSchema, type TeamAuditEvent, type TeamInvitation } from "@/lib/validation/team";

const ACTION_TRANSLATION_KEYS: Record<(typeof TEAM_AUDIT_ACTIONS)[keyof typeof TEAM_AUDIT_ACTIONS], string> = {
  [TEAM_AUDIT_ACTIONS.memberRoleChanged]: "memberRoleChangedEvent",
  [TEAM_AUDIT_ACTIONS.memberRemoved]: "memberRemovedEvent",
  [TEAM_AUDIT_ACTIONS.invitationCreated]: "inviteCreatedEvent",
  [TEAM_AUDIT_ACTIONS.invitationResent]: "inviteResentEvent",
  [TEAM_AUDIT_ACTIONS.invitationCancelled]: "inviteCancelledEvent",
  [TEAM_AUDIT_ACTIONS.invitationAccepted]: "inviteAcceptedEvent",
  [TEAM_AUDIT_ACTIONS.invitationDeliveryFailed]: "inviteDeliveryFailedEvent",
};

export function TeamAccessManagement({ organizationId, canManage, actorRole }: { organizationId: string; canManage: boolean; actorRole: TenantRole }) {
  const t = useTranslations("team");
  const tRoles = useTranslations("roles");
  const tStatus = useTranslations("invitationStatus");
  const tTable = useTranslations("teamTable");
  const formatter = useFormatter();
  const locale = useLocale() as Locale;
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [auditEvents, setAuditEvents] = useState<TeamAuditEvent[]>([]);
  const [pending, setPending] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [cancelInvitationId, setCancelInvitationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(TEAM_API_PATHS.invitations, { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
      fetch(TEAM_API_PATHS.audit, { credentials: "same-origin", cache: "no-store", signal: controller.signal }),
    ]).then(async ([invitationResponse, auditResponse]) => {
      if (!invitationResponse.ok || !auditResponse.ok) throw new Error();
      const [invitationResult, auditResult] = await Promise.all([invitationResponse.json(), auditResponse.json()]);
      const parsedInvitations = teamInvitationsResponseSchema.safeParse(invitationResult);
      const parsedAudit = teamAuditResponseSchema.safeParse(auditResult);
      if (!parsedInvitations.success || !parsedAudit.success) throw new Error();
      setInvitations(parsedInvitations.data.data);
      setAuditEvents(parsedAudit.data.data);
      setLoadError(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(true);
    }).finally(() => setPending(false));
    return () => controller.abort();
  }, [organizationId, reloadCount]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const role = String(form.get("role") ?? TENANT_ROLE.editor) as TenantRole;
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(TEAM_API_PATHS.invitations, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = await response.json().catch(() => null) as { code?: string } | null;
      if (!response.ok) {
        if (result?.code === API_ERROR_CODES.invitationDeliveryUnavailable) throw new Error(API_ERROR_CODES.invitationDeliveryUnavailable);
        if (result?.code === API_ERROR_CODES.invitationAlreadyExists) throw new Error(API_ERROR_CODES.invitationAlreadyExists);
        throw new Error();
      }
      formElement.reset();
      setMessage(t("inviteSent"));
      setPending(true);
      setReloadCount((count) => count + 1);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error && error.message === API_ERROR_CODES.invitationDeliveryUnavailable ? t("emailUnavailable") : error instanceof Error && error.message === API_ERROR_CODES.invitationAlreadyExists ? t("duplicateInvite") : t("inviteError"));
      setPending(true);
      setReloadCount((count) => count + 1);
    }
  }

  async function invitationAction(invitation: TeamInvitation, action: "resend" | "cancel") {
    setBusyInvitationId(invitation.id);
    setMessage("");
    try {
      const response = await fetch(`${TEAM_API_PATHS.invitations}/${encodeURIComponent(invitation.id)}`, {
        method: action === "resend" ? "POST" : "DELETE", credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      setMessage(action === "resend" ? t("invitationResent") : t("invitationCancelled"));
      setCancelInvitationId(null);
      setPending(true);
      setReloadCount((count) => count + 1);
    } catch {
      setMessageIsError(true);
      setMessage(t("invitationActionError"));
      setPending(true);
      setReloadCount((count) => count + 1);
    } finally {
      setBusyInvitationId(null);
    }
  }

  const invitationColumns: DataTableColumn<TeamInvitation>[] = [
    { id: "email", label: tTable("email"), sortValue: (row) => row.email, render: (row) => row.email },
    { id: "role", label: tTable("role"), sortValue: (row) => tRoles(row.role), render: (row) => tRoles(row.role) },
    { id: "status", label: tTable("status"), sortValue: (row) => tStatus(row.status), render: (row) => tStatus(row.status) },
    { id: "inviter", label: tTable("invitedBy"), sortValue: (row) => row.inviterName, render: (row) => row.inviterName },
    { id: "created", label: tTable("created"), sortValue: (row) => row.createdAt, render: (row) => formatter.dateTime(new Date(row.createdAt), { dateStyle: "medium" }) },
    { id: "expires", label: tTable("expires"), sortValue: (row) => row.expiresAt, render: (row) => formatter.dateTime(new Date(row.expiresAt), { dateStyle: "medium" }) },
    { id: "actions", label: tTable("actions"), sortValue: (row) => row.email, render: (row) => row.status === INVITATION_STATUS.pending ? (
      <div className="dataTable__actions">
        <Button appearance="quiet" type="button" disabled={busyInvitationId === row.id} onClick={() => void invitationAction(row, "resend")}>{t("resendInvitation")}</Button>
        {cancelInvitationId === row.id ? <>
          <span role="group" aria-label={t("confirmCancelInvitation", { email: row.email })}>{t("confirmCancelInvitation", { email: row.email })}</span>
          <Button appearance="quiet" type="button" disabled={busyInvitationId === row.id} onClick={() => setCancelInvitationId(null)}>{t("cancel")}</Button>
          <Button type="button" disabled={busyInvitationId === row.id} onClick={() => void invitationAction(row, "cancel")}>{t("confirmCancel")}</Button>
        </> : <Button appearance="quiet" type="button" disabled={busyInvitationId === row.id} onClick={() => setCancelInvitationId(row.id)}>{t("cancelInvitation")}</Button>}
      </div>
    ) : <span aria-label={tTable("noActions")}>—</span> },
  ];
  const auditColumns: DataTableColumn<TeamAuditEvent>[] = [
    { id: "time", label: t("auditTime"), sortValue: (row) => row.occurredAt, render: (row) => formatter.dateTime(new Date(row.occurredAt), { dateStyle: "medium", timeStyle: "short" }) },
    { id: "actor", label: t("auditActor"), sortValue: (row) => row.actorName || row.actorEmail, render: (row) => row.actorName || row.actorEmail },
    { id: "action", label: t("auditAction"), sortValue: (row) => t(ACTION_TRANSLATION_KEYS[row.action]), render: (row) => t(ACTION_TRANSLATION_KEYS[row.action]) },
    { id: "target", label: t("auditTarget"), sortValue: (row) => row.targetName || row.targetEmail || "", render: (row) => row.targetName || row.targetEmail || t("unknownMember") },
    { id: "role", label: t("auditRole"), sortValue: (row) => `${row.previousRole ?? ""} ${row.newRole ?? ""}`, render: (row) => row.previousRole && row.newRole ? t("roleChange", { previousRole: tRoles(row.previousRole as TenantRole), newRole: tRoles(row.newRole as TenantRole) }) : "—" },
  ];

  return <div className="teamAccess">
    {message ? <p className={`entryMessage${messageIsError ? " entryMessage--error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p> : null}
    {canManage ? <section className="teamAccess__section" aria-labelledby="team-invite-title">
      <div className="workspaceHeading"><div><h3 id="team-invite-title">{t("inviteTitle")}</h3><p className="entryDescription">{t("inviteDescription")}</p></div></div>
      <form className="teamInviteForm" onSubmit={(event) => void createInvitation(event)}>
        <TextField id={`${TEAM_FORM_ID_PREFIXES.invite}email`} name="email" type="email" label={t("inviteEmail")} autoComplete="email" required />
        <SelectField id={`${TEAM_FORM_ID_PREFIXES.invite}role`} name="role" label={t("inviteRole")} defaultValue={TENANT_ROLE.editor}>
          {TEAM_ROLES.filter((role) => role !== TENANT_ROLE.owner && (actorRole === TENANT_ROLE.owner || role !== TENANT_ROLE.admin)).map((role) => <option key={role} value={role}>{tRoles(role)}</option>)}
        </SelectField>
        <Button type="submit">{t("sendInvite")}</Button>
      </form>
    </section> : null}
    <section className="teamAccess__section" aria-labelledby="team-invitations-title">
      <div className="workspaceHeading"><div><h3 id="team-invitations-title">{t("invitationTitle")}</h3><p className="entryDescription">{t("invitationDescription")}</p></div></div>
      {pending ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : loadError ? <p className="workspaceEmpty" role="alert">{t("loadError")} <Button appearance="quiet" type="button" onClick={() => { setPending(true); setReloadCount((count) => count + 1); }}>{t("retry")}</Button></p> : <DataTable
        id="team-invitations" rows={invitations} columns={invitationColumns} getRowId={(row) => row.id} initialSortColumnId="created"
        searchValue={(row) => `${row.email} ${row.role} ${row.status} ${row.inviterName}`} searchLabel={t("invitationSearch")}
        pageSizeLabel={tTable("pageSize")} emptyMessage={t("invitationEmpty")} noMatchesMessage={tTable("noMatches")} locale={locale}
      />}
    </section>
    <section className="teamAccess__section" aria-labelledby="team-audit-title">
      <div className="workspaceHeading"><div><h3 id="team-audit-title">{t("auditTitle")}</h3><p className="entryDescription">{t("auditDescription")}</p></div></div>
      {pending ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : loadError ? <p className="workspaceEmpty" role="alert">{t("auditLoadError")} <Button appearance="quiet" type="button" onClick={() => { setPending(true); setReloadCount((count) => count + 1); }}>{t("auditRetry")}</Button></p> : <DataTable
        id="team-audit" rows={auditEvents} columns={auditColumns} getRowId={(row) => row.id} initialSortColumnId="time"
        searchValue={(row) => `${row.actorName} ${row.actorEmail} ${row.targetName} ${row.targetEmail ?? ""} ${row.action}`} searchLabel={t("auditSearch")}
        pageSizeLabel={tTable("pageSize")} emptyMessage={t("auditEmpty")} noMatchesMessage={tTable("noMatches")} locale={locale}
      />}
    </section>
  </div>;
}
