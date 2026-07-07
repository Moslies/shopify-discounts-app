import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { readConfig } from "@/lib/discount-helpers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { config } = await readConfig(admin);
  const discounts = config.discounts.filter((d) => d.scope === "tiered");
  return { discounts };
};
