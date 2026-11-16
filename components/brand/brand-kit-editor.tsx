"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { BrandAssetLibrary } from "@/components/brand/brand-asset-library";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Disclosure } from "@/components/ui/disclosure";
import { TextAreaField, TextField } from "@/components/ui/field";
import { BRAND_KIT_LIMITS, BRAND_KIT_UI_IDS, BRAND_KIT_VERSION_STATUS, BRAND_KIT_API_PATHS, getBrandKitApiPath, type Locale } from "@/lib/constants";
import { brandKitContentSchema, brandKitVersionsResponseSchema, type BrandKitContent, type BrandKitFact, type BrandKitVersion } from "@/lib/validation/brand-kits";

const EMPTY_BRAND_KIT: BrandKitContent = {
  audience: "",
  toneOfVoice: "",
  colors: [],
  fontFamilies: [],
  keyMessages: [],
  products: [],
  verifiedFacts: [],
  restrictedClaims: [],
  callsToAction: [],
};

type BrandKitLoadResult = { versions: BrandKitVersion[]; canManage: boolean };

async function fetchBrandKit(brandId: string, signal?: AbortSignal): Promise<BrandKitLoadResult> {
  const response = await fetch(getBrandKitApiPath(brandId), { credentials: "same-origin", cache: "no-store", signal });
  if (!response.ok) throw new Error();
  const result = brandKitVersionsResponseSchema.safeParse(await response.json());
  if (!result.success) throw new Error();
  return { versions: result.data.data, canManage: result.data.canManage };
}

function formatStringList(value: string[]) {
  return value.join("\n");
}

function parseStringList(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export function BrandKitEditor({ brandId, brandName }: { brandId: string; brandName: string }) {
  const t = useTranslations("brandKit");
  const tTable = useTranslations("brandKitTable");
  const tAssets = useTranslations("brandAssets");
  const formatter = useFormatter();
  const locale = useLocale() as Locale;
  const [versions, setVersions] = useState<BrandKitVersion[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [content, setContent] = useState<BrandKitContent>(EMPTY_BRAND_KIT);
  const [canEdit, setCanEdit] = useState(false);
  const [pending, setPending] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchBrandKit(brandId, controller.signal).then((result) => {
      setVersions(result.versions);
      setCanManage(result.canManage);
      const current = result.versions[0] ?? null;
      setSelectedVersionId(current?.id ?? null);
      setContent(current?.content ?? EMPTY_BRAND_KIT);
      setCanEdit(result.canManage && (!current || current.status === BRAND_KIT_VERSION_STATUS.draft));
      setHasError(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setHasError(true);
    }).finally(() => setPending(false));
    return () => controller.abort();
  }, [brandId]);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  );

  async function reload(preferredVersionId?: string | null) {
    const result = await fetchBrandKit(brandId);
    setVersions(result.versions);
    setCanManage(result.canManage);
    const current = result.versions.find((version) => version.id === preferredVersionId) ?? result.versions[0] ?? null;
    setSelectedVersionId(current?.id ?? null);
    setContent(current?.content ?? EMPTY_BRAND_KIT);
    setCanEdit(result.canManage && (!current || current.status === BRAND_KIT_VERSION_STATUS.draft));
    setHasError(false);
    setPending(false);
  }

  function selectVersion(version: BrandKitVersion) {
    setSelectedVersionId(version.id);
    setContent(version.content);
    setCanEdit(canManage && version.status === BRAND_KIT_VERSION_STATUS.draft);
    setNotice("");
  }

  function startNewVersion() {
    setSelectedVersionId(null);
    setCanEdit(true);
    setNotice("");
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = brandKitContentSchema.safeParse(content);
    if (!parsed.success) {
      setNotice(t("validationError"));
      setNoticeIsError(true);
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(getBrandKitApiPath(brandId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => null) as { data?: { id?: string } } | null;
      if (!response.ok || !result?.data?.id) throw new Error();
      await reload(result.data.id);
      setCanEdit(true);
      setNotice(t("draftSaved"));
      setNoticeIsError(false);
    } catch {
      setNotice(t("saveError"));
      setNoticeIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function approveDraft() {
    if (!selectedVersion || selectedVersion.status !== BRAND_KIT_VERSION_STATUS.draft) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`${getBrandKitApiPath(brandId)}/${encodeURIComponent(selectedVersion.id)}/${BRAND_KIT_API_PATHS.approveAction}`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      await reload(selectedVersion.id);
      setNotice(t("versionApproved"));
      setNoticeIsError(false);
    } catch {
      setNotice(t("approveError"));
      setNoticeIsError(true);
    } finally {
      setBusy(false);
    }
  }

  function updateList(field: "colors" | "fontFamilies" | "keyMessages" | "products" | "restrictedClaims" | "callsToAction", value: string) {
    setContent((current) => ({ ...current, [field]: parseStringList(value) }));
  }

  function updateFact(index: number, field: keyof BrandKitFact, value: string) {
    setContent((current) => ({
      ...current,
      verifiedFacts: current.verifiedFacts.map((fact, factIndex) => factIndex === index ? { ...fact, [field]: value } : fact),
    }));
  }

  function addFact() {
    setContent((current) => ({ ...current, verifiedFacts: [...current.verifiedFacts, { statement: "", sourceUrl: "" }] }));
  }

  function removeFact(index: number) {
    setContent((current) => ({ ...current, verifiedFacts: current.verifiedFacts.filter((_, factIndex) => factIndex !== index) }));
  }

  const versionColumns: DataTableColumn<BrandKitVersion>[] = [
    { id: "version", label: tTable("version"), sortValue: (version) => version.version, render: (version) => t("versionLabel", { version: version.version }) },
    { id: "status", label: tTable("status"), sortValue: (version) => t(`status.${version.status}`), render: (version) => <span className={`brandKitStatus brandKitStatus--${version.status}`}>{t(`status.${version.status}`)}</span> },
    { id: "createdAt", label: tTable("created"), sortValue: (version) => version.createdAt, render: (version) => formatter.dateTime(new Date(version.createdAt), { dateStyle: "medium" }) },
    { id: "createdBy", label: tTable("createdBy"), sortValue: (version) => version.createdByName, render: (version) => version.createdByName },
    { id: "approvedAt", label: tTable("approved"), sortValue: (version) => version.approvedAt ?? "", render: (version) => version.approvedAt ? formatter.dateTime(new Date(version.approvedAt), { dateStyle: "medium" }) : tTable("notApproved") },
    { id: "actions", label: tTable("actions"), sortValue: (version) => version.version, render: (version) => version.id === selectedVersionId ? <span>{tTable("selected")}</span> : <Button appearance="quiet" type="button" onClick={() => selectVersion(version)}>{tTable("view")}</Button> },
  ];
  const editorId = `${BRAND_KIT_UI_IDS.editorPrefix}${brandId}`;
  const titleId = `${editorId}${BRAND_KIT_UI_IDS.titleSuffix}`;

  return (
    <section className="brandKitEditor" aria-labelledby={titleId}>
      <header className="brandKitEditor__header">
        <div>
          <h3 id={titleId}>{t("title", { brand: brandName })}</h3>
          <p>{t("description")}</p>
        </div>
        {canManage && !canEdit ? <Button type="button" onClick={startNewVersion}>{t("createVersion")}</Button> : null}
      </header>
      {notice ? <p className={`entryMessage${noticeIsError ? " entryMessage--error" : ""}`} role={noticeIsError ? "alert" : "status"}>{notice}</p> : null}
      {pending ? <p className="workspaceEmpty" aria-live="polite">{t("loading")}</p> : hasError ? (
        <div className="workspaceEmpty brandKitEditor__error" role="alert"><span>{t("loadError")}</span><Button appearance="quiet" type="button" onClick={() => { setPending(true); void reload().catch(() => { setHasError(true); setPending(false); }); }}>{t("retry")}</Button></div>
      ) : (
        <>
          <form className="brandKitEditor__form" onSubmit={(event) => void saveDraft(event)}>
            <p className="brandKitEditor__formIntro">{canEdit ? t("draftNotice") : selectedVersion ? t("readOnlyNotice") : t("emptyNotice")}</p>
            <div className="brandKitEditor__fields">
              <TextAreaField id={`${editorId}-audience`} label={t("audience")} value={content.audience} disabled={!canEdit || busy} maxLength={BRAND_KIT_LIMITS.textCharacters} onChange={(event) => setContent((current) => ({ ...current, audience: event.target.value }))} />
              <TextAreaField id={`${editorId}-tone`} label={t("toneOfVoice")} value={content.toneOfVoice} disabled={!canEdit || busy} maxLength={BRAND_KIT_LIMITS.textCharacters} onChange={(event) => setContent((current) => ({ ...current, toneOfVoice: event.target.value }))} />
              <TextAreaField id={`${editorId}-colors`} label={t("colors")} value={formatStringList(content.colors)} disabled={!canEdit || busy} placeholder={t("hexColorPlaceholder")} onChange={(event) => updateList("colors", event.target.value)} />
              <TextAreaField id={`${editorId}-fonts`} label={t("fontFamilies")} value={formatStringList(content.fontFamilies)} disabled={!canEdit || busy} onChange={(event) => updateList("fontFamilies", event.target.value)} />
              <TextAreaField id={`${editorId}-messages`} label={t("keyMessages")} value={formatStringList(content.keyMessages)} disabled={!canEdit || busy} onChange={(event) => updateList("keyMessages", event.target.value)} />
              <TextAreaField id={`${editorId}-products`} label={t("products")} value={formatStringList(content.products)} disabled={!canEdit || busy} onChange={(event) => updateList("products", event.target.value)} />
              <TextAreaField id={`${editorId}-restrictions`} label={t("restrictedClaims")} value={formatStringList(content.restrictedClaims)} disabled={!canEdit || busy} onChange={(event) => updateList("restrictedClaims", event.target.value)} />
              <TextAreaField id={`${editorId}-ctas`} label={t("callsToAction")} value={formatStringList(content.callsToAction)} disabled={!canEdit || busy} onChange={(event) => updateList("callsToAction", event.target.value)} />
            </div>
            <div className="brandKitEditor__facts">
              <div className="brandKitEditor__factsHeading">
                <div><h4>{t("verifiedFacts")}</h4><p>{t("verifiedFactsDescription")}</p></div>
                {canEdit && content.verifiedFacts.length < BRAND_KIT_LIMITS.facts ? <Button appearance="quiet" type="button" onClick={addFact}><Plus aria-hidden="true" size={16} />{t("addFact")}</Button> : null}
              </div>
              {content.verifiedFacts.length === 0 ? <p className="brandKitEditor__emptyFacts">{t("noFacts")}</p> : content.verifiedFacts.map((fact, index) => (
                <div className="brandKitEditor__fact" key={`${brandId}-fact-${index}`}>
                  <TextField id={`${editorId}-fact-${index}`} label={t("factStatement")} value={fact.statement} disabled={!canEdit || busy} maxLength={BRAND_KIT_LIMITS.itemCharacters} onChange={(event) => updateFact(index, "statement", event.target.value)} />
                  <TextField id={`${editorId}-source-${index}`} label={t("sourceUrl")} type="url" value={fact.sourceUrl} disabled={!canEdit || busy} maxLength={BRAND_KIT_LIMITS.sourceUrlCharacters} onChange={(event) => updateFact(index, "sourceUrl", event.target.value)} />
                  {canEdit ? <Button appearance="quiet" type="button" disabled={busy} aria-label={t("removeFact")} onClick={() => removeFact(index)}><Trash2 aria-hidden="true" size={16} /></Button> : null}
                </div>
              ))}
            </div>
            {canEdit ? <div className="brandKitEditor__formActions">
              <Button type="submit" disabled={busy}>{busy ? t("working") : t("saveDraft")}</Button>
              {selectedVersion?.status === BRAND_KIT_VERSION_STATUS.draft ? <Button appearance="quiet" type="button" disabled={busy} onClick={() => void approveDraft()}>{t("approveVersion")}</Button> : null}
            </div> : null}
          </form>
          <Disclosure title={t("historyTitle")} className="brandKitEditor__disclosure">
            <section className="brandKitEditor__history" aria-label={t("historyTitle")}>
              <p className="brandKitEditor__historyDescription">{t("historyDescription")}</p>
              <DataTable
                id={`brand-kit-history-${brandId}`}
                rows={versions}
                columns={versionColumns}
                getRowId={(version) => version.id}
                initialSortColumnId="version"
                searchValue={(version) => `${version.version} ${version.status} ${version.createdByName} ${version.approvedByName ?? ""}`}
                searchLabel={t("filterVersions")}
                pageSizeLabel={tTable("pageSize")}
                emptyMessage={t("noVersions")}
                noMatchesMessage={tTable("noMatches")}
                locale={locale}
              />
            </section>
          </Disclosure>
        </>
      )}
      <Disclosure title={tAssets("assetLibraryDetails")} className="brandKitEditor__disclosure">
        <BrandAssetLibrary key={brandId} brandId={brandId} />
      </Disclosure>
    </section>
  );
}
