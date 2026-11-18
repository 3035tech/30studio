"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ children, className = "", ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  const t = useTranslations("dialog");

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="studioDialog__overlay" />
      <DialogPrimitive.Content className={`studioDialog__content ${className}`.trim()} {...props}>
        <DialogPrimitive.Close asChild>
          <Button appearance="quiet" className="studioDialog__closeButton" type="button" aria-label={t("close")}>
            <X aria-hidden="true" size={18} />
          </Button>
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <header className="studioDialog__header">{children}</header>;
}

export function DialogTitle(props: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className="studioDialog__title" {...props} />;
}

export function DialogDescription(props: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className="studioDialog__description" {...props} />;
}

export function DialogFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <footer className={`studioDialog__footer ${className}`.trim()}>{children}</footer>;
}

type DialogCancelProps = Omit<ComponentProps<typeof Button>, "appearance" | "children" | "type"> & { children?: ReactNode };

export function DialogCancel({ children, className = "", ...props }: DialogCancelProps) {
  const t = useTranslations("dialog");

  return (
    <DialogPrimitive.Close asChild>
      <Button appearance="quiet" className={className} type="button" {...props}>
        {children ?? t("cancel")}
      </Button>
    </DialogPrimitive.Close>
  );
}
