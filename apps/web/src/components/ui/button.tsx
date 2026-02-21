import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--accent-gold-2) disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-(--accent-gold-2) text-(--bg-0) hover:bg-(--accent-gold-1)",
        secondary:
          "bg-(--surface-2) text-(--text-strong) hover:bg-(--border-1)",
        local:
          "bg-(--btn-start-bg) text-(--btn-start-text) hover:bg-(--btn-start-hover) focus-visible:ring-(--btn-start-ring)",
        create:
          "bg-(--btn-create-bg) text-(--btn-create-text) hover:bg-(--btn-create-hover)",
        join: "bg-(--btn-join-bg) text-(--btn-join-text) hover:bg-(--btn-join-hover) focus-visible:ring-(--btn-join-ring)",
        ghost:
          "text-(--text-normal) hover:bg-(--surface-2) hover:text-(--text-strong)",
        outline:
          "border border-(--border-1) bg-transparent text-(--text-normal) hover:bg-(--surface-1) hover:text-(--text-strong)",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
