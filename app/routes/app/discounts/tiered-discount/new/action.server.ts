import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import {
  readConfig,
  writeConfig,
  findFunctionNode,
  createShopifyDiscount,
  type DiscountEntry,
} from "@/lib/discount-helpers.server";

function generateId(): string {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  const title = formData.get("title") as string;
  const type = formData.get("type") as "percentage" | "fixed_amount";
  const active = formData.get("active") === "true";

  // Parse tiers from form data
  let discountTiers: { minQuantity: number; value: string; message?: string }[] = [];
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
    scope: "tiered",
    value: firstTier?.value || "10",
    minQuantity: firstTier?.minQuantity || 0,
    active,
    tiers: discountTiers.length > 0 ? discountTiers : undefined,
    ...(productIds.length > 0 ? { productIds } : {}),
  };

  // Find the function node first
  const funcNode = await findFunctionNode();
  if (!funcNode) {
    return { ok: false, errors: ["Discount function not found - deploy the app first"] };
  }

  // Read current config
  const { config, ownerId } = await readConfig(admin);
  // Create Shopify discount
  const result = await createShopifyDiscount(admin, funcNode.id, newEntry);
  if (result.discountId) {
    newEntry.shopifyDiscountId = result.discountId;
  } else if (result.error) {
    return { ok: false, errors: [result.error] };
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
