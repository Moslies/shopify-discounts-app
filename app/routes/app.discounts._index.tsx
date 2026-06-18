import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
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

export const action = async ({ request }: any) => {
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
    await deleteShopifyDiscount(admin, shopifyId);
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

  const handleDelete = (entry: DiscountEntry) => {
    if (!window.confirm(`Delete "${entry.title || "untitled"}"?`)) return;
    setLocal((prev) => prev.filter((d) => d.id !== entry.id));
    fetcher.submit(
      {
        _action: "delete",
        discountId: entry.id,
        shopifyDiscountId: entry.shopifyDiscountId || "",
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Discount Rules">
      <s-button slot="primary-action" variant="primary" onClick={() => navigate("/app/discounts/new")}>
        Add Discount
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
          <s-stack direction="block" gap="base">
            {local.map((entry) => (
              <s-box
                key={entry.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="base" alignment="center">
                  <s-stack direction="block" gap="none" style={{ flex: 1 }}>
                    <s-text variant="headingSm" fontWeight="bold">
                      {entry.title || "Untitled"}
                    </s-text>
                    <s-text variant="bodySm" tone="subdued">
                      {entry.scope === "product" ? "📦 Product" : "🛒 Order"}
                      {" · "}
                      {entry.type === "percentage"
                        ? `${entry.value}% off`
                        : `$${entry.value} off`}
                      {" · min "}{entry.minQuantity} item{entry.minQuantity > 1 ? "s" : ""}
                      {entry.shopifyDiscountId ? " · ✅ Linked" : " · ⏳ Not linked"}
                      {!entry.active && " · ⏸️ Paused"}
                    </s-text>
                  </s-stack>

                  <s-button variant="tertiary" onClick={() => navigate(`/app/discounts/${entry.id}`)}>Edit</s-button>

                  <s-button
                    variant="tertiary"
                    tone="critical"
                    onClick={() => handleDelete(entry)}
                  >
                    Delete
                  </s-button>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}

      {/* Preview */}
      <s-section slot="aside" heading="Data Preview">
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
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
