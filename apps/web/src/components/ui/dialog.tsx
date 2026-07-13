import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogTone = "decal" | "signal" | "warn" | "halt" | "mute";

const openDialogStack: symbol[] = [];
let bodyScrollLockCount = 0;
let bodyOverflowBeforeLock = "";

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
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActive = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialogToken = Symbol("deck-dialog");
    openDialogStack.push(dialogToken);
    if (bodyScrollLockCount === 0) {
      bodyOverflowBeforeLock = document.body.style.overflow;
    }
    bodyScrollLockCount += 1;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = getFocusableElements(dialogRef.current)[0];
      (firstFocusable ?? dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogStack[openDialogStack.length - 1] !== dialogToken) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      const stackIndex = openDialogStack.lastIndexOf(dialogToken);
      if (stackIndex >= 0) {
        openDialogStack.splice(stackIndex, 1);
      }
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeLock;
        bodyOverflowBeforeLock = "";
      }
      previousActive?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const content = (
    <div className="dialog-layer" role="presentation">
      <div
        className="dialog-backdrop"
        aria-hidden="true"
        onMouseDown={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("dialog-content", className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--chassis-edge)] p-4">
          <div className="min-w-0">
            <Badge variant={tone}>{kicker}</Badge>
            <h2
              id={titleId}
              className="console-title mt-2 text-xl font-bold text-[color:var(--text-display)]"
            >
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--text-body)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 px-3"
            aria-label="关闭面板"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" weight="bold" />
          </Button>
        </div>

        <div className="dialog-body p-4">
          {children}
        </div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--chassis-edge)] p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }
  return createPortal(content, document.body);
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
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
        <dl className="divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border)]">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
              <dt className="text-xs text-[color:var(--text-mute)]">{row.label}</dt>
              <dd className="min-w-0 break-words text-sm font-semibold text-[color:var(--text-display)]">
                {row.value}
              </dd>
              {row.badge ? <dd className="shrink-0">{row.badge}</dd> : null}
            </div>
          ))}
        </dl>
        {warning ? (
          <div className="border-l-2 border-[color:var(--telltale-amber)] bg-[color:var(--warning-soft)] p-4 text-sm leading-6 text-[color:var(--text-body)]">
            {warning}
          </div>
        ) : null}
      </div>
    </DeckDialog>
  );
}
