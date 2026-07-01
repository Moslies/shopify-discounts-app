import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { deleteSellingPlanGroup } from "@/lib/subscription-helpers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id") as string | null;

  if (!id) {
    return { ok: false, errors: ["Missing subscription group id"] };
  }

  const { userErrors } = await deleteSellingPlanGroup(admin, id);
  return userErrors.length > 0
    ? { ok: false, errors: userErrors.map((item) => item.message || "Unknown error") }
    : { ok: true };
};
