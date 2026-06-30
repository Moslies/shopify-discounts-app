import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { createSellingPlanGroup } from "@/lib/subscription-helpers.server";

function getIntervalLabel(timeType: string, count: number) {
  const unit = timeType === "year" ? "year" : timeType === "month" ? "month" : timeType === "week" ? "week" : "day";
  return `${count === 1 ? "" : `${count} `}${count === 1 ? unit : `${unit}s`}`;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

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

  const resources = productIds.length > 0 ? { productIds } : undefined;

  const intervals = formData.getAll("interval") as string[];
  const intervalCounts = formData.getAll("intervalCount") as string[];
  const discounts = formData.getAll("discount") as string[];

  const sellingPlansToCreate = intervals.map((interval, index) => {
    const intervalCount = parseInt(intervalCounts[index] || "1", 10);
    const discount = Math.min(parseFloat(discounts[index] || "0"), 100);
    const intervalLabel = getIntervalLabel(interval.toLowerCase(), intervalCount);

    return {
      name: `Delivery: every ${intervalLabel}${discount ? ` | ${discount}% off` : ""}`,
      options: [`${intervalCount} ${intervalCount === 1 ? intervalLabel : `${intervalLabel}s`}`],
      category: "SUBSCRIPTION" as const,
      billingPolicy: {
        recurring: { interval, intervalCount },
      },
      deliveryPolicy: {
        recurring: { interval, intervalCount },
      },
      pricingPolicies:
        discount > 0
          ? [{ fixed: { adjustmentType: "PERCENTAGE" as const, adjustmentValue: { percentage: discount } } }]
          : [],
    };
  });

  const input = {
    name,
    merchantCode,
    ...(description ? { description } : {}),
    options,
    sellingPlansToCreate,
  };

  const { userErrors } = await createSellingPlanGroup(admin, input, resources);
  return userErrors.length > 0
    ? { ok: false, errors: userErrors.map((item) => item.message || "Unknown error") }
    : { ok: true };
};
