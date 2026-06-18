import { useEffect, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  readConfig,
  writeConfig,
  findFunctionNode,
  updateShopifyDiscount,
  createShopifyDiscount,
  type DiscountEntry,
} from "../lib/discount-helpers.server";

// ----------------------------------------------------------------
// Loader
// ----------------------------------------------------------------

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { config } = await readConfig(admin);

  const entry = config.discounts.find((d) => d.id === params.id);
  if (!entry) {
    throw new Response("Discount not found", { status: 404 });
  }

  return { entry };
};

// ----------------------------------------------------------------
// Action
// ----------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const entryId = formData.get("entryId") as string;
  const title = formData.get("title") as string;
  const type = formData.get("type") as "percentage" | "fixed_amount";
  const scope = (formData.get("scope") as "order" | "product") || "order";
  const value = formData.get("value") as string;
  const minQuantity = parseInt(formData.get("minQuantity") as string) || 0;
  const message = formData.get("message") as string;
  const active = formData.get("active") === "true";

  // Read current config
  const { config, ownerId } = await readConfig(admin);

  // Find and update the entry
  const idx = config.discounts.findIndex((d) => d.id === entryId);
  if (idx === -1) {
    return { ok: false, errors: ["Discount not found"] };
  }

  const updated: DiscountEntry = {
    ...config.discounts[idx],
    title,
    type,
    scope,
    value: value || "10",
    minQuantity,
    message,
    active,
  };

  // Sync Shopify discount
  const funcNode = await findFunctionNode(admin);
  if (updated.shopifyDiscountId) {
    await updateShopifyDiscount(admin, updated, funcNode?.id || "");
  } else if (funcNode && updated.active) {
    const result = await createShopifyDiscount(admin, funcNode.id, updated);
    if (result.discountId) {
      updated.shopifyDiscountId = result.discountId;
    }
  }

  config.discounts[idx] = updated;

  const err = await writeConfig(admin, config, ownerId);
  if (err) {
    return { ok: false, errors: [err] };
  }

  return { ok: true, type: "updated" };
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function EditDiscountPage() {
  const { entry } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const [title, setTitle] = useState(entry.title);
  const [type, setType] = useState<"percentage" | "fixed_amount">(entry.type);
  const [scope, setScope] = useState<"order" | "product">(entry.scope || "order");
  const [value, setValue] = useState(entry.value);
  const [minQuantity, setMinQuantity] = useState(entry.minQuantity);
  const [message, setMessage] = useState(entry.message);
  const [active, setActive] = useState(entry.active);

  // On success, redirect to list
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Discount updated");
      navigate("/app/discounts");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetcher.submit(
      {
        entryId: entry.id,
        title,
        type,
        scope,
        value,
        minQuantity: String(minQuantity),
        message,
        active: String(active),
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading={`Edit: ${entry.title || "Untitled"}`}>
      <s-section>
        <s-button variant="tertiary" onClick={() => navigate("/app/discounts")}>
          ← Back
        </s-button>
        <form onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Title"
              value={title}
              placeholder="e.g. Summer Sale 10%"
              onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            ></s-text-field>

            <s-select
              label="Discount Scope"
              value={scope}
              onChange={(e) =>
                setScope((e.target as HTMLSelectElement).value as "order" | "product")
              }
            >
              <s-option value="order">Order Discount — applies to the entire order</s-option>
              <s-option value="product">Product Discount — applies to specific products</s-option>
            </s-select>

            <s-stack direction="inline" gap="base">
              <s-select
                label="Discount Type"
                value={type}
                onChange={(e) =>
                  setType((e.target as HTMLSelectElement).value as "percentage" | "fixed_amount")
                }
              >
                <s-option value="percentage">Percentage (%)</s-option>
                <s-option value="fixed_amount">Fixed Amount ($)</s-option>
              </s-select>
              <s-text-field
                label={type === "percentage" ? "Percentage" : "Amount"}
                value={value}
                placeholder={type === "percentage" ? "10" : "5.00"}
                onInput={(e) => setValue((e.target as HTMLInputElement).value)}
              ></s-text-field>
            </s-stack>

            <s-text-field
              label="Min. Quantity"
              value={String(minQuantity)}
              placeholder="2"
              onInput={(e) =>
                setMinQuantity(parseInt((e.target as HTMLInputElement).value) || 0)
              }
            ></s-text-field>

            <s-text-field
              label="Display Message"
              value={message}
              placeholder="e.g. Buy 2 Save 10%"
              onInput={(e) => setMessage((e.target as HTMLInputElement).value)}
            ></s-text-field>

            <s-checkbox
              label="Active"
              checked={active}
              onChange={(e) => setActive((e.target as HTMLInputElement).checked)}
            ></s-checkbox>

            {/* Linked status */}
            {entry.shopifyDiscountId && (
              <s-banner tone="success">
                <s-paragraph>
                  ✅ Linked to Shopify Admin — changes will update the existing
                  automatic discount.
                </s-paragraph>
              </s-banner>
            )}
            {!entry.shopifyDiscountId && (
              <s-banner tone="info">
                <s-paragraph>
                  ⏳ No Shopify discount linked yet. Saving will create one
                  automatically.
                </s-paragraph>
              </s-banner>
            )}

            <s-button
              type="submit"
              variant="primary"
              {...(isSaving ? { loading: true } : {})}
            >
              Save Changes
            </s-button>
          </s-stack>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
