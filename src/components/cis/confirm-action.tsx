import { useState, type ReactNode } from "react";
import { Loader2 , ShieldCheck, TriangleAlert } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/api/messages";

/** Confirmation for irreversible actions (deactivate, revoke, end, reject…). Waits for the server and stays open on error. */
export function ConfirmAction({ trigger, title, description, confirmLabel = "تأیید", destructive, requireReason, reasonLabel = "دلیل", onConfirm, open, onOpenChange }: {
  trigger?: ReactNode; title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; requireReason?: boolean; reasonLabel?: string;
  onConfirm: (reason: string) => unknown | Promise<unknown>; open?: boolean; onOpenChange?: (v: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (v: boolean) => { if (busy) return; (onOpenChange ?? setInner)(v); if (!v) { setReason(""); setErr(null); } };
  const run = async () => {
    setBusy(true); setErr(null);
    try { await onConfirm(reason.trim()); setBusy(false); set(false); (onOpenChange ?? setInner)(false); setReason(""); }
    catch (e) { setErr(errorMessage(e)); setBusy(false); }
  };
  return (
    <AlertDialog open={isOpen} onOpenChange={set}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader className="flex-row items-start gap-4 space-y-0 text-start"><span aria-hidden className={destructive ? "grid size-12 shrink-0 place-items-center rounded-2xl bg-destructive-soft text-destructive" : "grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary"}>{destructive ? <TriangleAlert className="size-6" /> : <ShieldCheck className="size-6" />}</span><div className="min-w-0 space-y-1.5 pt-0.5"><AlertDialogTitle className="text-lg font-extrabold">{title}</AlertDialogTitle>{description && <AlertDialogDescription asChild><div className="leading-7">{description}</div></AlertDialogDescription>}</div></AlertDialogHeader>
        {requireReason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reasonLabel} <span className="text-destructive">*</span></Label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
        )}
        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
        <AlertDialogFooter className="-mx-7 -mb-7 mt-1 gap-2 border-t bg-muted/40 px-7 py-4">
          <AlertDialogCancel disabled={busy}>انصراف</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} loading={busy} loadingText={`در حال ${confirmLabel}…`} disabled={requireReason && !reason.trim()} onClick={run}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
