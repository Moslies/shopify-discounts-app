import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";

  const resp = await admin.graphql(
    `#graphql
    query searchProducts($query: String!) {
      products(first: 25, query: $query) {
        nodes {
          id
          title
        }
      }
    }`,
    { variables: { query } }
  );
  const json = await resp.json();
  const nodes = json.data?.products?.nodes || [];

  return new Response(JSON.stringify(nodes), {
    headers: { "Content-Type": "application/json" },
  });
};
