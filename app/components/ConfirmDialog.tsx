import { useCallback, useEffect, useRef, useState } from "react";

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message body */
  message: string;
  /** Label for the confirm (danger) button — default "Delete" */
  confirmLabel?: string;
  /** Label for the cancel button — default "Cancel" */
  cancelLabel?: string;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called when the user cancels or closes */
  onCancel: () => void;
}

/**
 * A reusable confirm dialog that replaces `window.confirm`.
 * Uses an s-element overlay styled to match Shopify Polaris.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate open/close
  useEffect(() => {
    if (open) {
      // Small delay so the CSS transition fires
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  // Focus trap: focus the cancel button on open
  useEffect(() => {
    if (open && dialogRef.current) {
      const cancelBtn = dialogRef.current.querySelector<HTMLButtonElement>(
        'button[data-cancel]',
      );
      cancelBtn?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop — native button to satisfy a11y interactive-element rule */}
      <button
        type="button"
        aria-label="Close"
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          padding: 0,
          background: "transparent",
          cursor: "default",
        }}
        onClick={onCancel}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: visible
              ? "rgba(0, 0, 0, 0.4)"
              : "rgba(0, 0, 0, 0)",
            transition: "background-color 200ms ease",
          }}
        />
      </button>

      {/* Dialog card */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{
          position: "relative",
          width: "min(90vw, 440px)",
          background: "#fff",
          borderRadius: "8px",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.15)",
          padding: "24px",
          transform: visible ? "translateY(0)" : "translateY(12px)",
          opacity: visible ? 1 : 0,
          transition: "transform 200ms ease, opacity 200ms ease",
        }}
      >
        {/* Title */}
        <h2
          id="confirm-title"
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            lineHeight: "1.3",
            color: "#202223",
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          id="confirm-message"
          style={{
            margin: "12px 0 0",
            fontSize: "14px",
            lineHeight: "1.5",
            color: "#6d7175",
          }}
        >
          {message}
        </p>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          <button
            data-cancel
            type="button"
            onClick={onCancel}
            style={{
              padding: "7px 16px",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "1",
              color: "#202223",
              background: "#fff",
              border: "1px solid #c9cccf",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f6f6f7";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "7px 16px",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "1",
              color: "#fff",
              background: "#d72c0d",
              border: "1px solid #d72c0d",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#bc2200";
              e.currentTarget.style.borderColor = "#bc2200";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#d72c0d";
              e.currentTarget.style.borderColor = "#d72c0d";
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
