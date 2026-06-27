import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import {
  readConfig,
  writeConfig,
  findFunctionNode,
  updateShopifyDiscount,
  createShopifyDiscount,
  type DiscountEntry,
} from "@/lib/discount-helpers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const entryId = formData.get("entryId") as string;
  const title = formData.get("title") as string;
  const type = formData.get("type") as "percentage" | "fixed_amount";
  const scope = (formData.get("scope") as "order" | "product") || "order";
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

  // Read current config
  const { config, ownerId } = await readConfig(admin);

  // Find and update the entry
  const idx = config.discounts.findIndex((d) => d.id === entryId);
  if (idx === -1) {
    return { ok: false, errors: ["Discount not found"] };
  }

  const updated: DiscountEntry = {
    ...config.discounts[idx],
    title,
    type,
    scope,
    value: firstTier?.value || "10",
    minQuantity: firstTier?.minQuantity || 0,
    active,
    tiers: discountTiers.length > 0 ? discountTiers : undefined,
    ...(productIds.length > 0 ? { productIds } : { productIds: undefined }),
  };

  // Find the function node
  const funcNode = await findFunctionNode();
  if (!funcNode) {
    return { ok: false, errors: ["Discount function not found - deploy the app first"] };
  }
  const funcId = funcNode.id;

  if (updated.shopifyDiscountId) {
    const updateErr = await updateShopifyDiscount(admin, updated, funcId);
    if (updateErr) {
      return { ok: false, errors: [`Failed to update Shopify discount: ${updateErr}`] };
    }
  } else if (updated.active) {
    const result = await createShopifyDiscount(admin, funcId, updated);
    if (result.discountId) {
      updated.shopifyDiscountId = result.discountId;
    } else if (result.error) {
      return { ok: false, errors: [`Failed to create Shopify discount: ${result.error}`] };
    }
  }

  config.discounts[idx] = updated;

  const err = await writeConfig(admin, config, ownerId);
  if (err) {
    return { ok: false, errors: [err] };
  }

  return { ok: true, type: "updated" };
};
