import type { SocialPlatform } from "@/lib/constants";
import { linkedin } from "./linkedin";
import { facebook, instagram, threads } from "./meta";
import { pinterest } from "./pinterest";
import { tiktok } from "./tiktok";
import { x } from "./x";
import { youtube } from "./youtube";
import type { ProviderConfig } from "../types";

export const PROVIDERS: Record<SocialPlatform, ProviderConfig> = {
  linkedin, instagram, facebook, tiktok, x, youtube, threads, pinterest,
};
