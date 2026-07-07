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

  // Ensure this entry is a product-scoped discount
  if (entry.scope !== "tiered") {
    throw new Response("Discount not found", { status: 404 });
  }

  // Fetch product names and images for pre-selected products
  const productMap: Record<string, { title: string; imageUrl?: string }> = {};
  if (entry.productIds?.length) {
    const resp = await admin.graphql(
      `#graphql
      query getProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product { id title featuredImage { url altText } }
        }
      }`,
      { variables: { ids: entry.productIds } }
    );
    const json = await resp.json();
    for (const node of json.data?.nodes || []) {
      if (node) productMap[node.id] = {
        title: node.title,
        imageUrl: node.featuredImage?.url || undefined,
      };
    }
  }

  return { entry, productMap };
};
