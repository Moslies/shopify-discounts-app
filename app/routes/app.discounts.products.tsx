import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";

  let resp;
  if (query) {
    // Search with query
    resp = await admin.graphql(
      `#graphql
      query searchProducts($query: String!) {
        products(first: 25, query: $query) {
          nodes { id title }
        }
      }`,
      { variables: { query } }
    );
  } else {
    // Fetch all products (first 250)
    resp = await admin.graphql(
      `#graphql
      query allProducts {
        products(first: 250) {
          nodes { id title }
        }
      }`
    );
  }

  const json = await resp.json();
  const nodes = json.data?.products?.nodes || [];

  return new Response(JSON.stringify(nodes), {
    headers: { "Content-Type": "application/json" },
  });
};
