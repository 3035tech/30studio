"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { FileField, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { BRAND_ASSET_ACTIONS, BRAND_ASSET_FORMATS_BY_MIME, BRAND_ASSET_KINDS, BRAND_ASSET_LIMITS, BRAND_ASSET_REVIEW_DECISION, BRAND_ASSET_STATUS, BRAND_ASSET_UI_IDS, getBrandAssetActionApiPath, getBrandAssetsApiPath, type BrandAssetKind } from "@/lib/constants";
import { brandAssetDownloadResponseSchema, brandAssetsResponseSchema, brandAssetUploadSessionResponseSchema, type BrandAsset } from "@/lib/validation/brand-assets";

async function readJson(response: Response) {
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error("invalid-response"); }
  if (!response.ok) throw new Error("request-failed");
  return result;
}

async function fetchBrandAssets(brandId: string, signal?: AbortSignal) {
  const response = await fetch(getBrandAssetsApiPath(brandId), { credentials: "same-origin", cache: "no-store", signal });
  const parsed = brandAssetsResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new Error("invalid-response");
  return parsed.data;
}

export function BrandAssetLibrary({ brandId }: { brandId: string }) {
  const t = useTranslations("brandAssets");
  const tTable = useTranslations("brandAssetTable");
  const locale = useLocale();
  const libraryId = `${BRAND_ASSET_UI_IDS.libraryPrefix}${brandId}`;
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [kind, setKind] = useState<BrandAssetKind>(BRAND_ASSET_KINDS[0]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [license, setLicense] = useState("");
  const [rightsExpiresAt, setRightsExpiresAt] = useState("");
  const [altText, setAltText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pending, setPending] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ asset: BrandAsset; url: string } | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const data = await fetchBrandAssets(brandId, signal);
    setAssets(data.data);
    setCanManage(data.canManage);
  }, [brandId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchBrandAssets(brandId, controller.signal).then((data) => {
      setAssets(data.data);
      setCanManage(data.canManage);
      setHasError(false);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setHasError(true);
    }).finally(() => setPending(false));
    return () => controller.abort();
  }, [brandId]);

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) return;
    setBusy(true);
    setHasError(false);
    setNotice("");
    try {
      if (selectedFile.size > BRAND_ASSET_LIMITS.maximumBytes) throw new Error("file-too-large");
      const bytes = await selectedFile.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const sessionResponse = await fetch(getBrandAssetsApiPath(brandId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          sizeBytes: selectedFile.size,
          sha256,
          kind,
          sourceUrl: sourceUrl || null,
          license: license || null,
          rightsExpiresAt: rightsExpiresAt || null,
          altText: altText || null,
        }),
      });
      const session = brandAssetUploadSessionResponseSchema.parse(await readJson(sessionResponse));
      const form = new FormData();
      Object.entries(session.data.upload.fields).forEach(([field, value]) => form.append(field, value));
      form.append("file", selectedFile, selectedFile.name);
      const storageResponse = await fetch(session.data.upload.url, { method: "POST", body: form, credentials: "omit" });
      if (!storageResponse.ok) throw new Error("upload-failed");

      const finalizeResponse = await fetch(getBrandAssetActionApiPath(brandId, session.data.id, BRAND_ASSET_ACTIONS.finalize), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      await readJson(finalizeResponse);
      setSelectedFile(null);
      setSourceUrl("");
      setLicense("");
      setRightsExpiresAt("");
      setAltText("");
      await reload();
      setNotice(t("uploadComplete"));
    } catch {
      setHasError(true);
    } finally {
      setBusy(false);
    }
  }

  const reviewAsset = useCallback(async (asset: BrandAsset, decision: typeof BRAND_ASSET_REVIEW_DECISION[keyof typeof BRAND_ASSET_REVIEW_DECISION]) => {
    setBusy(true);
    setHasError(false);
    setNotice("");
    try {
      const response = await fetch(getBrandAssetActionApiPath(brandId, asset.id, BRAND_ASSET_ACTIONS.review), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote || null }),
      });
      await readJson(response);
      await reload();
      setReviewNote("");
      setNotice(t(decision === BRAND_ASSET_REVIEW_DECISION.approved ? "assetApproved" : "assetRejected"));
    } catch {
      setHasError(true);
    } finally {
      setBusy(false);
    }
  }, [brandId, reload, reviewNote, t]);

  const previewAsset = useCallback(async (asset: BrandAsset) => {
    setBusy(true);
    try {
      const response = await fetch(getBrandAssetActionApiPath(brandId, asset.id, BRAND_ASSET_ACTIONS.download), { credentials: "same-origin", cache: "no-store" });
      const result = brandAssetDownloadResponseSchema.parse(await readJson(response));
      setPreview({ asset, url: result.data.url });
    } catch {
      setHasError(true);
    } finally {
      setBusy(false);
    }
  }, [brandId]);

  const columns = useMemo<DataTableColumn<BrandAsset>[]>(() => [
    { id: "fileName", label: tTable("file"), sortValue: (asset) => asset.fileName, render: (asset) => (
      <div className="brandAssetLibrary__fileDetails">
        <span className="brandAssetLibrary__fileName">{asset.fileName}</span>
        {asset.sourceUrl ? <a href={asset.sourceUrl} target="_blank" rel="noreferrer">{asset.sourceUrl}</a> : <small>{tTable("noSource")}</small>}
      </div>
    ) },
    { id: "license", label: tTable("license"), sortValue: (asset) => asset.license ?? "", render: (asset) => asset.license ?? tTable("noLicense") },
    { id: "rightsExpiresAt", label: tTable("rightsExpiry"), sortValue: (asset) => asset.rightsExpiresAt ?? "", render: (asset) => asset.rightsExpiresAt
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${asset.rightsExpiresAt}T00:00:00Z`))
      : tTable("notAvailable") },
    { id: "kind", label: tTable("kind"), sortValue: (asset) => t(`kind.${asset.kind}`), render: (asset) => t(`kind.${asset.kind}`) },
    { id: "format", label: tTable("fileFormat"), sortValue: (asset) => asset.contentType, render: (asset) => tTable(`formats.${BRAND_ASSET_FORMATS_BY_MIME[asset.contentType]}`) },
    { id: "status", label: tTable("status"), sortValue: (asset) => t(`status.${asset.status}`), render: (asset) => <span className={`brandAssetStatus brandAssetStatus--${asset.status}`}>{t(`status.${asset.status}`)}</span> },
    { id: "sha256", label: tTable("checksum"), sortValue: (asset) => asset.sha256, render: (asset) => <code title={asset.sha256}>{asset.sha256.slice(0, 12)}</code> },
    { id: "dimensions", label: tTable("dimensions"), sortValue: (asset) => asset.width ?? 0, render: (asset) => asset.width && asset.height ? `${asset.width} × ${asset.height}` : tTable("notAvailable") },
    { id: "size", label: tTable("size"), sortValue: (asset) => asset.sizeBytes, render: (asset) => new Intl.NumberFormat(locale, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 }).format(Math.ceil(asset.sizeBytes / 1_024)) },
    { id: "creator", label: tTable("createdBy"), sortValue: (asset) => asset.createdByName, render: (asset) => asset.createdByName },
    { id: "createdAt", label: tTable("created"), sortValue: (asset) => Date.parse(asset.createdAt), render: (asset) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(asset.createdAt)) },
    { id: "actions", label: tTable("actions"), sortValue: (asset) => asset.fileName, render: (asset) => (
      <div className="brandAssetLibrary__actions">
        {asset.status !== BRAND_ASSET_STATUS.uploadPending ? <Button appearance="quiet" type="button" disabled={busy} onClick={() => void previewAsset(asset)}>{tTable("preview")}</Button> : null}
        {canManage && asset.status === BRAND_ASSET_STATUS.pendingReview ? <>
          <Button appearance="quiet" type="button" disabled={busy} onClick={() => void reviewAsset(asset, BRAND_ASSET_REVIEW_DECISION.approved)}>{tTable("approve")}</Button>
          <Button appearance="quiet" type="button" disabled={busy} onClick={() => void reviewAsset(asset, BRAND_ASSET_REVIEW_DECISION.rejected)}>{tTable("reject")}</Button>
        </> : null}
      </div>
    ) },
  ], [busy, canManage, locale, previewAsset, reviewAsset, t, tTable]);

  const searchValue = useCallback((asset: BrandAsset) => [asset.fileName, asset.kind, asset.contentType, asset.status, asset.sha256, asset.createdByName, asset.sourceUrl ?? "", asset.license ?? "", asset.rightsExpiresAt ?? "", asset.width ?? "", asset.height ?? "", asset.sizeBytes].join(" "), []);

  return (
    <section className="brandAssetLibrary" aria-labelledby={`${libraryId}-title`}>
      <header className="brandAssetLibrary__header">
        <div><h4 id={`${libraryId}-title`}>{t("title")}</h4><p>{t("description")}</p></div>
      </header>
      {canManage ? <form className="brandAssetLibrary__upload" onSubmit={(event) => void submitUpload(event)}>
        <FileField
          id={`${BRAND_ASSET_UI_IDS.filePrefix}${brandId}`}
          label={t("file")}
          accept={BRAND_ASSET_LIMITS.allowedMimeTypes.join(",")}
          required
          disabled={busy}
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <SelectField id={`${BRAND_ASSET_UI_IDS.kindPrefix}${brandId}`} label={t("kindLabel")} value={kind} disabled={busy} onChange={(event) => {
          const selectedKind = BRAND_ASSET_KINDS.find((value) => value === event.target.value);
          if (selectedKind) setKind(selectedKind);
        }}>
          {BRAND_ASSET_KINDS.map((value) => <option key={value} value={value}>{t(`kind.${value}`)}</option>)}
        </SelectField>
        <TextField id={`${BRAND_ASSET_UI_IDS.sourcePrefix}${brandId}`} label={t("sourceUrl")} type="url" value={sourceUrl} disabled={busy} onChange={(event) => setSourceUrl(event.target.value)} />
        <TextField id={`${BRAND_ASSET_UI_IDS.licensePrefix}${brandId}`} label={t("license")} value={license} maxLength={BRAND_ASSET_LIMITS.maximumLicenseCharacters} disabled={busy} onChange={(event) => setLicense(event.target.value)} />
        <TextField id={`${BRAND_ASSET_UI_IDS.rightsExpiryPrefix}${brandId}`} label={t("rightsExpiry")} type="date" value={rightsExpiresAt} disabled={busy} onChange={(event) => setRightsExpiresAt(event.target.value)} />
        <TextField id={`${BRAND_ASSET_UI_IDS.altTextPrefix}${brandId}`} label={t("altText")} value={altText} maxLength={BRAND_ASSET_LIMITS.maximumAltTextCharacters} disabled={busy} onChange={(event) => setAltText(event.target.value)} />
        <Button appearance="primary" type="submit" disabled={busy || !selectedFile}>{busy ? t("working") : t("upload")}</Button>
      </form> : null}
      {canManage ? <div className="brandAssetLibrary__reviewNote"><TextAreaField id={`${BRAND_ASSET_UI_IDS.reviewNotePrefix}${brandId}`} label={t("reviewNote")} value={reviewNote} maxLength={BRAND_ASSET_LIMITS.maximumAltTextCharacters} disabled={busy} onChange={(event) => setReviewNote(event.target.value)} /></div> : null}
      {pending ? <p className="brandAssetLibrary__state" role="status">{t("loading")}</p> : null}
      {hasError ? <p className="brandAssetLibrary__state brandAssetLibrary__state--error" role="alert">{t("error")}</p> : null}
      {notice ? <p className="brandAssetLibrary__state" role="status">{notice}</p> : null}
      {!pending && !hasError ? <DataTable
        id={libraryId}
        rows={assets}
        columns={columns}
        getRowId={(asset) => asset.id}
        searchLabel={t("filterAssets")}
        pageSizeLabel={tTable("pageSize")}
        emptyMessage={t("empty")}
        noMatchesMessage={tTable("noMatches")}
        searchValue={searchValue}
        locale={locale}
        initialSortColumnId="createdAt"
      /> : null}
      {preview ? <section className="brandAssetLibrary__preview" aria-label={t("previewRegion")}>
        <header><h5>{preview.asset.fileName}</h5><Button appearance="quiet" type="button" onClick={() => setPreview(null)}>{t("closePreview")}</Button></header>
        <Image
          src={preview.url}
          alt={preview.asset.altText ?? preview.asset.fileName}
          width={preview.asset.width ?? 640}
          height={preview.asset.height ?? 480}
          unoptimized
        />
      </section> : null}
    </section>
  );
}
