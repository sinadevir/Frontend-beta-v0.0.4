import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-raised group-[.toaster]:font-sans",
          success: "group-[.toaster]:!bg-success-soft group-[.toaster]:!text-success-foreground group-[.toaster]:!border-success/30",
          error: "group-[.toaster]:!bg-destructive-soft group-[.toaster]:!text-destructive group-[.toaster]:!border-destructive/30",
          warning: "group-[.toaster]:!bg-warning-soft group-[.toaster]:!text-warning-foreground group-[.toaster]:!border-warning/40",
          info: "group-[.toaster]:!bg-info-soft group-[.toaster]:!text-primary group-[.toaster]:!border-info/30",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
