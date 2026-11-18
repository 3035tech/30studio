"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { TextAreaField } from "@/components/ui/field";
import { useSystemFeedback } from "@/components/ui/system-feedback";
import { CONTENT_LIMITS, CONTENT_MEDIA_API_PATHS, CONTENT_MEDIA_CAROUSEL, CONTENT_MEDIA_EXPORTS, CONTENT_MEDIA_GENERATION_MODE, CONTENT_MEDIA_REVIEW_DECISIONS, CONTENT_MEDIA_STATUS, CONTENT_MEDIA_TEMPLATE, CONTENT_MEDIA_WORKER, type SocialPlatform } from "@/lib/constants";
import { contentMediaGenerationResponseSchema, contentMediaResponseSchema } from "@/lib/validation/calendar";

type MediaState = {
  versionId: string | null;
  items: Array<ReturnType<typeof contentMediaResponseSchema.parse>["data"][number]>;
  canManage: boolean;
  canReview: boolean;
  error: boolean;
};
type MediaItem = ReturnType<typeof contentMediaResponseSchema.parse>["data"][number];

function groupMediaItems(items: MediaItem[]) {
  const groups = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = item.carouselId ?? item.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].map((pages) => pages.sort((left, right) => (left.pageNumber ?? 1) - (right.pageNumber ?? 1)));
}

const INITIAL_STATE: MediaState = { versionId: null, items: [], canManage: false, canReview: false, error: false };

function splitIntoCarouselPages(copy: string) {
  const words = copy.trim().split(/\s+/u).filter(Boolean);
  const pages = Array.from({ length: CONTENT_MEDIA_CAROUSEL.pageCount }, () => [] as string[]);
  words.forEach((word, index) => pages[Math.min(pages.length - 1, Math.floor(index * pages.length / Math.max(words.length, 1)))]!.push(word));
  return pages.map((page) => page.join(" ") || copy.trim());
}

export function ContentMediaPanel({ itemId, versionId, versionNumber, variantCopy, platform }: { itemId: string; versionId: string | null; versionNumber: number | null; variantCopy: string; platform: SocialPlatform }) {
  const t = useTranslations("contentMedia");
  const showFeedback = useSystemFeedback();
  const [state, setState] = useState(INITIAL_STATE);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [pageCopies, setPageCopies] = useState(() => splitIntoCarouselPages(variantCopy));
  const exportSize = CONTENT_MEDIA_EXPORTS[platform];

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
  const mediaGroups = groupMediaItems(state.items);
  const pending = Boolean(versionId && state.versionId !== versionId);
  useEffect(() => {
    if (!processing) return;
    const timer = window.setTimeout(() => setRefreshIndex((current) => current + 1), CONTENT_MEDIA_WORKER.pollIntervalMilliseconds);
    return () => window.clearTimeout(timer);
  }, [processing, refreshIndex]);

  async function generateImage(mode: typeof CONTENT_MEDIA_GENERATION_MODE[keyof typeof CONTENT_MEDIA_GENERATION_MODE]) {
    if (!versionId || busyId) return;
    setBusyId(mode);
    try {
      const response = await fetch(CONTENT_MEDIA_API_PATHS.collection(itemId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentVersionId: versionId, idempotencyKey: crypto.randomUUID(), mode, ...(mode === CONTENT_MEDIA_GENERATION_MODE.carousel ? { pageCopies } : {}) }),
      });
      if (response.status === 503) {
        showFeedback("error", t("generationUnavailable"));
        return;
      }
      if (response.status === 409) {
        showFeedback("error", t("generationLimit"));
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !contentMediaGenerationResponseSchema.safeParse(payload).success) throw new Error("Image generation request failed.");
      showFeedback("success", t(mode === CONTENT_MEDIA_GENERATION_MODE.carousel ? "carouselQueued" : "jobQueued"));
      setRefreshIndex((current) => current + 1);
    } catch {
      showFeedback("error", t("generationError"));
    } finally {
      setBusyId("");
    }
  }

  async function reviewImage(mediaId: string, decision: typeof CONTENT_MEDIA_REVIEW_DECISIONS[number]) {
    setBusyId(mediaId);
    try {
      const response = await fetch(CONTENT_MEDIA_API_PATHS.review(itemId, mediaId), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote.trim() || null }),
      });
      if (!response.ok) throw new Error("Image review failed.");
      showFeedback(decision === CONTENT_MEDIA_STATUS.approved ? "success" : "info", t(decision === CONTENT_MEDIA_STATUS.approved ? "approved" : "rejected"));
      setReviewNote("");
      setRefreshIndex((current) => current + 1);
    } catch {
      showFeedback("error", t("reviewError"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="contentMediaPanel" aria-labelledby={`content-media-title-${itemId}`}>
      <header className="contentMediaPanel__header">
        <div><h3 id={`content-media-title-${itemId}`}>{t("title")}</h3><p>{t("versionLabel", { version: versionNumber ?? 0 })}<span className="contentMediaPanel__exportSize">{t("dimensions", { width: exportSize.width, height: exportSize.height })}</span></p></div>
      </header>
      {state.canManage && versionId ? <Disclosure title={t("editCarouselCopy")} className="contentMediaPanel__copyDisclosure">
        <div className="contentMediaPanel__pageCopyEditor">
          <p>{t("pageCopyHelp", { width: exportSize.width, height: exportSize.height })}</p>
          <div className="contentMediaPanel__pageCopyGrid">
            {pageCopies.map((copy, index) => <TextAreaField key={index} className="contentMediaPanel__pageCopyField" id={`content-media-page-copy-${itemId}-${index + 1}`} label={t("editablePageCopy", { page: index + 1 })} value={copy} maxLength={CONTENT_MEDIA_TEMPLATE.maximumCarouselPageCharacters} onChange={(event) => setPageCopies((current) => current.map((page, pageIndex) => pageIndex === index ? event.target.value : page))} />)}
          </div>
        </div>
      </Disclosure> : null}
      {state.canManage && versionId ? <div className="contentMediaPanel__actions" role="group" aria-label={t("generationActions")}>
        <Button type="button" disabled={Boolean(busyId) || processing || pageCopies.some((copy) => !copy.trim())} onClick={() => void generateImage(CONTENT_MEDIA_GENERATION_MODE.carousel)}>
          {busyId === CONTENT_MEDIA_GENERATION_MODE.carousel ? t("queueing") : t("generateCarousel")}
        </Button>
        <Button appearance="quiet" type="button" disabled={Boolean(busyId) || processing} onClick={() => void generateImage(CONTENT_MEDIA_GENERATION_MODE.textCard)}>
          {busyId === CONTENT_MEDIA_GENERATION_MODE.textCard ? t("queueing") : t("generateTextCard")}
        </Button>
        <Button appearance="quiet" type="button" disabled={Boolean(busyId) || processing} onClick={() => void generateImage(CONTENT_MEDIA_GENERATION_MODE.aiImage)}>
          <ImagePlus aria-hidden="true" size={16} />{busyId === CONTENT_MEDIA_GENERATION_MODE.aiImage ? t("queueing") : t("generate")}
        </Button>
      </div> : null}
      <p className="contentMediaPanel__privacy">{t("privacy")}</p>
      {pending ? <p className="contentMediaPanel__empty" role="status">{t("loading")}</p> : null}
      {state.error ? <p className="contentMediaPanel__notice" role="alert">{t("loadError")}</p> : null}
      {!versionId ? <p className="contentMediaPanel__empty">{t("saveCopyFirst")}</p> : null}
      {versionId && !pending && !state.error && state.items.length === 0 ? <p className="contentMediaPanel__empty">{t("empty")}</p> : null}
      {state.canReview && state.items.some((item) => item.status === CONTENT_MEDIA_STATUS.pendingReview) ? <TextAreaField id={`content-media-review-note-${itemId}`} label={t("reviewNote")} value={reviewNote} maxLength={CONTENT_LIMITS.canonicalCopyCharacters} onChange={(event) => setReviewNote(event.target.value)} /> : null}
      <ul className="contentMediaPanel__grid" aria-busy={pending || processing}>
        {mediaGroups.map((pages) => {
          const item = pages[0]!;
          const isCarousel = Boolean(item.carouselId);
          const canReviewGroup = state.canReview && pages.length === (item.pageCount ?? 1) && pages.every((page) => page.status === CONTENT_MEDIA_STATUS.pendingReview);
          return <li className="contentMediaPanel__card" key={item.carouselId ?? item.id}>
            {isCarousel ? <strong className="contentMediaPanel__groupTitle">{t("carousel", { count: item.pageCount ?? pages.length })}</strong> : null}
            <div className={isCarousel ? "contentMediaPanel__carouselPages" : undefined}>
              {pages.map((page) => <div className="contentMediaPanel__page" key={page.id}>
                {page.previewUrl ? <Image src={page.previewUrl} alt={isCarousel ? t("pageAlt", { page: page.pageNumber ?? 1 }) : page.fileName} width={page.width ?? 640} height={page.height ?? 640} style={{ aspectRatio: `${page.width ?? 1} / ${page.height ?? 1}` }} unoptimized /> : <div className="contentMediaPanel__placeholder" style={{ aspectRatio: isCarousel ? `${exportSize.width} / ${exportSize.height}` : "1" }} role="status">{t(page.status === CONTENT_MEDIA_STATUS.failed ? "generationFailed" : "processing")}</div>}
                {isCarousel ? <span className="contentMediaPanel__pageNumber">{t("pageNumber", { page: page.pageNumber ?? 1, count: page.pageCount ?? pages.length })}</span> : null}
                {!isCarousel ? <div className="contentMediaPanel__meta"><strong>{t(`statuses.${page.status}`)}</strong><span>{page.width && page.height ? t("dimensions", { width: page.width, height: page.height }) : page.createdByName}</span></div> : null}
              </div>)}
            </div>
            {isCarousel ? <div className="contentMediaPanel__meta"><strong>{t(`statuses.${pages.every((page) => page.status === CONTENT_MEDIA_STATUS.approved) ? CONTENT_MEDIA_STATUS.approved : pages.some((page) => page.status === CONTENT_MEDIA_STATUS.failed) ? CONTENT_MEDIA_STATUS.failed : pages.every((page) => page.status === CONTENT_MEDIA_STATUS.pendingReview) ? CONTENT_MEDIA_STATUS.pendingReview : CONTENT_MEDIA_STATUS.processing}`)}</strong></div> : null}
            {canReviewGroup ? <div className="contentMediaPanel__actions">
              <Button type="button" disabled={Boolean(busyId)} onClick={() => void reviewImage(item.id, CONTENT_MEDIA_STATUS.approved)}>{busyId === item.id ? t("reviewing") : t(isCarousel ? "approveCarousel" : "approve")}</Button>
              <Button appearance="quiet" type="button" disabled={Boolean(busyId)} onClick={() => void reviewImage(item.id, CONTENT_MEDIA_STATUS.rejected)}>{t(isCarousel ? "rejectCarousel" : "reject")}</Button>
            </div> : null}
          </li>;
        })}
      </ul>
    </section>
  );
}
