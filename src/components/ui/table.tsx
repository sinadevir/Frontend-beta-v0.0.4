import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tables always read right to left: the first column sits on the right edge, the last on the left.
 * `containerClassName` styles the scroll wrapper (for example a max height).
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(({ className, containerClassName, ...props }, ref) => (
  <div dir="rtl" className={cn("relative w-full overflow-auto", containerClassName)}>
    <table ref={ref} dir="rtl" className={cn("data-table w-full caption-bottom border-separate border-spacing-0 text-sm", className)} {...props} />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("bg-muted/50 font-medium [&_td]:border-t", className)} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("group/row transition-colors", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

/** Header cell: heavier than the body so columns read as labels, never as data. */
const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 border-b border-border bg-muted/45 px-4 text-start align-middle text-xs font-bold text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("border-b border-border/70 px-4 py-3 text-start align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
