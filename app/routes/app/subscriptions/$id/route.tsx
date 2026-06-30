import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
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

export default function EditSubscriptionPage() {
  const { group } = useLoaderData<typeof loader>() as { group: any };
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const isSaving = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  type PlanState = {
    id: string;
    interval: string;
    intervalCount: string;
    discount: string;
  };

  const initialPlans = useMemo<PlanState[]>(
    () =>
      (group.sellingPlans?.nodes ?? []).map((plan: any) => ({
        id: plan.id,
        interval: plan.billingPolicy?.interval ?? "WEEK",
        intervalCount: String(plan.billingPolicy?.intervalCount ?? 1),
        discount: String(plan.pricingPolicies?.[0]?.adjustmentValue?.percentage ?? 0),
      })),
    [group]
  );

  const existingProducts = useMemo(() => {
    const nodes: Array<{ id: string; title: string }> = group.products?.nodes ?? [];
    const ids = nodes.map((p) => p.id);
    const names: Record<string, string> = {};
    nodes.forEach((p) => { names[p.id] = p.title; });
    return { ids, names };
  }, [group]);

  const [name, setName] = useState<string>(group.name ?? "");
  const [merchantCode, setMerchantCode] = useState<string>(group.merchantCode ?? "");
  const [description, setDescription] = useState<string>(group.description ?? "");
  const [options, setOptions] = useState<string>((group.options as string[] | undefined)?.join(", ") ?? "Delivery every");
  const [plans, setPlans] = useState<PlanState[]>(initialPlans);
  const [deletedPlanIds, setDeletedPlanIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>(existingProducts.ids);
  const [productNames, setProductNames] = useState<Record<string, string>>(existingProducts.names);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setName(group.name ?? "");
    setMerchantCode(group.merchantCode ?? "");
    setDescription(group.description ?? "");
    setOptions((group.options as string[] | undefined)?.join(", ") ?? "Delivery every");
    setPlans(initialPlans);
    setProductIds(existingProducts.ids);
    setProductNames(existingProducts.names);
  }, [group, initialPlans, existingProducts]);

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Subscription group updated");
      navigate("/app/subscriptions");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, navigate, shopify]);

  const addPlan = () => {
    setPlans((current: PlanState[]) => [...current, { id: "", interval: "WEEK", intervalCount: "1", discount: "0" }]);
  };

  const removePlan = (index: number) => {
    const plan = plans[index];
    if (plan?.id) {
      setDeletedPlanIds((current: string[]) => [...current, plan.id]);
    }
    setPlans((current: PlanState[]) => current.filter((_, itemIndex: number) => itemIndex !== index));
  };

  const updatePlan = (index: number, field: "interval" | "intervalCount" | "discount", value: string) => {
    setPlans((current: PlanState[]) => current.map((plan: PlanState, itemIndex: number) => (itemIndex === index ? { ...plan, [field]: value } : plan)));
  };

  const handlePickerConfirm = (ids: string[], names: Record<string, string>) => {
    setProductIds(ids);
    setProductNames((prev) => ({ ...prev, ...names }));
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
    formData.set("deletedPlanIds", deletedPlanIds.join(","));

    plans.forEach((plan: PlanState) => {
      formData.append("planId", plan.id);
      formData.append("interval", plan.interval);
      formData.append("intervalCount", plan.intervalCount);
      formData.append("discount", plan.discount);
    });

    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <s-page heading={`Edit: ${group.name}`}>
      <s-button variant="tertiary" onClick={() => navigate("/app/subscriptions")}>
        Back
      </s-button>

      <form onSubmit={handleSubmit}>
        <s-box paddingBlockEnd="small">
          <s-section heading="Group details">
            <s-stack direction="block" gap="base">
              <s-text-field label="Name" value={name} onInput={(event) => setName((event.target as HTMLInputElement).value)} />
              <s-text-field label="Merchant code" value={merchantCode} onInput={(event) => setMerchantCode((event.target as HTMLInputElement).value)} />
              <s-text-area label="Description" value={description} rows={3} onInput={(event) => setDescription((event.target as HTMLTextAreaElement).value)} />
              <s-text-field label="Options (comma-separated)" value={options} onInput={(event) => setOptions((event.target as HTMLInputElement).value)} />
            </s-stack>
          </s-section>
        </s-box>

        <s-box paddingBlockEnd="small">
          <s-section heading="Selling plans">
            <s-stack direction="block" gap="base">
              {plans.map((plan, index) => (
                <s-grid key={`${plan.id}-${index}`} gridTemplateColumns="repeat(13, 1fr)" gap="base">
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
              <s-text color="base">Eligible Products (If none selected, applies to all products)</s-text>
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
                      <span>{productNames[id] || id}</span>
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
            Save changes
          </s-button>
        </s-box>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
