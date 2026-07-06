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

  // Ensure this entry is an order-scoped discount
  if (entry.scope !== "order") {
    throw new Response("Discount not found", { status: 404 });
  }

  return { entry, productMap: {} };
};
