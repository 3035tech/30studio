"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  appearance?: "primary" | "quiet";
  asChild?: boolean;
};

export function Button({ children, appearance = "primary", asChild = false, className = "", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const appearanceClass = appearance === "primary"
    ? "bg-studio-primary text-white hover:bg-studio-primary/90 focus-visible:outline-studio-primary"
    : "bg-transparent text-studio-dark hover:bg-studio-secondary/10 focus-visible:outline-studio-primary";
  return (
    <Component className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 ${appearanceClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
