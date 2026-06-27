import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { readConfig, findFunctionNode, getLinkedDiscounts } from "@/lib/discount-helpers.server";

interface OrphanDiscount {
  discountId: string;
  title: string;
  status: string;
  discountClass: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // 1. Get local discounts
  const { config } = await readConfig(admin);
  const localShopifyIds = new Set(
    config.discounts
      .filter((d) => d.shopifyDiscountId)
      .map((d) => d.shopifyDiscountId!)
  );

  // 2. Get function node (combined handles all scopes)
  const funcNode = await findFunctionNode();
  const funcIds = funcNode ? [funcNode.id] : [];

  if (funcIds.length === 0) {
    return { orphans: [], allLinked: [], error: "Discount function not found - deploy the app first." };
  }

  // 3. Get all Shopify discounts linked to either function
  const linked = await getLinkedDiscounts(admin, funcIds);

  // 4. Build allLinked with discountClass for debugging
  const allLinked = linked.map((n: any) => ({
    discountId: n.discount?.discountId || "",
    title: n.discount?.title || "Untitled",
    status: n.discount?.status || "unknown",
    discountClass: n.discount?.discountClass || "unknown",
    functionId: n.discount?.appDiscountType?.functionId || "",
  }));

  // 5. Find orphans: exist in Shopify but not in local config
  const orphans: OrphanDiscount[] = linked
    .filter((n: any) => {
      const sid = n.discount?.discountId;
      return sid && !localShopifyIds.has(sid);
    })
    .map((n: any) => ({
      discountId: n.discount.discountId,
      title: n.discount.title || "Untitled",
      status: n.discount.status || "unknown",
      discountClass: n.discount?.discountClass || "unknown",
    }));

  return { orphans, allLinked, error: null };
};
