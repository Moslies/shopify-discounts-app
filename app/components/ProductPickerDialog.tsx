import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

export interface ProductPickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Currently selected product IDs (for editing) */
  selectedIds?: string[];
  /** Called when user confirms selection */
  onConfirm: (selectedIds: string[], selectedNames: Record<string, string>) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

/**
 * A dialog to pick products from the Shopify store.
 * Fetches all products on open and lets the user select/deselect.
 */
export default function ProductPickerDialog({
  open,
  selectedIds: initialSelectedIds = [],
  onConfirm,
  onCancel,
}: ProductPickerDialogProps) {
  const fetcher = useFetcher();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [visible, setVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});

  // Fetch products when dialog opens
  useEffect(() => {
    if (open) {
      fetcher.load("/app/discounts/products");
    }
  }, [open]);

  // Animate open/close
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds);
      setSearchText("");
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open, initialSelectedIds]);

  // Focus search input when dialog opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 250);
    }
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  const products = (Array.isArray(fetcher.data)
    ? (fetcher.data as { id: string; title: string }[])
    : []) as { id: string; title: string }[];

  const isLoading = fetcher.state === "loading";

  // Filter by search text
  const filtered = searchText.trim()
    ? products.filter((p) =>
        p.title.toLowerCase().includes(searchText.toLowerCase())
      )
    : products;

  const toggleProduct = (p: { id: string; title: string }) => {
    setSelectedIds((prev) => {
      const already = prev.includes(p.id);
      if (already) {
        return prev.filter((id) => id !== p.id);
      } else {
        setSelectedNames((names) => ({ ...names, [p.id]: p.title }));
        return [...prev, p.id];
      }
    });
  };

  const handleConfirm = () => {
    onConfirm(selectedIds, selectedNames);
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "min(90vw, 560px)",
          maxHeight: "min(90vh, 640px)",
          background: "#fff",
          borderRadius: "8px",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.15)",
          transform: visible ? "translateY(0)" : "translateY(12px)",
          opacity: visible ? 1 : 0,
          transition: "transform 200ms ease, opacity 200ms ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 0",
            borderBottom: "1px solid #e1e3e5",
            paddingBottom: "16px",
          }}
        >
          <h2
            id="picker-title"
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: "1.3",
              color: "#202223",
            }}
          >
            Select Products
          </h2>

          {/* Search input */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter products..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: "12px",
              padding: "8px 12px",
              fontSize: "14px",
              lineHeight: "1.4",
              color: "#202223",
              background: "#f6f6f7",
              border: "1px solid #c9cccf",
              borderRadius: "6px",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#5c5f62";
              e.currentTarget.style.background = "#fff";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#c9cccf";
              e.currentTarget.style.background = "#f6f6f7";
            }}
          />
        </div>

        {/* Product list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
            minHeight: 0,
          }}
        >
          {isLoading ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <span style={{ fontSize: "14px", color: "#6d7175" }}>
                Loading products...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <span style={{ fontSize: "14px", color: "#6d7175" }}>
                {searchText.trim()
                  ? "No products match your filter."
                  : "No products found."}
              </span>
            </div>
          ) : (
            filtered.map((p) => {
              const selected = selectedIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProduct(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "10px 24px",
                    cursor: "pointer",
                    background: selected ? "#f0f9ff" : "transparent",
                    border: "none",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    textAlign: "left",
                    transition: "background 100ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected)
                      e.currentTarget.style.background = "#f6f6f7";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Checkbox indicator */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "4px",
                      border: selected
                        ? "2px solid #2c6ecb"
                        : "2px solid #8c9196",
                      background: selected ? "#2c6ecb" : "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 100ms ease",
                    }}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6l2.5 2.5 4.5-5"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Product title */}
                  <span
                    style={{
                      fontSize: "14px",
                      lineHeight: "1.4",
                      color: "#202223",
                      fontWeight: selected ? 500 : 400,
                    }}
                  >
                    {p.title}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 24px 16px",
            borderTop: "1px solid #e1e3e5",
          }}
        >
          <span style={{ fontSize: "13px", color: "#6d7175" }}>
            {selectedIds.length} product{selectedIds.length !== 1 ? "s" : ""} selected
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                padding: "7px 16px",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "1",
                color: "#fff",
                background: "#2c6ecb",
                border: "1px solid #2c6ecb",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1e5bb7";
                e.currentTarget.style.borderColor = "#1e5bb7";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2c6ecb";
                e.currentTarget.style.borderColor = "#2c6ecb";
              }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
