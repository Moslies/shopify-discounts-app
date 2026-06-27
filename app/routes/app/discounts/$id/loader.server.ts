import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { readConfig } from "@/lib/discount-helpers.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { config } = await readConfig(admin);

  const entry = config.discounts.find((d) => d.id === params.id);
  if (!entry) {
    throw new Response("Discount not found", { status: 404 });
  }

  // Fetch product names for pre-selected products
  const productMap: Record<string, string> = {};
  if (entry.productIds?.length) {
    const resp = await admin.graphql(
      `#graphql
      query getProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product { id title }
        }
      }`,
      { variables: { ids: entry.productIds } }
    );
    const json = await resp.json();
    for (const node of json.data?.nodes || []) {
      if (node) productMap[node.id] = node.title;
    }
  }

  return { entry, productMap };
};
