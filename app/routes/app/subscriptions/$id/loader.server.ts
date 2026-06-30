import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { fetchSellingPlanGroup } from "@/lib/subscription-helpers.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const id = params.id ?? "";
  const normalizedId = id.includes("://") ? id.split("/").pop() : id;
  const groupId = `gid://shopify/SellingPlanGroup/${normalizedId}`;
  const group = await fetchSellingPlanGroup(admin, groupId);

  if (!group) {
    throw new Response("Not found", { status: 404 });
  }

  return { group };
};
