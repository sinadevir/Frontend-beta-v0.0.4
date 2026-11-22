import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { LoadingGate } from "@/components/cis/section-loader";
import { useSectionBusy } from "@/lib/section-loader";

/** Counts tab switches so each newly shown TabsContent plays the logo loader (the first tab, shown with the page, does not). */
const TabSwitchContext = React.createContext(0);

/** Radix tabs put `dir` on their root element; without it they fall back to LTR and flip everything inside (tab order, tables, toolbars). */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ dir = "rtl", onValueChange, ...props }, ref) => {
  const [switches, setSwitches] = React.useState(0);
  return (
    <TabSwitchContext.Provider value={switches}>
      <TabsPrimitive.Root ref={ref} dir={dir} onValueChange={(v) => { setSwitches((n) => n + 1); onValueChange?.(v); }} {...props} />
    </TabSwitchContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const busy = useSectionBusy();
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "flex w-full items-end justify-start gap-1 border-b border-border text-muted-foreground",
        busy && "pointer-events-none opacity-70",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative -mb-px inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3.5 text-sm font-bold cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:border-primary data-[state=active]:text-primary [&_svg]:size-4",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const switches = React.useContext(TabSwitchContext);
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      <LoadingGate trigger={switches} loadOnMount={switches > 0}>{children}</LoadingGate>
    </TabsPrimitive.Content>
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
