import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-[background-color,color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-brand hover:bg-primary-hover",
        brand: "bg-brand text-primary-foreground shadow-brand hover:brightness-105",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-border bg-card text-foreground shadow-card hover:border-primary/35 hover:text-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-primary/12",
        soft: "bg-primary-soft text-primary hover:bg-primary/14",
        ghost: "text-foreground/80 hover:bg-primary-soft hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** A request started by this button is running: shows a spinner and a running bar, blocks repeat clicks. */
  loading?: boolean;
  /** Label shown while loading (e.g. «در حال ثبت…»); defaults to the normal label. */
  loadingText?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, disabled, children, ...props }, ref) => {
    if (asChild) {
      return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...{ ...props, disabled }}>{children}</Slot>;
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }), loading && "relative overflow-hidden disabled:cursor-wait disabled:opacity-100")}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading ? "" : undefined}
        {...props}
      >
        {loading && <Loader2 className="btn-spinner animate-spin" aria-hidden />}
        {loading && loadingText ? loadingText : children}
        {loading && <span aria-hidden className="btn-progress" />}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
