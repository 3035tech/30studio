"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { CONTENT_LIMITS, CONTENT_MEDIA_API_PATHS, CONTENT_MEDIA_REVIEW_DECISIONS, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_WORKER } from "@/lib/constants";
import { contentMediaGenerationResponseSchema, contentMediaResponseSchema } from "@/lib/validation/calendar";

type MediaState = {
  versionId: string | null;
  items: Array<ReturnType<typeof contentMediaResponseSchema.parse>["data"][number]>;
  canManage: boolean;
  canReview: boolean;
  error: boolean;
};

const INITIAL_STATE: MediaState = { versionId: null, items: [], canManage: false, canReview: false, error: false };

export function ContentMediaPanel({ itemId, versionId, versionNumber }: { itemId: string; versionId: string | null; versionNumber: number | null }) {
  const t = useTranslations("contentMedia");
  const [state, setState] = useState(INITIAL_STATE);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (!versionId) {
      return;
    }
    const currentVersionId = versionId;
    const controller = new AbortController();
    async function loadAssets() {
      try {
        const query = new URLSearchParams({ versionId: currentVersionId });
        const response = await fetch(`${CONTENT_MEDIA_API_PATHS.collection(itemId)}?${query.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        const parsed = contentMediaResponseSchema.safeParse(payload);
        if (!response.ok || !parsed.success) throw new Error("Media request failed.");
        setState({ versionId: currentVersionId, items: parsed.data.data, canManage: parsed.data.canManage, canReview: parsed.data.canReview, error: false });
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => ({ ...current, versionId: currentVersionId, error: true }));
      }
    }
    void loadAssets();
    return () => controller.abort();
  }, [itemId, refreshIndex, versionId]);

  const processing = state.items.some((item) => item.status === CONTENT_MEDIA_STATUS.queued || item.status === CONTENT_MEDIA_STATUS.processing);
  const pending = Boolean(versionId && state.versionId !== versionId);
  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => setRefreshIndex((current) => current + 1), CONTENT_MEDIA_WORKER.pollIntervalMilliseconds);
    return () => window.clearTimeout(timer);
  }, [processing, refreshIndex]);

  async function generateImage() {
    if (!versionId || busyId) return;
    setBusyId(CONTENT_MEDIA_STATUS.queued);
    setNotice("");
    try {
      const response = await fetch(CONTENT_MEDIA_API_PATHS.collection(itemId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentVersionId: versionId, idempotencyKey: crypto.randomUUID() }),
      });
      if (response.status === 503) {
        setNotice(t("generationUnavailable"));
        return;
      }
      if (response.status === 409) {
        setNotice(t("generationLimit"));
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !contentMediaGenerationResponseSchema.safeParse(payload).success) throw new Error("Image generation request failed.");
      setNotice(t("jobQueued"));
      setRefreshIndex((current) => current + 1);
    } catch {
      setNotice(t("generationError"));
    } finally {
      setBusyId("");
    }
  }

  async function reviewImage(mediaId: string, decision: typeof CONTENT_MEDIA_REVIEW_DECISIONS[number]) {
    setBusyId(mediaId);
    setNotice("");
    try {
      const response = await fetch(CONTENT_MEDIA_API_PATHS.review(itemId, mediaId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote.trim() || null }),
      });
      if (!response.ok) throw new Error("Image review failed.");
      setNotice(decision === CONTENT_MEDIA_STATUS.approved ? t("approved") : t("rejected"));
      setReviewNote("");
      setRefreshIndex((current) => current + 1);
    } catch {
      setNotice(t("reviewError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="contentMediaPanel" aria-labelledby={`content-media-title-${itemId}`}>
      <header className="contentMediaPanel__header">
        <div><h3 id={`content-media-title-${itemId}`}>{t("title")}</h3><p>{t("versionLabel", { version: versionNumber ?? 0 })}</p></div>
        {state.canManage && versionId ? <Button appearance="quiet" type="button" disabled={Boolean(busyId) || processing} onClick={() => void generateImage()}>
          <ImagePlus aria-hidden="true" size={16} />{busyId === CONTENT_MEDIA_STATUS.queued ? t("queueing") : t("generate")}
        </Button> : null}
      </header>
      <p className="contentMediaPanel__privacy">{t("privacy")}</p>
      {notice ? <p className="contentMediaPanel__notice" role="status">{notice}</p> : null}
      {pending ? <p className="contentMediaPanel__empty" role="status">{t("loading")}</p> : null}
      {state.error ? <p className="contentMediaPanel__notice" role="alert">{t("loadError")}</p> : null}
      {!versionId ? <p className="contentMediaPanel__empty">{t("saveCopyFirst")}</p> : null}
      {versionId && !pending && !state.error && state.items.length === 0 ? <p className="contentMediaPanel__empty">{t("empty")}</p> : null}
      {state.canReview && state.items.some((item) => item.status === CONTENT_MEDIA_STATUS.pendingReview) ? <TextAreaField id={`content-media-review-note-${itemId}`} label={t("reviewNote")} value={reviewNote} maxLength={CONTENT_LIMITS.canonicalCopyCharacters} onChange={(event) => setReviewNote(event.target.value)} /> : null}
      <ul className="contentMediaPanel__grid" aria-busy={pending || processing}>
        {state.items.map((item) => <li className="contentMediaPanel__card" key={item.id}>
          {item.previewUrl ? <Image src={item.previewUrl} alt={item.fileName} width={item.width ?? 640} height={item.height ?? 640} unoptimized /> : <div className="contentMediaPanel__placeholder" role="status">{t(item.status === CONTENT_MEDIA_STATUS.failed ? "generationFailed" : "processing")}</div>}
          <div className="contentMediaPanel__meta"><strong>{t(`statuses.${item.status}`)}</strong><span>{item.width && item.height ? t("dimensions", { width: item.width, height: item.height }) : item.createdByName}</span></div>
          {state.canReview && item.status === CONTENT_MEDIA_STATUS.pendingReview ? <div className="contentMediaPanel__actions">
            <Button type="button" disabled={Boolean(busyId)} onClick={() => void reviewImage(item.id, CONTENT_MEDIA_STATUS.approved)}>{busyId === item.id ? t("reviewing") : t("approve")}</Button>
            <Button appearance="quiet" type="button" disabled={Boolean(busyId)} onClick={() => void reviewImage(item.id, CONTENT_MEDIA_STATUS.rejected)}>{t("reject")}</Button>
          </div> : null}
        </li>)}
      </ul>
    </section>
  );
}
