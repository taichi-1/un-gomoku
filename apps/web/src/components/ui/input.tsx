import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-(--border-1) bg-(--surface-2) px-3 py-2 text-sm text-(--text-strong) placeholder:text-(--text-muted) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--accent-gold-2)",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
