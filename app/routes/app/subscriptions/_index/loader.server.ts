import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { fetchSellingPlanGroups } from "@/lib/subscription-helpers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const groups = await fetchSellingPlanGroups(admin);
  return { groups };
};
