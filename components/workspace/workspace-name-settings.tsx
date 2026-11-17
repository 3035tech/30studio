"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/client/auth";
import { WORKSPACE_API_PATHS, WORKSPACE_LIMITS } from "@/lib/constants";
import { workspaceSettingsResponseSchema } from "@/lib/validation/workspace-settings";

type WorkspaceSettings = ReturnType<typeof workspaceSettingsResponseSchema.parse>;

export function WorkspaceNameSettings() {
  const t = useTranslations("workspaceSettings");
  const tAuth = useTranslations("auth");
  const { data: activeOrganization, refetch: refreshActiveOrganization } = authClient.useActiveOrganization();
  const { refetch: refreshOrganizations } = authClient.useListOrganizations();
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [completedRequestKey, setCompletedRequestKey] = useState("");
  const activeOrganizationId = activeOrganization?.id;
  const requestKey = `${activeOrganizationId ?? "no-active-workspace"}:${reloadCount}`;
  const pending = !activeOrganizationId || completedRequestKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    if (!activeOrganizationId) return () => controller.abort();

    fetch(WORKSPACE_API_PATHS.settings, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const parsed = workspaceSettingsResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error();
        setSettings(parsed.data);
        setName(parsed.data.data.name);
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHasError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setCompletedRequestKey(requestKey); });
    return () => controller.abort();
  }, [activeOrganizationId, reloadCount, requestKey]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeOrganizationId || settings?.data.id !== activeOrganizationId) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(WORKSPACE_API_PATHS.settings, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error();
      const result: unknown = await response.json();
      const parsed = workspaceSettingsResponseSchema.safeParse(result);
      if (!parsed.success) throw new Error();
      setSettings(parsed.data);
      setName(parsed.data.data.name);
      setMessage(t("saved"));
      await Promise.all([refreshActiveOrganization(), refreshOrganizations()]);
    } catch {
      setMessage(t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspaceNameSettings" aria-labelledby="workspace-name-settings-title">
      <header>
        <h2 id="workspace-name-settings-title">{t("title")}</h2>
        <p>{t("description")}</p>
      </header>
      {pending ? <p className="workspaceNameSettings__status" role="status">{t("loading")}</p> : hasError || !settings || settings.data.id !== activeOrganizationId ? <div className="workspaceNameSettings__status workspaceNameSettings__status--error" role="alert"><span>{t("loadError")}</span><Button appearance="quiet" type="button" onClick={() => setReloadCount((count) => count + 1)}>{t("retry")}</Button></div> : <>
        {settings.canManage ? <form className="workspaceNameSettings__form" onSubmit={(event) => void saveName(event)}>
          <TextField id="workspace-display-name" label={t("name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={WORKSPACE_LIMITS.nameCharacters} required disabled={busy} />
          <p className="workspaceNameSettings__slug"><span>{t("identifier")}</span><code>{settings.data.slug}</code><small>{t("identifierHelp")}</small></p>
          {message ? <p className="workspaceNameSettings__status" role="status">{message}</p> : null}
          <Button type="submit" disabled={busy || name.trim() === settings.data.name}>{busy ? tAuth("working") : t("save")}</Button>
        </form> : <div className="workspaceNameSettings__identity"><p><span>{t("name")}</span><strong>{settings.data.name}</strong></p><p className="workspaceNameSettings__slug"><span>{t("identifier")}</span><code>{settings.data.slug}</code></p><p className="workspaceNameSettings__status">{t("restricted")}</p></div>}
      </>}
    </section>
  );
}
