import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function IconButton({ className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      data-testid="icon-button"
      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/25 border-2 border-white shadow-[0_3px_0_rgba(0,0,0,0.15)] flex items-center justify-center text-base sm:text-lg transition-transform duration-100 active:shadow-none active:translate-y-[3px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
