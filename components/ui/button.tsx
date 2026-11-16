"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  appearance?: "primary" | "quiet" | "danger";
  asChild?: boolean;
};

export function Button({ children, appearance = "primary", asChild = false, className = "", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  const appearanceClass = appearance === "primary"
    ? "bg-studio-primary text-white shadow-sm hover:-translate-y-px hover:bg-studio-primary/92 hover:shadow-md active:translate-y-0 active:shadow-sm focus-visible:outline-studio-primary"
    : appearance === "danger"
      ? "bg-red-700 text-white shadow-sm hover:-translate-y-px hover:bg-red-800 hover:shadow-md active:translate-y-0 focus-visible:outline-red-700"
      : "bg-transparent text-studio-dark hover:bg-studio-primary-soft focus-visible:outline-studio-primary";
  return (
    <Component className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold tracking-[-0.01em] transition-[background,color,border-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 ${appearanceClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
