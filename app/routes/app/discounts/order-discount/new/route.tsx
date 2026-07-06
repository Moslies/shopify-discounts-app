import { useEffect, useState, type FormEvent } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function NewOrderDiscountPage() {
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountTiers, setDiscountTiers] = useState<{ minQuantity: number; value: string; message?: string }[]>([
    { minQuantity: 50, value: "10", message: "" },
  ]);
  const [active, setActive] = useState(true);

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
      shopify.toast.show("Order discount created");
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
        title,
        type,
        active: String(active),
        discountTiers: JSON.stringify(sortedTiers),
      },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="New Order Discount">
      <s-section>
        <s-button variant="tertiary" onClick={() => navigate("/app/discounts/order-discount")}>
          Back
        </s-button>
      </s-section>

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

              <s-text color="base">Scope: Order Discount — applies to the entire order</s-text>

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
                <s-grid key={index} gridTemplateColumns="repeat(13, 1fr)" gap="base">
                    <s-grid-item gridColumn="span 4" gridRow="span 1">
                      <s-text-field
                        label="Min Amount ($)"
                        value={String(tier.minQuantity)}
                        placeholder="50"
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
                        placeholder="e.g. Spend $50 Save 10%"
                        onInput={(e) =>
                          updateTier(index, "message", (e.target as HTMLInputElement).value)
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
          {/* Section 3: Activation */}
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
