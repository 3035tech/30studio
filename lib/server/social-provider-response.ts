import "server-only";
import { SOCIAL_CONNECTION } from "@/lib/constants";

export async function readBoundedSocialProviderResponse(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > SOCIAL_CONNECTION.maximumProviderResponseBytes) {
    await response.body?.cancel();
    throw new Error("Social provider response exceeded its size limit.");
  }
  if (!response.body) throw new Error("Social provider returned an invalid response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > SOCIAL_CONNECTION.maximumProviderResponseBytes) {
      await reader.cancel();
      throw new Error("Social provider response exceeded its size limit.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
