import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import {
  addProductsToSellingPlanGroup,
  fetchSellingPlanGroupProductIds,
  removeProductsFromSellingPlanGroup,
  updateSellingPlanGroup,
} from "@/lib/subscription-helpers.server";

function getIntervalLabel(timeType: string, count: number) {
  const unit = timeType === "year" ? "year" : timeType === "month" ? "month" : timeType === "week" ? "week" : "day";
  return `${count} ${count === 1 ? unit : `${unit}s`}`;
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const id = params.id ?? "";
  const normalizedId = id.includes("://") ? id.split("/").pop() : id;
  const groupId = `gid://shopify/SellingPlanGroup/${normalizedId}`;

  const name = (formData.get("name") as string) ?? "";
  const merchantCode = (formData.get("merchantCode") as string) ?? "";
  const description = (formData.get("description") as string) ?? "";
  const optionsRaw = (formData.get("options") as string) ?? "";
  const options = optionsRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const productIdsRaw = (formData.get("productIds") as string) ?? "";
  const productIds = productIdsRaw.split(",").filter(Boolean);

  const intervals = formData.getAll("interval") as string[];
  const intervalCounts = formData.getAll("intervalCount") as string[];
  const discounts = formData.getAll("discount") as string[];
  const planIds = formData.getAll("planId") as string[];
  const deletedPlanIdsRaw = (formData.get("deletedPlanIds") as string) ?? "";
  const deletedPlanIds = deletedPlanIdsRaw.split(",").filter(Boolean);

  const allPlans = intervals.map((interval, index) => ({
    interval,
    intervalCount: parseInt(intervalCounts[index] || "1", 10),
    discount: parseFloat(discounts[index] || "0"),
    planId: planIds[index],
  }));

  const sellingPlansToUpdate = allPlans
    .filter((plan) => plan.planId)
    .map((plan) => {
      const intervalLabel = getIntervalLabel(plan.interval.toLowerCase(), plan.intervalCount);
      const discount = plan.discount ? ` ${plan.discount}% off` : "";

      return {
        id: plan.planId,
        name: `Delivery every: ${intervalLabel}${discount}`,
        options: [intervalLabel, discount],
        billingPolicy: { recurring: { interval: plan.interval, intervalCount: plan.intervalCount } },
        deliveryPolicy: { recurring: { interval: plan.interval, intervalCount: plan.intervalCount } },
        pricingPolicies:
          plan.discount > 0
            ? [{ fixed: { adjustmentType: "PERCENTAGE" as const, adjustmentValue: { percentage: plan.discount } } }]
            : [],
      };
    });

  const sellingPlansToCreate = allPlans
    .filter((plan) => !plan.planId)
    .map((plan) => {
      const intervalLabel = getIntervalLabel(plan.interval.toLowerCase(), plan.intervalCount);
      const discount = plan.discount ? ` ${plan.discount}% off` : "";
      return {
        name: `Delivery: every ${intervalLabel}${discount}`,
        options: [intervalLabel, discount],
        category: "SUBSCRIPTION" as const,
        billingPolicy: { recurring: { interval: plan.interval, intervalCount: plan.intervalCount } },
        deliveryPolicy: { recurring: { interval: plan.interval, intervalCount: plan.intervalCount } },
        pricingPolicies:
          plan.discount > 0
            ? [{ fixed: { adjustmentType: "PERCENTAGE" as const, adjustmentValue: { percentage: plan.discount } } }]
            : [],
      };
    });

  const input: Record<string, unknown> = {
    name,
    merchantCode,
    ...(description ? { description } : {}),
    options,
  };

  if (sellingPlansToUpdate.length > 0) {
    input.sellingPlansToUpdate = sellingPlansToUpdate;
  }
  if (sellingPlansToCreate.length > 0) {
    input.sellingPlansToCreate = sellingPlansToCreate;
  }
  if (deletedPlanIds.length > 0) {
    input.sellingPlansToDelete = deletedPlanIds;
  }

  const { userErrors } = await updateSellingPlanGroup(admin, groupId, input);

  // 1) Remove all currently linked products
  const existingProductIds = await fetchSellingPlanGroupProductIds(admin, groupId);

  let removeErrors: Array<{ message?: string }> = [];
  if (existingProductIds.length > 0) {
    removeErrors = (
      await removeProductsFromSellingPlanGroup(admin, groupId, existingProductIds)
    ).userErrors;
  }

  // 2) Add the newly selected products (if any)
  let addErrors: Array<{ message?: string }> = [];
  if (productIds.length > 0) {
    addErrors = (await addProductsToSellingPlanGroup(admin, groupId, productIds)).userErrors;
  }

  const allErrors = [...userErrors, ...removeErrors, ...addErrors];
  return allErrors.length > 0
    ? { ok: false, errors: allErrors.map((item) => item.message || "Unknown error") }
    : { ok: true };
};
