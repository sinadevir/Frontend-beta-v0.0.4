import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Chips used across the system. Tones follow the status palette (success / warning / destructive / info / neutral);
 * `code` is for identifiers (codes, numbers) and `count` for small totals. Sizes: xs (inside tree rows), sm (tables), default, lg.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center whitespace-nowrap border font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "rounded-full border-transparent bg-primary text-primary-foreground shadow-brand",
        secondary: "rounded-full border-primary/15 bg-primary-soft text-primary",
        soft: "rounded-full border-primary/15 bg-primary-soft text-primary",
        outline: "rounded-full border-border bg-card text-muted-foreground",
        muted: "rounded-full border-transparent bg-muted text-muted-foreground",
        neutral: "rounded-full border-border bg-muted/70 text-muted-foreground",
        success: "rounded-full border-success/25 bg-success-soft text-success-foreground",
        warning: "rounded-full border-warning/35 bg-warning-soft text-warning-foreground",
        destructive: "rounded-full border-destructive/25 bg-destructive-soft text-destructive",
        info: "rounded-full border-info/30 bg-info-soft text-primary",
        code: "rounded-md border-border bg-card font-mono font-medium text-muted-foreground",
        count: "justify-center rounded-full border-transparent bg-primary-soft font-bold text-primary",
      },
      size: {
        xs: "h-[1.125rem] min-w-[1.125rem] gap-1 px-1.5 text-[0.625rem] [&_svg]:size-2.5",
        sm: "h-5 min-w-5 gap-1 px-2 text-[0.6875rem] [&_svg]:size-3",
        default: "h-6 min-w-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
        lg: "h-7 min-w-7 gap-1.5 px-3 text-[0.8125rem] [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/** Small round status light at the start of a badge; `pulse` for work that is still moving. */
function BadgeDot({ className, pulse }: { className?: string; pulse?: boolean }) {
  return (
    <span aria-hidden className={cn("relative flex size-1.5 shrink-0", className)}>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />}
      <span className="relative size-1.5 rounded-full bg-current ring-[2.5px] ring-current/20" />
    </span>
  );
}

export { Badge, BadgeDot, badgeVariants };
