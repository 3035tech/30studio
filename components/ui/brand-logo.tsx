import Image from "next/image";
import { BRAND_ASSETS, PRODUCT } from "@/lib/constants";

type BrandLogoProps = { priority?: boolean; className?: string };

export function BrandLogo({ priority = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`brandLogo ${className}`.trim()} role="img" aria-label={PRODUCT.name}>
      <Image className="brandLogo__light" src={BRAND_ASSETS.logoOnLight} width={1100} height={270} alt="" priority={priority} />
      <Image className="brandLogo__dark" src={BRAND_ASSETS.logoOnDark} width={1100} height={270} alt="" priority={priority} />
    </span>
  );
}
