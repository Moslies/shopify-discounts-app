import { useEffect, useState, type FormEvent } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import ProductPickerDialog from "@/components/ProductPickerDialog";

import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function NewTieredDiscountPage() {
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountTiers, setDiscountTiers] = useState<{ minQuantity: number; value: string; message?: string; comboName?: string; badgeText?: string }[]>([
    { minQuantity: 2, value: "10", message: "", comboName: "", badgeText: "" },
  ]);
  const [active, setActive] = useState(true);

  // Product selection state
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<Record<string, { title: string; imageUrl?: string }>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const addTier = () => {
    const last = discountTiers[discountTiers.length - 1];
    const nextQty = last ? last.minQuantity + 1 : 2;
    setDiscountTiers([...discountTiers, { minQuantity: nextQty, value: "10", message: "", comboName: "", badgeText: "" }]);
  };

  const removeTier = (index: number) => {
    if (discountTiers.length <= 1) return;
    setDiscountTiers(discountTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: "minQuantity" | "value" | "message" | "comboName" | "badgeText", val: string) => {
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
      shopify.toast.show("Tiered discount created");
      navigate("/app/discounts/tiered-discount");
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
        active: String(active),
        discountTiers: JSON.stringify(sortedTiers),
        productIds: JSON.stringify(productIds),
      },
      { method: "POST" }
    );
  };

  const handlePickerConfirm = (ids: string[], selectedProducts: Record<string, { title: string; imageUrl?: string }>) => {
    setProductIds(ids);
    setProductNames(selectedProducts);
    setPickerOpen(false);
  };

  return (
    <s-page heading="New Tiered Discount">
      <s-link slot="breadcrumb-actions" href="/app/discounts/tiered-discount">tiered-discount</s-link>
      <form onSubmit={handleSubmit}>
        {/* Section 1: Basic Details */}
        <s-box paddingBlockEnd="small">
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text-field
                label="Title"
                value={title}
                placeholder="e.g. Summer Sale"
                onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
              ></s-text-field>

              <s-text color="base">Scope: Product Discount — applies to specific products</s-text>

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

              <s-checkbox
                label="Active"
                checked={active}
                onChange={(e) => setActive((e.target as HTMLInputElement).checked)}
              ></s-checkbox>
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
        {/* Section 2: Discount Tiers */}
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text color="base">Discount Tiers</s-text>
              {discountTiers.map((tier, index) => (
                <s-grid key={index} gridTemplateColumns="repeat(21, 1fr)" gap="base">
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label="Min Qty"
                        value={String(tier.minQuantity)}
                        placeholder="2"
                        onInput={(e) =>
                          updateTier(index, "minQuantity", (e.target as HTMLInputElement).value)
                        }
                      ></s-text-field>
                    </s-grid-item>
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label={type === "percentage" ? "Value %" : "Value $"}
                        value={tier.value}
                        placeholder="10"
                        onInput={(e) =>
                          updateTier(index, "value", (e.target as HTMLInputElement).value)
                        }
                      ></s-text-field>
                    </s-grid-item>
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label="Display Name"
                        value={tier.message || ""}
                        placeholder="e.g. Buy 2 Save 10%"
                        onInput={(e) =>
                          updateTier(index, "message", (e.target as HTMLInputElement).value)
                        }
                      ></s-text-field>
                    </s-grid-item>
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label="Combo Name"
                        value={tier.comboName || ""}
                        placeholder="e.g. 2 for $20"
                        onInput={(e) =>
                          updateTier(index, "comboName", (e.target as HTMLInputElement).value)
                        }
                      ></s-text-field>
                    </s-grid-item>
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label="Badge Text"
                        value={tier.badgeText || ""}
                        placeholder="e.g. Best Value"
                        onInput={(e) =>
                          updateTier(index, "badgeText", (e.target as HTMLInputElement).value)
                        }
                      ></s-text-field>
                    </s-grid-item>
                    <s-grid-item gridColumn="auto" gridRow="span 1" paddingBlockStart="large-200">
                      <s-button
                        variant="tertiary"
                        accessibilityLabel="Delete delivery option"
                        disabled={discountTiers.length <= 1}
                        onClick={() => removeTier(index)}
                        icon="delete"
                      >
                      </s-button>
                    </s-grid-item>
                </s-grid>
              ))}
              <s-button variant="tertiary" onClick={addTier}>
                + Add Tier
              </s-button>
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          {/* Section 3: Product Selection */}
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text color="base">Eligible Products (If none selected, applies to all products)</s-text>

              <s-button variant="primary" onClick={() => setPickerOpen(true)}>
                {productIds.length > 0
                  ? `Add / Remove Products (${productIds.length} selected)`
                  : "Add Products"}
              </s-button>
              {productIds.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
                  {productIds.map((id) => {
                    const p = productNames[id];
                    return (
                      <li
                        key={id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: "1px solid #dfe3eb",
                          borderRadius: "12px",
                          padding: "12px 16px",
                          background: "#fafbff",
                          marginTop: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {p?.imageUrl && (
                            <img
                              src={p.imageUrl}
                              alt={p?.title || "product"}
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "4px",
                                objectFit: "cover",
                                flexShrink: 0,
                                background: "#f6f6f7",
                              }}
                            />
                          )}
                          <span>{p?.title || id}</span>
                        </div>
                        <s-button
                          variant="tertiary"
                          onClick={() => setProductIds(productIds.filter((x) => x !== id))}
                        >
                          Remove
                        </s-button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <ProductPickerDialog
                open={pickerOpen}
                selectedIds={productIds}
                onConfirm={handlePickerConfirm}
                onCancel={() => setPickerOpen(false)}
              />
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          {/* Section 4: Activation */}
            <s-stack direction="block" gap="base">
              <s-button
                type="submit"
                variant="primary"
                {...(isSaving ? { loading: true } : {})}
              >
                Create Discount
              </s-button>
            </s-stack>
        </s-box>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
