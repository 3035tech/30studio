import { Linkedin } from "lucide-react";
import { siFacebook, siInstagram, siPinterest, siThreads, siTiktok, siX, siYoutube, type SimpleIcon } from "simple-icons";
import type { SocialPlatform } from "@/lib/constants";

const PLATFORM_ICONS: Record<Exclude<SocialPlatform, "linkedin">, SimpleIcon> = {
  facebook: siFacebook,
  instagram: siInstagram,
  tiktok: siTiktok,
  x: siX,
  youtube: siYoutube,
  threads: siThreads,
  pinterest: siPinterest,
};

export function SocialPlatformIcon({ platform, size = 18, className = "" }: { platform: SocialPlatform; size?: number; className?: string }) {
  if (platform === "linkedin") return <Linkedin aria-hidden="true" className={className} size={size} />;
  const icon = PLATFORM_ICONS[platform];
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={icon.path} /></svg>;
}
