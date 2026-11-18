"use client";

import Image from "next/image";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { BrandKitEditor } from "@/components/brand/brand-kit-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogCancel, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileField, SelectField, TextField } from "@/components/ui/field";
import { BRAND_ASSET_LIMITS, BRAND_LIMITS, BRAND_SEGMENTS } from "@/lib/constants";
import type { BrandListItem } from "@/lib/validation/brands";

type Props = {
  brands: readonly BrandListItem[];
  canManage: boolean;
  busy: boolean;
  createOpen: boolean;
  editingBrandId: string | null;
  archivingBrandId: string | null;
  activeBrandKitId: string | null;
  createDisabled: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onEditingBrandChange: (brandId: string | null) => void;
  onArchivingBrandChange: (brandId: string | null) => void;
  onActiveBrandKitChange: (brandId: string | null) => void;
  onCreateBrand: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateBrand: (event: FormEvent<HTMLFormElement>, brandId: string) => void;
  onArchiveBrand: (brandId: string) => void;
};

export function BrandManagementDialogs({
  brands, canManage, busy, createOpen, editingBrandId, archivingBrandId, activeBrandKitId, createDisabled,
  onCreateOpenChange, onEditingBrandChange, onArchivingBrandChange, onActiveBrandKitChange,
  onCreateBrand, onUpdateBrand, onArchiveBrand,
}: Props) {
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");
  const tPortfolio = useTranslations("portfolio");
  const tBrandKit = useTranslations("brandKit");
  const activeBrands = brands.filter((brand) => brand.isActive);
  const editingBrand = activeBrands.find((brand) => brand.id === editingBrandId);
  const archivingBrand = activeBrands.find((brand) => brand.id === archivingBrandId);
  const brandKit = activeBrands.find((brand) => brand.id === activeBrandKitId);

  return <>
    <Dialog open={createOpen && canManage} onOpenChange={(open) => { if (!busy) onCreateOpenChange(open); }}>
      <DialogContent className="brandFormDialog" aria-labelledby="brand-create-title" aria-describedby="brand-create-description">
        <DialogHeader><DialogTitle id="brand-create-title">{tPortfolio("createBrandDialogTitle")}</DialogTitle><DialogDescription id="brand-create-description">{tPortfolio("createDescription")}</DialogDescription></DialogHeader>
        <form className="brandCreate__form" onSubmit={onCreateBrand}>
          <TextField id="brandName" name="brandName" label={tWorkspace("brandName")} maxLength={BRAND_LIMITS.nameCharacters} required />
          <TextField id="brandDescription" name="brandDescription" label={tWorkspace("brandDescription")} maxLength={BRAND_LIMITS.descriptionCharacters} />
          <SelectField id="brandIndustry" name="brandIndustry" label={tWorkspace("brandIndustry")} defaultValue="" required>
            <option value="" disabled>{tPortfolio("selectSegment")}</option>
            {BRAND_SEGMENTS.map((segment) => <option key={segment} value={segment}>{tPortfolio(`segments.${segment}`)}</option>)}
          </SelectField>
          <TextField id="brandWebsite" name="brandWebsite" type="url" label={tPortfolio("websiteUrl")} placeholder="https://" maxLength={BRAND_LIMITS.websiteUrlCharacters} />
          <FileField id="brandLogo" name="brandLogo" label={tPortfolio("brandLogo")} helpText={tPortfolio("brandLogoHelp")} accept={BRAND_ASSET_LIMITS.allowedMimeTypes.join(",")} />
          <DialogFooter className="brandCollection__editorActions"><DialogCancel disabled={busy}>{tPortfolio("cancel")}</DialogCancel><Button type="submit" disabled={createDisabled}>{busy ? tAuth("working") : tWorkspace("addBrand")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(editingBrand)} onOpenChange={(open) => { if (!open && !busy) onEditingBrandChange(null); }}>
      {editingBrand ? <DialogContent className="brandFormDialog" aria-labelledby="brand-edit-title">
        <DialogHeader><DialogTitle id="brand-edit-title">{tPortfolio("editBrandDialogTitle")}</DialogTitle><DialogDescription>{editingBrand.name}</DialogDescription></DialogHeader>
        <form className="brandCreate__form" onSubmit={(event) => onUpdateBrand(event, editingBrand.id)}>
          <TextField id="brand-edit-name" name="name" label={tPortfolio("brandName")} defaultValue={editingBrand.name} maxLength={BRAND_LIMITS.nameCharacters} required />
          <TextField id="brand-edit-description" name="description" label={tPortfolio("brandDescription")} defaultValue={editingBrand.description ?? ""} maxLength={BRAND_LIMITS.descriptionCharacters} />
          <SelectField id="brand-edit-industry" name="industry" label={tPortfolio("industry")} defaultValue={editingBrand.industry ?? "other"}>
            {editingBrand.industry && !BRAND_SEGMENTS.some((segment) => segment === editingBrand.industry) ? <option value={editingBrand.industry}>{editingBrand.industry}</option> : null}
            {BRAND_SEGMENTS.map((segment) => <option key={segment} value={segment}>{tPortfolio(`segments.${segment}`)}</option>)}
          </SelectField>
          <TextField id="brand-edit-website" name="websiteUrl" type="url" label={tPortfolio("websiteUrl")} defaultValue={editingBrand.websiteUrl ?? ""} maxLength={BRAND_LIMITS.websiteUrlCharacters} />
          {editingBrand.logoAssetId ? <div className="brandEditLogo"><span className="brandEditLogo__preview">{editingBrand.logoAssetStatus ? <Image src={`/api/brands/${editingBrand.id}/logo/${editingBrand.logoAssetId}`} alt="" fill sizes="72px" unoptimized /> : null}</span><span><strong>{tPortfolio("currentBrandLogo")}</strong>{editingBrand.logoAssetStatus === "pending_review" ? <small>{tPortfolio("brandLogoPending")}</small> : null}</span></div> : null}
          <FileField id="brand-edit-logo" name="brandLogo" label={tPortfolio("replaceBrandLogo")} helpText={tPortfolio("brandLogoHelp")} accept={BRAND_ASSET_LIMITS.allowedMimeTypes.join(",")} />
          <DialogFooter className="brandCollection__editorActions"><DialogCancel disabled={busy}>{tPortfolio("cancel")}</DialogCancel><Button type="submit" disabled={busy}>{busy ? tAuth("working") : tPortfolio("saveChanges")}</Button></DialogFooter>
        </form>
      </DialogContent> : null}
    </Dialog>

    <Dialog open={Boolean(archivingBrand)} onOpenChange={(open) => { if (!open && !busy) onArchivingBrandChange(null); }}>
      {archivingBrand ? <DialogContent aria-labelledby="brand-archive-title" aria-describedby="brand-archive-description">
        <DialogHeader><DialogTitle id="brand-archive-title">{tPortfolio("archiveBrand")}</DialogTitle><DialogDescription id="brand-archive-description">{tPortfolio("archiveConfirmation", { brand: archivingBrand.name })}</DialogDescription></DialogHeader>
        <DialogFooter className="brandCollection__editorActions"><DialogCancel disabled={busy}>{tPortfolio("cancel")}</DialogCancel><Button appearance="danger" type="button" disabled={busy} onClick={() => onArchiveBrand(archivingBrand.id)}>{busy ? tAuth("working") : tPortfolio("confirmArchive")}</Button></DialogFooter>
      </DialogContent> : null}
    </Dialog>

    <Dialog open={Boolean(brandKit)} onOpenChange={(open) => { if (!open && !busy) onActiveBrandKitChange(null); }}>
      {brandKit ? <DialogContent className="brandKitDialog" aria-labelledby="brand-kit-dialog-title" aria-describedby="brand-kit-dialog-description">
        <DialogHeader><DialogTitle id="brand-kit-dialog-title">{tBrandKit("title", { brand: brandKit.name })}</DialogTitle><DialogDescription id="brand-kit-dialog-description">{tBrandKit("description")}</DialogDescription></DialogHeader>
        <BrandKitEditor brandId={brandKit.id} brandName={brandKit.name} showHeader={false} />
        <DialogFooter><DialogCancel disabled={busy}>{tPortfolio("closeBrandKit")}</DialogCancel></DialogFooter>
      </DialogContent> : null}
    </Dialog>
  </>;
}
