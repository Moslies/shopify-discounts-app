import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  readConfig,
  deleteShopifyDiscount,
  writeConfig,
  type DiscountEntry,
} from "../lib/discount-helpers.server";
import ConfirmDialog from "../components/ConfirmDialog";

// ----------------------------------------------------------------
// Loader
// ----------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { config } = await readConfig(admin);
  return { discounts: config.discounts };
};

// ----------------------------------------------------------------
// Action — delete
// ----------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  if (actionType !== "delete") {
    return { ok: false, errors: ["Unknown action"] };
  }

  const discountId = formData.get("discountId") as string;
  const shopifyId = formData.get("shopifyDiscountId") as string | null;

  const { config, ownerId } = await readConfig(admin);
  config.discounts = config.discounts.filter((d) => d.id !== discountId);

  const err = await writeConfig(admin, config, ownerId);
  if (err) return { ok: false, errors: [err] };

  // Also delete from Shopify if linked
  if (shopifyId) {
    const delErr = await deleteShopifyDiscount(admin, shopifyId);
    if (delErr) {
      return { ok: false, errors: [`Deleted locally, but failed to remove from Shopify: ${delErr}`] };
    }
  }

  return { ok: true, type: "deleted" };
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function DiscountListPage() {
  const { discounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [local, setLocal] = useState(discounts);
  const [deleteTarget, setDeleteTarget] = useState<DiscountEntry | null>(null);
  useEffect(() => {
    setLocal(discounts);
  }, [discounts]);

  // Toast from delete fetcher
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Discount deleted");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, shopify]);

/**
 * 处理删除折扣条目的函数
 * @param entry - 要删除的折扣条目对象，包含id、title等属性
 */
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

  return (
    <s-page heading="Discount Rules">
      <s-button slot="primary-action" variant="primary" onClick={() => navigate("/app/discounts/new")}>
        Add Discount
      </s-button>

      <s-button slot="secondary-action" variant="tertiary" onClick={() => navigate("/app/discounts/cleanup")}>
        Clean Up Orphans
      </s-button>

      {/* Empty state */}
      {local.length === 0 ? (
        <s-banner>
          <s-paragraph>
            No discounts yet. Create one to get started.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-section heading={`All Discounts (${local.length})`}>
          <s-box padding="base" borderWidth="large-100" borderRadius="base">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--s-border-color, #ccc)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>
                    <s-text color="subdued">Title</s-text>
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "15%" }}>
                    <s-text color="subdued">Scope</s-text>
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "12%" }}>
                    <s-text color="subdued">Type</s-text>
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>
                    <s-text color="subdued">Quantity</s-text>
                  </th>
                  <th style={{ textAlign: "left", padding: "8px 12px", width: "15%" }}>
                    <s-text color="subdued">Status</s-text>
                  </th>
                  <th style={{ textAlign: "right", padding: "8px 12px", width: "10%" }}>
                    <s-text color="subdued">Actions</s-text>
                  </th>
                </tr>
              </thead>
              <tbody>
                {local.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: "1px solid var(--s-border-color-subdued, #eee)" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="base">{entry.title || "Untitled"}</s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">
                        {entry.scope === "product" ? "📦 Product" : "🛒 Order"}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">
                        {entry.type === "percentage" ? "% off" : "$ off"}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">
                        {entry.tiers && entry.tiers.length > 1
                          ? `${entry.tiers.length} tiers (${entry.tiers.map(t => t.minQuantity).join("/")})`
                          : `min ${entry.minQuantity} item${entry.minQuantity > 1 ? "s" : ""}`}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">
                        {entry.shopifyDiscountId ? "✅ Linked" : "⏳ Not linked"}
                        {!entry.active && " · ⏸️ Paused"}
                      </s-text>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <s-stack direction="inline" gap="base">
                        <s-button variant="tertiary" onClick={() => navigate(`/app/discounts/${entry.id}`)}>Edit</s-button>
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

      {/* Preview */}
      {/* <s-section slot="aside" heading="Data Preview">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "12px",
            }}
          >
            <code>{JSON.stringify({ discounts: local }, null, 2)}</code>
          </pre>
        </s-box>
      </s-section> */}

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