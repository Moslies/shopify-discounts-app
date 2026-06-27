import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { readConfig, deleteShopifyDiscount, writeConfig } from "@/lib/discount-helpers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action") as string;

  if (actionType !== "delete") {
    return { ok: false, errors: ["Unknown action"] };
  }

  const discountId = formData.get("discountId") as string;
  const shopifyId = formData.get("shopifyDiscountId") as string | null;

  const { config, ownerId } = await readConfig(admin);
  config.discounts = config.discounts.filter((d) => d.id !== discountId);

  const err = await writeConfig(admin, config, ownerId);
  if (err) return { ok: false, errors: [err] };

  // Also delete from Shopify if linked.
  if (shopifyId) {
    const delErr = await deleteShopifyDiscount(admin, shopifyId);
    if (delErr) {
      return { ok: false, errors: [`Deleted locally, but failed to remove from Shopify: ${delErr}`] };
    }
  }

  return { ok: true, type: "deleted" };
};
