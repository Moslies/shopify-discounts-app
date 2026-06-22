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
  findProductFunctionNode,
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
  const message = formData.get("message") as string;
  const active = formData.get("active") === "true";

  // Parse tiers from form data
  let discountTiers: { minQuantity: number; value: string }[] = [];
  const tiersRaw = formData.get("discountTiers");
  if (tiersRaw) {
    try { discountTiers = JSON.parse(tiersRaw as string); } catch {}
  }

  const firstTier = discountTiers.length > 0 ? discountTiers[0] : null;

  // Parse productIds from form data
  let productIds: string[] = [];
  const productIdsRaw = formData.get("productIds");
  if (productIdsRaw) {
    try { productIds = JSON.parse(productIdsRaw as string); } catch {}
  }

  const newEntry: DiscountEntry = {
    id: generateId(),
    title,
    type,
    scope,
    value: firstTier?.value || "10",
    minQuantity: firstTier?.minQuantity || 0,
    message,
    active,
    tiers: discountTiers.length > 0 ? discountTiers : undefined,
    ...(productIds.length > 0 ? { productIds } : {}),
  };

  // Read current config
  const { config, ownerId } = await readConfig(admin);

  // Try to create Shopify discount — route to the correct function per scope
  const productFunc = newEntry.scope === "product" ? await findProductFunctionNode(admin) : null;

  if (newEntry.scope === "product" && !productFunc) {
    const orderFunc = await findFunctionNode(admin);
    if (!orderFunc) {
      return { ok: false, errors: ["Discount function not found — deploy the app first"] };
    }
    const result = await createShopifyDiscount(admin, orderFunc.id, { ...newEntry, scope: "order" });
    if (result.discountId) {
      newEntry.shopifyDiscountId = result.discountId;
    } else if (result.error) {
      return { ok: false, errors: [result.error] };
    }
  } else {
    const funcNode = newEntry.scope === "product" ? productFunc : await findFunctionNode(admin);
    if (!funcNode) {
      return { ok: false, errors: ["Discount function not found — deploy the app first"] };
    }
    const result = await createShopifyDiscount(admin, funcNode.id, newEntry);
    if (result.discountId) {
      newEntry.shopifyDiscountId = result.discountId;
    } else if (result.error) {
      return { ok: false, errors: [result.error] };
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
  const productFetcher = useFetcher();

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [scope, setScope] = useState<"order" | "product">("order");
  const [discountTiers, setDiscountTiers] = useState<{ minQuantity: number; value: string }[]>([
    { minQuantity: 2, value: "10" },
  ]);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(true);

  // Product selection state
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Trigger product search on demand
  const doSearch = (query: string) => {
    if (!query || query.length < 2) return;
    productFetcher.load(
      `/app/discounts/products?query=${encodeURIComponent(query)}`
    );
  };

  const addTier = () => {
    const last = discountTiers[discountTiers.length - 1];
    const nextQty = last ? last.minQuantity + 1 : 2;
    setDiscountTiers([...discountTiers, { minQuantity: nextQty, value: "10" }]);
  };

  const removeTier = (index: number) => {
    if (discountTiers.length <= 1) return;
    setDiscountTiers(discountTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: "minQuantity" | "value", val: string) => {
    setDiscountTiers((prev) =>
      prev.map((tier, i) =>
        i === index
          ? { ...tier, [field]: field === "minQuantity" ? parseInt(val) || 0 : val }
          : tier
      )
    );
  };

  // On success, redirect to list
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Discount created");
      navigate("/app/discounts");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const sortedTiers = [...discountTiers].sort((a, b) => a.minQuantity - b.minQuantity);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetcher.submit(
      {
        title,
        type,
        scope,
        message,
        active: String(active),
        discountTiers: JSON.stringify(sortedTiers),
        productIds: JSON.stringify(productIds),
      },
      { method: "POST" }
    );
  };

  const searchResults = Array.isArray(productFetcher.data)
    ? productFetcher.data as { id: string; title: string }[]
    : [];

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
              onChange={(e) => {
                setScope((e.target as HTMLSelectElement).value as "order" | "product");
                setProductIds([]);
              }}
            >
              <s-option value="order">Order Discount — applies to the entire order</s-option>
              <s-option value="product">Product Discount — applies to specific products</s-option>
            </s-select>

            {/* Product selector — only shown for product scope */}
            {scope === "product" && (
              <s-stack direction="block" gap="base">
                <s-text-field
                  label="Search Products"
                  value={searchQuery}
                  placeholder="Type product name to search..."
                  onInput={(e) =>
                    setSearchQuery((e.target as HTMLInputElement).value)
                  }
                ></s-text-field>
                <s-button
                  variant="primary"
                  onClick={() => doSearch(searchQuery)}
                >
                  Search
                </s-button>

                {searchResults.length > 0 && (
                  <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                    <s-stack direction="block" gap="base">
                      {searchResults.map((p) => {
                        const isSelected = productIds.includes(p.id);
                        return (
                          <s-stack key={p.id} direction="inline" gap="base" alignItems="center">
                            <s-button variant="tertiary" onClick={() => {
                              if (isSelected) {
                                setProductIds((prev) => prev.filter((id) => id !== p.id));
                              } else {
                                setProductIds((prev) => [...prev, p.id]);
                                setProductNames((prev) => ({ ...prev, [p.id]: p.title }));
                              }
                            }}>
                              {isSelected ? "☑️" : "⬜"}
                            </s-button>
                            <s-text color="base">{p.title}</s-text>
                          </s-stack>
                        );
                      })}
                    </s-stack>
                  </s-box>
                )}

                {productIds.length > 0 && (
                  <>
                    <s-text color="subdued">{productIds.length} product(s) selected</s-text>
                    <s-stack direction="block" gap="base">
                      {productIds.map((id) => (
                        <s-box key={id} padding="base" borderWidth="base" borderRadius="base">
                          <s-stack direction="inline" gap="base" alignItems="center">
                            <s-stack direction="block" gap="none" inlineSize="100%">
                              <s-text color="base">{productNames[id] || id}</s-text>
                            </s-stack>
                            <s-button variant="tertiary" onClick={() => {
                              setProductIds((prev) => prev.filter((x) => x !== id));
                            }}>✕</s-button>
                          </s-stack>
                        </s-box>
                      ))}
                    </s-stack>
                  </>
                )}
              </s-stack>
            )}

            {/* Discount type */}
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

            {/* Tiers */}
            <s-stack direction="block" gap="base">
              <s-text color="base">Discount Tiers</s-text>

              {discountTiers.map((tier, index) => (
                <s-box key={index} padding="base" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-text-field
                      label="Min Qty"
                      value={String(tier.minQuantity)}
                      placeholder="2"
                      onInput={(e) =>
                        updateTier(index, "minQuantity", (e.target as HTMLInputElement).value)
                      }
                    ></s-text-field>
                    <s-text-field
                      label={type === "percentage" ? "Value %" : "Value $"}
                      value={tier.value}
                      placeholder="10"
                      onInput={(e) =>
                        updateTier(index, "value", (e.target as HTMLInputElement).value)
                      }
                    ></s-text-field>
                    <s-button
                      variant="tertiary"
                      tone="critical"
                      disabled={discountTiers.length <= 1}
                      onClick={() => removeTier(index)}
                    >
                      ✕
                    </s-button>
                  </s-stack>
                </s-box>
              ))}

              <s-button variant="tertiary" onClick={addTier}>
                + Add Tier
              </s-button>
            </s-stack>

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
