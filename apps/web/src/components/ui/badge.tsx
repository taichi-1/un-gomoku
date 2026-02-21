import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-(--border-1) bg-(--surface-2) text-(--text-strong)",
        warning:
          "border-(--accent-gold-3) bg-(--tone-gold-soft-bg) text-(--accent-gold-1)",
        error:
          "border-(--accent-crimson-2) bg-(--tone-error-soft-bg) text-(--accent-crimson-1)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
