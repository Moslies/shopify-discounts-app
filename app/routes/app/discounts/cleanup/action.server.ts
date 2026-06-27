import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "@/shopify.server";
import { deleteShopifyDiscount } from "@/lib/discount-helpers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const idsJson = formData.get("discountIds") as string;
  if (!idsJson) {
    return { ok: false, errors: ["No discount IDs provided"] };
  }

  const ids: string[] = JSON.parse(idsJson);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of ids) {
    const err = await deleteShopifyDiscount(admin, id);
    results.push({ id, ok: !err, error: err || undefined });
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return {
      ok: false,
      errors: failures.map((f) => `${f.id}: ${f.error}`),
    };
  }

  return {
    ok: true,
    type: "cleaned",
    deletedCount: results.length,
  };
};
