import { useEffect, useState, type FormEvent } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { loader } from "./loader.server";
export { loader };
import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function EditOrderDiscountPage() {
  const { entry } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const [title, setTitle] = useState(entry.title);
  const [type, setType] = useState<"percentage" | "fixed_amount">(entry.type);
  const [discountTiers, setDiscountTiers] = useState<{ minQuantity: number; value: string; message?: string }[]>(
    entry.tiers && entry.tiers.length > 0
      ? entry.tiers
      : [{ minQuantity: entry.minQuantity, value: entry.value, message: "" }]
  );
  const [active, setActive] = useState(entry.active);

  const addTier = () => {
    const last = discountTiers[discountTiers.length - 1];
    const nextQty = last ? last.minQuantity + 10 : 50;
    setDiscountTiers([...discountTiers, { minQuantity: nextQty, value: "10", message: "" }]);
  };

  const removeTier = (index: number) => {
    if (discountTiers.length <= 1) return;
    setDiscountTiers(discountTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: "minQuantity" | "value" | "message", val: string) => {
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
      shopify.toast.show("Discount updated");
      navigate("/app/discounts/order-discount");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const sortedTiers = [...discountTiers].sort((a, b) => a.minQuantity - b.minQuantity);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    fetcher.submit(
      {
        entryId: entry.id,
        title,
        type,
        active: String(active),
        discountTiers: JSON.stringify(sortedTiers),
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading={`Edit: ${entry.title || "Untitled"}`}>
      <s-link slot="breadcrumb-actions" href="/app/discounts/order-discount">order-discount</s-link>
      <form onSubmit={handleSubmit}>
        {/* Section 1: Discount Information */}
        <s-box paddingBlockEnd="small">
          <s-section>
            <s-stack direction="block" gap="base">
              {/* Header with icon */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <s-icon type="info" tone="auto"></s-icon>
                <s-text tone="auto" type="strong">Discount Information</s-text>
              </div>

              {/* Title and Type in one row */}
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-grid-item>
                  <s-text-field
                    label="Discount Title"
                    value={title}
                    placeholder="e.g. Summer Sale"
                    onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                  ></s-text-field>
                </s-grid-item>
                <s-grid-item>
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
                </s-grid-item>
              </s-grid>

              <s-text color="base" tone="auto">Scope: Order Discount — applies to the entire order</s-text>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
                <s-switch
                  label="Enable discount"
                  checked={active}
                  onChange={(event: any) => {
                    const isChecked = event.currentTarget.checked;
                    setActive(isChecked);
                  }}
                />
              </div>

              {/* Status message */}
              {active && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  backgroundColor: "#dcfce7",
                  borderRadius: "8px",
                  border: "1px solid #86efac",
                  marginTop: "12px"
                }}>
                  <span style={{ color: "#16A34A", fontSize: "18px" }}>✓</span>
                  <s-text tone="success" type="generic">This discount will be active and available to customers.</s-text>
                </div>
              )}
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          <s-section>
            <s-stack direction="block" gap="base">
              {/* Header with Add Tier button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <s-icon type="info" tone="auto"></s-icon>
                  <s-text tone="auto" type="strong">Discount Tiers</s-text>
                </div>
                <s-button variant="secondary" icon="plus" onClick={addTier}>
                  Add Tier
                </s-button>
              </div>
              <s-text tone="auto" type="generic">Add spending thresholds to create automatic order discounts.</s-text>

              {/* Tier Cards */}
              {discountTiers.map((tier, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "20px",
                    backgroundColor: "#fafbff",
                    marginTop: "16px"
                  }}
                >
                  {/* Tier Label and Delete Button */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{
                      display: "inline-block",
                      backgroundColor: "#dcfce7",
                      color: "#16A34A",
                      padding: "4px 12px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}>
                      Tier {index + 1}
                    </div>
                    <s-button
                      variant="tertiary"
                      accessibilityLabel="Delete tier"
                      disabled={discountTiers.length <= 1}
                      onClick={() => removeTier(index)}
                      icon="delete"
                    ></s-button>
                  </div>

                  {/* Tier Fields Grid */}
                  <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
                    {/* Min Amount */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Min Amount ($)</s-text>
                        <s-text-field
                          value={String(tier.minQuantity)}
                          placeholder="50"
                          onInput={(e) =>
                            updateTier(index, "minQuantity", (e.target as HTMLInputElement).value)
                          }
                        ></s-text-field>
                      </div>
                    </s-grid-item>

                    {/* Discount Value */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Discount</s-text>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <s-text-field
                            value={tier.value}
                            placeholder="10"
                            onInput={(e) =>
                              updateTier(index, "value", (e.target as HTMLInputElement).value)
                            }
                          ></s-text-field>
                          <s-text>{type === "percentage" ? "%" : "$"}</s-text>
                        </div>
                      </div>
                    </s-grid-item>

                    {/* Display Name / Message */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Display Message</s-text>
                        <s-text-field
                          value={tier.message || ""}
                          placeholder="e.g. Spend $50 Save 10%"
                          onInput={(e) =>
                            updateTier(index, "message", (e.target as HTMLInputElement).value)
                          }
                        ></s-text-field>
                      </div>
                    </s-grid-item>
                  </s-grid>
                </div>
              ))}

              {/* Tip section */}
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px 16px",
                backgroundColor: "#fef3c7",
                borderRadius: "8px",
                border: "1px solid #fde68a",
                marginTop: "16px"
              }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>💡</span>
                <s-text tone="auto" type="generic">Customers will automatically see the best available discount based on their order subtotal.</s-text>
              </div>
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          {/* Section 3: Linked status & Save */}
          <s-section>
            <s-stack direction="block" gap="base">
              {entry.shopifyDiscountId && (
                <s-banner tone="success">
                  <s-paragraph>
                    Linked to Shopify Admin - changes will update the existing automatic discount.
                  </s-paragraph>
                </s-banner>
              )}
              {!entry.shopifyDiscountId && (
                <s-banner tone="info">
                  <s-paragraph>
                    No Shopify discount linked yet. Saving will create one automatically.
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
          </s-section>
        </s-box>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
