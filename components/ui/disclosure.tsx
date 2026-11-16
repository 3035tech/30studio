"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type DisclosureProps = { title: string; children: ReactNode; className?: string };

export function Disclosure({ title, children, className }: DisclosureProps) {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={className ? `uiDisclosure ${className}` : "uiDisclosure"}>
      <Button appearance="quiet" className="uiDisclosure__trigger" type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setIsOpen((current) => !current)}>
        <span>{title}</span>
        <ChevronDown aria-hidden="true" className={isOpen ? "uiDisclosure__icon is-open" : "uiDisclosure__icon"} size={18} />
      </Button>
      {isOpen ? <div className="uiDisclosure__content" id={panelId}>{children}</div> : null}
    </section>
  );
}
