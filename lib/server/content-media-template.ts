import "server-only";
import sharp from "sharp";
import { CONTENT_MEDIA_TEMPLATE } from "@/lib/constants";
import type { BrandKitContent } from "@/lib/validation/brand-kits";

export type TextCardInput = {
  title: string;
  copy: string;
  brandKit: BrandKitContent | null;
  pageNumber?: number;
  pageCount?: number;
  exportWidth?: number;
  exportHeight?: number;
};

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function wrapText(value: string, maxCharacters: number, maxLines: number) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let truncated = false;
  for (const word of words) {
    const parts = word.match(new RegExp(`.{1,${maxCharacters}}`, "gu")) ?? [word];
    for (const part of parts) {
      const nextLine = line ? `${line} ${part}` : part;
      if (Array.from(nextLine).length <= maxCharacters) {
        line = nextLine;
        continue;
      }
      lines.push(line);
      line = part;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length > 0) {
    const finalLine = lines.at(-1)!;
    lines[lines.length - 1] = `${Array.from(finalLine).slice(0, maxCharacters - 1).join("").trimEnd()}…`;
  }
  return lines;
}

function createTextElements(lines: string[], x: number, y: number, lineHeight: number) {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</text>`).join("");
}

export function buildTextCardSvg(input: TextCardInput) {
  const width = input.exportWidth ?? CONTENT_MEDIA_TEMPLATE.width;
  const height = input.exportHeight ?? CONTENT_MEDIA_TEMPLATE.height;
  const title = input.title.trim();
  const copy = input.copy.trim();
  if (!title || Array.from(title).length > CONTENT_MEDIA_TEMPLATE.maximumTitleCharacters) throw new Error("Text card title is outside its size limit.");
  if (!copy) throw new Error("Text card copy is required.");
  const colors = input.brandKit?.colors ?? [];
  const accentColor = colors.find((color) => /^#[\da-fA-F]{6}$/u.test(color)) ?? CONTENT_MEDIA_TEMPLATE.neutralAccent;
  const backgroundColor = CONTENT_MEDIA_TEMPLATE.neutralBackground;
  const foregroundColor = CONTENT_MEDIA_TEMPLATE.neutralForeground;
  const configuredFont = input.brandKit?.fontFamilies[0]?.trim();
  const fontFamily = configuredFont && CONTENT_MEDIA_TEMPLATE.fontFamilyPattern.test(configuredFont) ? configuredFont : "Arial";
  const unit = Math.min(width, height);
  const scale = unit / CONTENT_MEDIA_TEMPLATE.width;
  const titleFontSize = 64 * scale;
  const copyFontSize = 34 * scale;
  const titleLineHeight = 82 * scale;
  const copyLineHeight = 52 * scale;
  const titleCharactersPerLine = Math.max(12, Math.floor((width * 0.78) / (titleFontSize * 0.58)));
  const copyCharactersPerLine = Math.max(16, Math.floor((width * 0.76) / (copyFontSize * 0.55)));
  const titleLines = wrapText(title, titleCharactersPerLine, CONTENT_MEDIA_TEMPLATE.maximumTitleLines);
  const excerpt = Array.from(copy).slice(0, CONTENT_MEDIA_TEMPLATE.maximumCopyExcerptCharacters).join("") + (Array.from(copy).length > CONTENT_MEDIA_TEMPLATE.maximumCopyExcerptCharacters ? "…" : "");
  const copyLines = wrapText(excerpt, copyCharactersPerLine, Math.max(CONTENT_MEDIA_TEMPLATE.maximumCopyLines, Math.floor((height * 0.28) / copyLineHeight)));
  const titleHeight = titleLines.length * titleLineHeight;
  const copyHeight = copyLines.length * copyLineHeight;
  const contentGap = 42 * scale;
  const contentHeight = titleHeight + contentGap + copyHeight;
  const contentStartY = Math.max(unit * 0.26, (height - contentHeight) / 2);
  const titleStartY = contentStartY + titleFontSize;
  const copyStartY = contentStartY + titleHeight + contentGap + copyFontSize;
  const left = width * 0.12;
  const accentTop = height * 0.12;
  const svg = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${width}" height="${height}" fill="${backgroundColor}"/>`,
    `<rect x="${left}" y="${accentTop}" width="${width * 0.14}" height="${12 * scale}" rx="${6 * scale}" fill="${accentColor}"/>`,
    `<path d="M${left} ${contentStartY - 28 * scale}h${6 * scale}v${contentHeight + 56 * scale}h-${6 * scale}z" fill="${accentColor}"/>`,
    `<g fill="${foregroundColor}" font-family="${escapeXml(fontFamily)}, sans-serif" font-size="${titleFontSize}" font-weight="700">`,
    createTextElements(titleLines, left + 40 * scale, titleStartY, titleLineHeight),
    `</g><g fill="${foregroundColor}" font-family="${escapeXml(fontFamily)}, sans-serif" font-size="${copyFontSize}" font-weight="400">`,
    createTextElements(copyLines, left + 42 * scale, copyStartY, copyLineHeight),
    ...(input.pageNumber && input.pageCount ? [`<text x="${width * 0.92}" y="${height * 0.94}" text-anchor="end" fill="${foregroundColor}" font-family="${escapeXml(fontFamily)}, sans-serif" font-size="${24 * scale}">${input.pageNumber} / ${input.pageCount}</text>`] : []),
    "</g></svg>",
  ].join("");
  return svg;
}

export async function renderTextCard(input: TextCardInput) {
  return sharp(Buffer.from(buildTextCardSvg(input))).png().toBuffer();
}
