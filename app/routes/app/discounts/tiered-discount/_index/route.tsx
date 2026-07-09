import { useEffect, useState } from "react";
import type { HeadersFunction } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { type DiscountEntry } from "@/lib/discount-helpers.server";
import ConfirmDialog from "@/components/ConfirmDialog";

import { loader } from "./loader.server";
export { loader };
import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function TieredDiscountListPage() {
  const { discounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [local, setLocal] = useState(discounts);
  const [deleteTarget, setDeleteTarget] = useState<DiscountEntry | null>(null);

  useEffect(() => {
    setLocal(discounts);
  }, [discounts]);

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Discount deleted");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const handleDelete = (entry: DiscountEntry) => {
    setDeleteTarget(entry);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setLocal((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    fetcher.submit(
      {
        _action: "delete",
        discountId: deleteTarget.id,
        shopifyDiscountId: deleteTarget.shopifyDiscountId || "",
      },
      { method: "POST" }
    );
    setDeleteTarget(null);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleEdit = (entry: DiscountEntry) => {
    navigate(`/app/discounts/tiered-discount/${entry.id}`);
  };

  return (
    <s-page heading="Tiered Discounts">
      <s-button slot="primary-action" variant="primary" onClick={() => navigate("/app/discounts/tiered-discount/new")}>
        Add Tiered Discount
      </s-button>

      {local.length === 0 ? (
        <s-banner>
          <s-paragraph>
            No tiered discounts yet. Create one to get started.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-section heading={`All Tiered Discounts (${local.length})`}>
          <s-box padding="base" borderWidth="large-100" borderRadius="base">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--s-border-color, #ccc)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Title</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "12%" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "15%" }}>Min Qty</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "15%" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", width: "18%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {local.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid var(--s-border-color-subdued, #eee)" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <s-text type="strong" tone="auto">{entry.title || "Untitled"}</s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text type="strong" tone="auto">
                        {entry.type === "percentage" ? "% off" : "$ off"}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text type="strong" tone="auto">
                        {entry.tiers && entry.tiers.length > 1
                          ? `${entry.tiers.length} tiers (${entry.tiers.map((t) => t.minQuantity).join("/")})`
                          : `min ${entry.minQuantity} item${entry.minQuantity > 1 ? "s" : ""}`}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text type="strong" tone="auto">
                        {entry.shopifyDiscountId ? entry.active ? <s-badge tone="success" icon="check-circle">Active</s-badge> : <s-badge tone="warning" icon="alert-triangle">Paused</s-badge> : <s-badge tone="critical" icon="question-circle">Not linked</s-badge>}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <s-stack direction="inline" gap="base">
                        <s-button variant="tertiary" onClick={() => handleEdit(entry)}>Edit</s-button>
                        <s-button
                          variant="tertiary"
                          tone="critical"
                          onClick={() => handleDelete(entry)}
                        >
                          Delete
                        </s-button>
                      </s-stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-box>
        </s-section>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete discount"
        message={`Are you sure you want to delete "${deleteTarget?.title || "untitled"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
