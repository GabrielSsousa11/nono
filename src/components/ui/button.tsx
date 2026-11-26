import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "solid" | "outline" | "ghost" | "light";

const base =
  "group relative inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden text-sm font-semibold tracking-[0.02em] transition-[color,background-color,border-color,transform] duration-500 ease-silk active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  solid: "px-7 bg-olive text-ivory hover:bg-onyx rounded-full",
  outline: "px-7 border border-onyx/30 text-onyx hover:border-onyx rounded-full",
  ghost: "text-onyx underline decoration-gold decoration-1 underline-offset-[6px] hover:decoration-onyx min-h-10",
  light: "px-7 bg-ivory text-onyx hover:bg-champagne rounded-full",
};

export function buttonClass(variant: Variant = "solid", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function ButtonLink({
  variant = "solid",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; children: ReactNode }) {
  return (
    <Link className={buttonClass(variant, className)} {...props}>
      {children}
    </Link>
  );
}
