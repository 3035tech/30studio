"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SocialPlatformIcon } from "@/components/ui/social-platform-icon";
import { SOCIAL_PLATFORMS, type Locale, type SocialPlatform, type SocialProfileStatus } from "@/lib/constants";
import { socialConnectionConfigurationResponseSchema, socialConnectionListResponseSchema } from "@/lib/validation/social-connections";

type Connection = { id: string; platform: SocialPlatform; displayName: string; handle: string | null; status: SocialProfileStatus; connectedAt: string | null; connectedByName: string | null; grantedScopes: string[]; missingScopes: string[]; tokenExpiresAt: string | null; refreshTokenExpiresAt: string | null; credentialsUpdatedAt: string | null };

export function SocialConnectionManager({ brandId, canManage = true }: { brandId: string; canManage?: boolean }) {
  const t = useTranslations("socialConnections");
  const platforms = useTranslations("platforms");
  const statusLabel = useTranslations("profileStatus");
  const locale = useLocale() as Locale;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const [connections, setConnections] = useState<Connection[]>([]);
  const [busyPlatform, setBusyPlatform] = useState<SocialPlatform | null>(null);
  const [error, setError] = useState(false);
  const [configured, setConfigured] = useState<SocialPlatform[]>([]);
  const [publicationCapabilities, setPublicationCapabilities] = useState<Map<SocialPlatform, { publication: "connection_only" | "text" | "single_image"; maximumTextCharacters: number | null }>>(() => new Map());
  const [configurationReady, setConfigurationReady] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [pendingDisconnect, setPendingDisconnect] = useState<Connection | null>(null);

  async function load() {
    try {
      const response = await fetch(`/api/brands/${brandId}/social-connections`, { credentials: "same-origin", cache: "no-store" });
      const result = socialConnectionListResponseSchema.safeParse(await response.json());
      if (!response.ok) throw new Error();
      if (!result.success) throw new Error();
      setConnections(result.data.data);
      setError(false);
    } catch { setError(true); }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/brands/${brandId}/social-connections`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = socialConnectionListResponseSchema.safeParse(await response.json());
        if (!result.success) throw new Error();
        setConnections(result.data.data);
        setError(false);
      })
      .catch((cause: unknown) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(true); });
    void fetch("/api/social-connections/configuration", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((result) => {
        const parsed = socialConnectionConfigurationResponseSchema.safeParse(result);
        if (!parsed.success) throw new Error();
        setConfigured(parsed.data.data.filter((item) => item.configured).map((item) => item.platform));
        setPublicationCapabilities(new Map(parsed.data.data.map((item) => [item.platform, { publication: item.publication, maximumTextCharacters: item.maximumTextCharacters }])));
        setConfigurationReady(true);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setConfigurationReady(true);
          setError(true);
        }
      });
    return () => controller.abort();
  }, [brandId, reloadCount]);

  function retryLoading() {
    setError(false);
    setConfigurationReady(false);
    setReloadCount((count) => count + 1);
  }

  async function connect(platform: SocialPlatform) {
    setBusyPlatform(platform); setError(false);
    try {
      const response = await fetch(`/api/brands/${brandId}/social-connections`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, locale }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.data?.authorizationUrl !== "string") throw new Error();
      window.location.assign(result.data.authorizationUrl);
    } catch { setError(true); setBusyPlatform(null); }
  }

  async function disconnect(connection: Connection) {
    setBusyPlatform(connection.platform); setError(false);
    try {
      const response = await fetch(`/api/brands/${brandId}/social-connections/${connection.id}`, {
        method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error();
      await load();
      setPendingDisconnect(null);
    } catch { setError(true); }
    finally { setBusyPlatform(null); }
  }

  return <section className="socialConnectionManager" aria-labelledby={`social-connections-${brandId}`}>
    <h3 id={`social-connections-${brandId}`}>{t("title")}</h3>
    {error ? <div className="entryMessage entryMessage--error" role="alert"><span>{t("error")}</span><Button appearance="quiet" type="button" disabled={!configurationReady || busyPlatform !== null} onClick={retryLoading}>{t("retry")}</Button></div> : null}
    <ul className="brandCollection__social">
      {SOCIAL_PLATFORMS.map((platform) => {
        const platformConnections = connections.filter((connection) => connection.platform === platform);
        const connectedCount = platformConnections.filter((connection) => connection.status === "connected").length;
        const publicationCapability = publicationCapabilities.get(platform) ?? { publication: "connection_only" as const, maximumTextCharacters: null };
        return <li className="brandCollection__profile" key={platform}>
          <div className="socialConnectionPlatform">
            <strong className="socialConnectionPlatform__name"><SocialPlatformIcon platform={platform} />{platforms(platform)}</strong>
            {canManage ? <Button appearance="quiet" type="button" disabled={busyPlatform !== null || !configurationReady || !configured.includes(platform)} onClick={() => void connect(platform)}>
              {busyPlatform === platform ? t("working") : !configurationReady ? t("loading") : configured.includes(platform) ? t("connect") : t("notConfigured")}
            </Button> : null}
          </div>
          <small className="socialConnectionManager__capability">{t(`capabilities.${publicationCapability.publication}`)}</small>
          {publicationCapability.maximumTextCharacters !== null ? <small className="socialConnectionManager__capability">{t("maximumTextCharacters", { maximum: publicationCapability.maximumTextCharacters })}</small> : null}
          {connectedCount > 1 ? <p className="socialConnectionManager__note">{t("selectProfilePerPost")}</p> : null}
          {platformConnections.map((connection) => {
            const tokenExpired = connection.tokenExpiresAt !== null && Date.parse(connection.tokenExpiresAt) <= Date.now();
            const tokenExpiring = connection.tokenExpiresAt !== null && Date.parse(connection.tokenExpiresAt) <= Date.now() + 7 * 24 * 60 * 60 * 1000;
            const health = connection.status === "disabled" ? "disabled" : connection.status === "pending" ? "pending" : connection.status === "reauth_required" || tokenExpired ? "reauth" : connection.missingScopes.length ? "permissions" : tokenExpiring ? "expiring" : "stored";
            return <div className="socialConnectionAccount" key={connection.id}>
            <span>{connection.displayName}{connection.handle ? ` · @${connection.handle}` : ""}</span>
            <small className={`brandProfileStatus brandProfileStatus--${connection.status}`}>{statusLabel(connection.status)}</small>
            <div className="socialConnectionManager__health" aria-label={t("health.title")}>
              <strong>{t(`health.${health}`)}</strong>
              {connection.connectedByName ? <small>{t("health.connectedBy", { name: connection.connectedByName })}</small> : null}
              {connection.tokenExpiresAt ? <small>{t("health.tokenExpires", { date: dateFormatter.format(new Date(connection.tokenExpiresAt)) })}</small> : null}
              {connection.refreshTokenExpiresAt ? <small>{t("health.refreshExpires", { date: dateFormatter.format(new Date(connection.refreshTokenExpiresAt)) })}</small> : null}
              {connection.credentialsUpdatedAt ? <small>{t("health.credentialsUpdated", { date: dateFormatter.format(new Date(connection.credentialsUpdatedAt)) })}</small> : null}
              {connection.missingScopes.length ? <small>{t("health.missingScopes", { scopes: connection.missingScopes.join(", ") })}</small> : null}
              {connection.grantedScopes.length ? <small>{t("health.grantedScopes", { scopes: connection.grantedScopes.join(", ") })}</small> : null}
              <small>{t("health.remoteCheckUnavailable")}</small>
            </div>
            {canManage && connection.status !== "disabled" ? <Button appearance="quiet" type="button" disabled={busyPlatform !== null} onClick={() => setPendingDisconnect(connection)}>
              {busyPlatform === platform ? t("working") : t("disconnect")}
            </Button> : null}
          </div>;
          })}
        </li>;
      })}
    </ul>
    <Dialog open={pendingDisconnect !== null} onOpenChange={(open) => { if (!open && busyPlatform === null) setPendingDisconnect(null); }}>
      {pendingDisconnect ? <DialogContent aria-labelledby="social-disconnect-title" aria-describedby="social-disconnect-description">
        <DialogHeader>
          <DialogTitle id="social-disconnect-title">{t("disconnectTitle")}</DialogTitle>
          <DialogDescription id="social-disconnect-description">{t("disconnectConfirmation", { account: pendingDisconnect.displayName })}</DialogDescription>
        </DialogHeader>
        <div className="brandCollection__editorActions">
          <Button appearance="quiet" type="button" disabled={busyPlatform !== null} onClick={() => setPendingDisconnect(null)}>{t("cancel")}</Button>
          <Button appearance="danger" type="button" disabled={busyPlatform !== null} onClick={() => void disconnect(pendingDisconnect)}>{busyPlatform === pendingDisconnect.platform ? t("working") : t("disconnect")}</Button>
        </div>
      </DialogContent> : null}
    </Dialog>
  </section>;
}
