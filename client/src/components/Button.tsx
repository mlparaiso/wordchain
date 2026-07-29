import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-chain-yellow text-chain-locked shadow-[0_4px_0_#e0b800] active:shadow-[0_1px_0_#e0b800] active:translate-y-[3px]",
  secondary:
    "bg-white text-chain-locked shadow-[0_4px_0_#cccccc] active:shadow-[0_1px_0_#cccccc] active:translate-y-[3px]",
  outline: "bg-white/20 border-2 border-white text-white shadow-none active:bg-white/30",
  ghost: "bg-transparent text-white/80 underline shadow-none",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-1 text-sm",
  md: "px-6 py-3",
};

const DISABLED_CLASSES = "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

export function Button({ variant = "primary", size = "md", className = "", children, ...rest }: ButtonProps) {
  const base =
    variant === "ghost"
      ? `text-sm font-semibold ${DISABLED_CLASSES}`
      : `rounded-full font-display font-extrabold transition-transform duration-100 ${DISABLED_CLASSES} ${SIZE_CLASSES[size]}`;

  return (
    <button
      type="button"
      data-testid="button"
      data-variant={variant}
      className={`${base} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
