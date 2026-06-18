import { useEffect, useState, type FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  readConfig,
  writeConfig,
  findFunctionNode,
  createShopifyDiscount,
  type DiscountEntry,
} from "../lib/discount-helpers.server";

function generateId(): string {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ----------------------------------------------------------------
// Action
// ----------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const type = formData.get("type") as "percentage" | "fixed_amount";
  const scope = (formData.get("scope") as "order" | "product") || "order";
  const value = formData.get("value") as string;
  const minQuantity = parseInt(formData.get("minQuantity") as string) || 0;
  const message = formData.get("message") as string;
  const active = formData.get("active") === "true";

  const newEntry: DiscountEntry = {
    id: generateId(),
    title,
    type,
    scope,
    value: value || "10",
    minQuantity,
    message,
    active,
  };

  // Read current config
  const { config, ownerId } = await readConfig(admin);

  // Try to create Shopify discount
  const funcNode = await findFunctionNode(admin);
  if (funcNode) {
    const result = await createShopifyDiscount(admin, funcNode.id, newEntry);
    if (result.discountId) {
      newEntry.shopifyDiscountId = result.discountId;
    }
  }

  // Append to list
  config.discounts.push(newEntry);

  // Write back
  const err = await writeConfig(admin, config, ownerId);
  if (err) {
    return { ok: false, errors: [err] };
  }

  return { ok: true, type: "created", id: newEntry.id };
};

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function NewDiscountPage() {
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [scope, setScope] = useState<"order" | "product">("order");
  const [value, setValue] = useState("10");
  const [minQuantity, setMinQuantity] = useState(2);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(true);

  // On success, redirect to list
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Discount created");
      navigate("/app/discounts");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetcher.submit(
      {
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
    <s-page heading="New Discount">
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

            <s-button
              type="submit"
              variant="primary"
              {...(isSaving ? { loading: true } : {})}
            >
              Create Discount
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
