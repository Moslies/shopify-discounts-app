import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import ProductPickerDialog from "@/components/ProductPickerDialog";

import { loader } from "./loader.server";
export { loader };
import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

export default function NewSubscriptionPage() {
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const isSaving = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  const [name, setName] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [description, setDescription] = useState("");
  const [options] = useState("Delivery every, Discount % off");
  const [plans, setPlans] = useState([{ interval: "WEEK", intervalCount: "1", discount: "0" }]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<Record<string, { title: string; imageUrl?: string }>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Subscription group created");
      navigate("/app/subscriptions");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const addPlan = () => {
    setPlans((current) => [...current, { interval: "WEEK", intervalCount: "1", discount: "0" }]);
  };

  const removePlan = (index: number) => {
    setPlans((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  };

  const updatePlan = (index: number, field: "interval" | "intervalCount" | "discount", value: string) => {
    setPlans((current) => current.map((plan, itemIndex) => (itemIndex === index ? { ...plan, [field]: value } : plan)));
  };

  const handlePickerConfirm = (ids: string[], selectedProducts: Record<string, { title: string; imageUrl?: string }>) => {
    setProductIds(ids);
    setProductNames(selectedProducts);
    setPickerOpen(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("name", name);
    formData.set("merchantCode", merchantCode);
    formData.set("description", description);
    formData.set("options", options);
    formData.set("productIds", productIds.join(","));

    plans.forEach((plan) => {
      formData.append("interval", plan.interval);
      formData.append("intervalCount", plan.intervalCount);
      formData.append("discount", plan.discount);
    });

    fetcher.submit(formData, { method: "POST" });
  };

  const planRows = useMemo(() => plans, [plans]);

  return (
    <s-page heading="Create subscription group">
      <s-link slot="breadcrumb-actions" href="/app/subscriptions">subscriptions</s-link>
      <form onSubmit={handleSubmit}>
        <s-box paddingBlockEnd="small">
          <s-section heading="Group details">
            <s-stack direction="block" gap="base">
              <s-text-field label="Name" value={name} onInput={(event) => setName((event.target as HTMLInputElement).value)} />
              <s-text-field label="Merchant code" value={merchantCode} onInput={(event) => setMerchantCode((event.target as HTMLInputElement).value)} />
              <s-text-area label="Description" value={description} rows={3} onInput={(event) => setDescription((event.target as HTMLTextAreaElement).value)} />
              <div style={{ display: "none" }}>
                <s-text-field label="Options (comma-separated)" value={options} />
              </div>
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          <s-section heading="Selling plans">
            <s-stack direction="block" gap="base">
              {planRows.map((plan, index) => (
                <s-grid key={`${plan.interval}-${index}`} gridTemplateColumns="repeat(13, 1fr)" gap="base">
                  <s-grid-item gridColumn="span 4" gridRow="span 1">
                    <s-select
                      label="Interval"
                      value={plan.interval}
                      onChange={(event) => updatePlan(index, "interval", (event.target as HTMLSelectElement).value)}
                    >
                      <s-option value="WEEK">Week</s-option>
                      <s-option value="MONTH">Month</s-option>
                    </s-select>
                  </s-grid-item>
                  <s-grid-item gridColumn="span 4" gridRow="span 1">
                    <s-number-field
                      label="Interval count"
                      value={plan.intervalCount}
                      min={1}
                      max={100}
                      onChange={(event) => updatePlan(index, "intervalCount", (event.target as HTMLInputElement).value)}
                    />
                  </s-grid-item>
                  <s-grid-item gridColumn="span 4" gridRow="span 1">
                    <s-number-field
                      label="Discount (%)"
                      value={plan.discount}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(event) => updatePlan(index, "discount", (event.target as HTMLInputElement).value)}
                    />
                  </s-grid-item>
                  <s-grid-item gridColumn="auto" gridRow="span 1" paddingBlockStart="large-200">
                    {plans.length > 1 && (
                      <s-button variant="tertiary" accessibilityLabel="Delete delivery option" onClick={() => removePlan(index)} icon="delete" />
                    )}
                  </s-grid-item>
                </s-grid>
              ))}
              <s-button variant="tertiary" onClick={addPlan}>
                + Add another plan
              </s-button>
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          <s-section heading="Link products (optional)">
            <s-stack direction="block" gap="base">
              <s-text color="base">Eligible Products</s-text>
              <s-button variant="primary" onClick={() => setPickerOpen(true)}>
                {productIds.length > 0
                  ? `Add / Remove Products (${productIds.length} selected)`
                  : "Add Products"}
              </s-button>
              {productIds.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "12px" }}>
                  {productIds.map((id) => (
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
                        {productNames[id]?.imageUrl && (
                          <img
                            src={productNames[id].imageUrl}
                            alt={productNames[id]?.title || "product"}
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
                        <span>{productNames[id]?.title || id}</span>
                      </div>
                      <s-button
                        variant="tertiary"
                        onClick={() => setProductIds(productIds.filter((x) => x !== id))}
                      >
                        Remove
                      </s-button>
                    </li>
                  ))}
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

        <s-box>
          <s-button type="submit" variant="primary" {...(isSaving ? { loading: true } : {})}>
            Create subscription group
          </s-button>
        </s-box>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
