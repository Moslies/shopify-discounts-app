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
  const [allProducts, setAllProducts] = useState(true);

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
          ? { ...tier, [field]: field === "minQuantity" ? parseInt(val) || 0 : field === "value" ? val.replace(/^(\d*\.?\d{0,2}).*/, '$1') : val }
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

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
                <s-switch
                  label="Enable notifications"
                  checked={active}
                  onChange={(event) => {
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

        {/* Section 2: Discount Tiers */}
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
              <s-text tone="auto" type="generic">Add quantity breaks to create automatic discounts.</s-text>

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
                  <s-grid gridTemplateColumns="repeat(5, 1fr)" gap="base">
                    {/* Combo Name (moved to first column) */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Combo Name</s-text>
                        <s-text-field
                          value={tier.comboName || ""}
                          placeholder="e.g. 2 for $20"
                          onInput={(e) =>
                            updateTier(index, "comboName", (e.target as HTMLInputElement).value)
                          }
                        ></s-text-field>
                      </div>
                    </s-grid-item>

                    {/* Buy Quantity */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Buy Quantity</s-text>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <s-text-field
                            value={String(tier.minQuantity)}
                            placeholder="2"
                            onInput={(e) => {
                              const target = e.target as HTMLInputElement;
                              const cleaned = target.value.replace(/\D/g, '');
                              if (cleaned !== target.value) target.value = cleaned;
                              updateTier(index, "minQuantity", cleaned);
                            }}
                          ></s-text-field>
                          <s-text color="subdued">items</s-text>
                        </div>
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
                            onInput={(e) => {
                              const target = e.target as HTMLInputElement;
                              const cleaned = target.value.replace(/^(\d*\.?\d{0,2}).*/, '$1');
                              if (cleaned !== target.value) target.value = cleaned;
                              updateTier(index, "value", cleaned);
                            }}
                          ></s-text-field>
                          <s-text>{type === "percentage" ? "%" : "$"}</s-text>
                        </div>
                      </div>
                    </s-grid-item>

                    {/* Display Message */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Display Message</s-text>
                        <s-text-field
                          value={tier.message || ""}
                          placeholder="e.g. Buy 2 Save 10%"
                          onInput={(e) =>
                            updateTier(index, "message", (e.target as HTMLInputElement).value)
                          }
                        ></s-text-field>
                      </div>
                    </s-grid-item>

                    {/* Badge Text (now an input) */}
                    <s-grid-item>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <s-text tone="auto" type="strong">Badge Text</s-text>
                        <s-text-field
                          value={tier.badgeText || ""}
                          placeholder="e.g. Most Popular"
                          onInput={(e) =>
                            updateTier(index, "badgeText", (e.target as HTMLInputElement).value)
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
                <s-text tone="auto" type="generic">Customers will automatically see the best available discount based on the quantity they add to cart.</s-text>
              </div>
            </s-stack>
          </s-section>
        </s-box>

        {/* Section 3: Eligible Products */}
        <s-box paddingBlockEnd="small">
          <s-section>
            <s-stack direction="block" gap="base">
              {/* Header with icon */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <s-icon type="info" tone="auto"></s-icon>
                <s-text tone="auto" type="strong">Eligible Products (optional)</s-text>
              </div>
              <s-text tone="auto" type="generic" color="subdued">Choose specific products this discount applies to.</s-text>

              {/* Product Selection Options */}
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <input
                    type="radio"
                    id="all-products"
                    name="product-scope"
                    checked={allProducts}
                    onChange={() => {
                      setAllProducts(true);
                      setProductIds([]);
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label htmlFor="all-products" style={{ cursor: "pointer" }}>
                    <s-text tone="auto" type="strong">All products</s-text>
                  </label>
                </div>
                <div style={{ marginLeft: "35px" }}>
                  {allProducts && (
                    <s-text tone="auto" type="generic" color="subdued">
                      This discount applies to all products in your store.
                    </s-text>
                  )}  
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <input
                    type="radio"
                    id="specific-products"
                    name="product-scope"
                    checked={!allProducts}
                    onChange={() => setAllProducts(false)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                  <label htmlFor="specific-products" style={{ cursor: "pointer" }}>
                    <s-text tone="auto" type="strong">Specific products</s-text>
                  </label>
                </div>
                {!allProducts && (
                  <div style={{ marginLeft: "35px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <s-text tone="auto" type="generic" color="subdued">
                        Select which products this discount applies to.
                      </s-text>
                      <s-button variant="primary" onClick={() => setPickerOpen(true)}>
                        {productIds.length > 0
                          ? `Add / Remove Products (${productIds.length} selected)`
                          : "Select Products"}
                    </s-button>
                    </div>
                    {productIds.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0", display: "grid", gap: "12px" }}>
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
                  </div>
                )}
              </div>

              <ProductPickerDialog
                open={pickerOpen}
                selectedIds={productIds}
                onConfirm={handlePickerConfirm}
                onCancel={() => setPickerOpen(false)}
              />
            </s-stack>
          </s-section>
        </s-box>

        {/* Section 4: Submit Button */}
        <s-box paddingBlockStart="small" paddingBlockEnd="small">
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
