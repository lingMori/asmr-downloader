import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogTone = "decal" | "signal" | "warn" | "halt" | "mute";

export type ReviewRow = {
  label: string;
  value: ReactNode;
  badge?: ReactNode;
};

export function DeckDialog({
  open,
  onOpenChange,
  title,
  kicker,
  description,
  tone = "decal",
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kicker: string;
  description?: ReactNode;
  tone?: DialogTone;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          role="presentation"
        >
          <button
            type="button"
            aria-label="关闭面板"
            className="absolute inset-0 cursor-default bg-[rgba(5,8,7,0.68)] backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "deck-chassis w-full max-w-2xl overflow-hidden",
              className,
            )}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.6, 0, 0.4, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--chassis-edge)] p-4">
              <div className="min-w-0 space-y-3">
                <Badge variant={tone}>{kicker}</Badge>
                <h2
                  id={titleId}
                  className="console-title text-2xl font-black text-[color:var(--text-display)]"
                >
                  {title}
                </h2>
                {description ? (
                  <p className="max-w-xl text-sm leading-6 text-[color:var(--text-body)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="关闭面板"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" weight="bold" />
              </Button>
            </div>

            <div className="max-h-[min(72vh,46rem)] overflow-auto p-4">
              {children}
            </div>

            {footer ? (
              <div className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--chassis-edge)] p-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return content;
  }
  return createPortal(content, document.body);
}

export function ActionReviewDialog({
  open,
  onOpenChange,
  title,
  description,
  rows,
  warning,
  confirmLabel,
  cancelLabel = "返回修改",
  confirmVariant = "primary",
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  rows: ReviewRow[];
  warning?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <DeckDialog
      open={open}
      onOpenChange={onOpenChange}
      kicker="Action Review"
      title={title}
      description={description}
      tone={confirmVariant === "danger" ? "halt" : "warn"}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === "danger" ? "danger" : "primary"}
            busy={busy}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="deck-screen p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-mute)]">
                    {row.label}
                  </div>
                  <div className="mt-2 min-w-0 break-words text-sm font-semibold text-[color:var(--text-display)]">
                    {row.value}
                  </div>
                </div>
                {row.badge ? <div className="shrink-0">{row.badge}</div> : null}
              </div>
            </div>
          ))}
        </div>
        {warning ? (
          <div className="deck-screen border-[color:var(--telltale-amber)] p-4 text-sm leading-6 text-[color:var(--text-body)]">
            {warning}
          </div>
        ) : null}
      </div>
    </DeckDialog>
  );
}
