// ----------------------------------------------------------------
// Shared server-side helpers for discount management
// ----------------------------------------------------------------

export interface DiscountTier {
  minQuantity: number;
  value: string;
  /** Optional per-tier display message. */
  message?: string;
}

export interface DiscountEntry {
  id: string;
  title: string;
  type: "percentage" | "fixed_amount";
  /** "order" applies to the order subtotal; "product" applies to cart lines. */
  scope: "order" | "product";
  value: string;
  minQuantity: number;
  message?: string;
  active: boolean;
  shopifyDiscountId?: string | null;
  /** Product GIDs for product discounts; empty means all products. */
  productIds?: string[];
  /** Tiered discount rules; empty falls back to value + minQuantity. */
  tiers?: DiscountTier[];
}

/**
 * Select the highest qualifying tier.
 * Falls back to value + minQuantity for older entries without tiers.
 */
export function resolveBestTier(
  totalQuantity: number,
  entry: { tiers?: DiscountTier[]; minQuantity: number; value: string }
): { value: string; minQuantity: number; message?: string } | null {
  if (entry.tiers && entry.tiers.length > 0) {
    const sorted = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    let best = null;
    for (const tier of sorted) {
      if (totalQuantity >= tier.minQuantity) {
        best = tier;
      }
    }
    return best ? { value: best.value, minQuantity: best.minQuantity, message: best.message } : null;
  }
  if (totalQuantity >= entry.minQuantity) {
    return { value: entry.value, minQuantity: entry.minQuantity };
  }
  return null;
}

export interface DiscountConfig {
  discounts: DiscountEntry[];
}

const CONFIG_NAMESPACE = "discounts-allocator";
const SHOP_CONFIG_KEY = "function-configuration";
const DISCOUNT_CONFIG_KEY = "discount-configuration";

// ---------- Read config from metafield ----------

export async function readConfig(admin: any): Promise<{
  config: DiscountConfig;
  ownerId: string;
}> {
  const resp = await admin.graphql(
    `#graphql
    query {
      shop {
        id
        metafield(namespace: "${CONFIG_NAMESPACE}", key: "${SHOP_CONFIG_KEY}") {
          value
        }
      }
    }`
  );
  const json = await resp.json();
  const ownerId = json.data?.shop?.id;
  const meta = json.data?.shop?.metafield;

  let config: DiscountConfig = { discounts: [] };
  if (meta?.value) {
    try {
      const p = JSON.parse(meta.value);
      config = { discounts: p.discounts ?? p.rules ?? [] };
    } catch {}
  }

  // Backfill old entries that predate scope.
  for (const d of config.discounts) {
    if (!d.scope) (d as any).scope = "order";
  }

  return { config, ownerId };
}

// ---------- Write config to metafield ----------

export async function writeConfig(
  admin: any,
  config: DiscountConfig,
  ownerId: string
): Promise<string | null> {
  const resp = await admin.graphql(
    `#graphql
    mutation setConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: CONFIG_NAMESPACE,
            key: SHOP_CONFIG_KEY,
            type: "json",
            value: JSON.stringify(config),
            ownerId,
          },
        ],
      },
    }
  );
  const json = await resp.json();
  const errors = json.data?.metafieldsSet?.userErrors || [];
  if (errors.length > 0) return errors[0].message;

  for (const entry of config.discounts) {
    if (!entry.shopifyDiscountId) continue;
    const err = await writeDiscountConfig(admin, entry.shopifyDiscountId, entry);
    if (err) return err;
  }

  return null;
}

async function writeDiscountConfig(
  admin: any,
  discountId: string,
  entry: DiscountEntry
): Promise<string | null> {
  const resp = await admin.graphql(
    `#graphql
    mutation setDiscountConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            namespace: CONFIG_NAMESPACE,
            key: DISCOUNT_CONFIG_KEY,
            type: "json",
            value: JSON.stringify({ discount: entry }),
            ownerId: discountId,
          },
        ],
      },
    }
  );
  const json = await resp.json();
  const errors = json.data?.metafieldsSet?.userErrors || [];
  return errors.length > 0 ? errors[0].message : null;
}

// ---------- Find function nodes ----------

export const FUNCTION_HANDLE = "discounts-combined";

export async function findFunctionNode(): Promise<{ id: string } | null> {
  // Combined function uses handle, not UUID; return handle string directly.
  return { id: FUNCTION_HANDLE };
}

// ---------- Get linked Shopify discounts ----------

export async function getLinkedDiscounts(
  admin: any,
  functionNodeIds: string | string[]
): Promise<any[]> {
  const ids = Array.isArray(functionNodeIds) ? functionNodeIds : [functionNodeIds];
  const resp = await admin.graphql(
    `#graphql
    query {
      discountNodes(first: 50) {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticApp {
              discountId
              title
              status
              discountClass
              appDiscountType { functionId functionHandle }
            }
          }
        }
      }
    }`
  );
  const json = await resp.json();
  const nodes = json.data?.discountNodes?.nodes || [];
  // Match by functionHandle or functionId (either handle string or UUID).
  return nodes.filter((n: any) => {
    if (n.discount?.__typename !== "DiscountAutomaticApp") return false;
    const handle = n.discount?.appDiscountType?.functionHandle || "";
    const funcId = n.discount?.appDiscountType?.functionId || "";
    return ids.some((id: string) => handle === id || funcId.endsWith(id) || funcId === id);
  });
}

function discountClassesForScope(): string[] {
  // Combined function handles both product and order discounts.
  return ["PRODUCT", "ORDER"];
}

function combinesForScope(scope: string) {
  if (scope === "product") {
    return {
      orderDiscounts: true,
      productDiscounts: false,
      shippingDiscounts: false,
    };
  }
  return {
    orderDiscounts: true,
    productDiscounts: true,
    shippingDiscounts: false,
  };
}

// ---------- Create Shopify discount ----------

export async function createShopifyDiscount(
  admin: any,
  functionNodeId: string,
  entry: DiscountEntry
): Promise<{ discountId?: string; error?: string }> {
  const doCreate = async (scope: string) => {
    const resp = await admin.graphql(
      `#graphql
      mutation createDiscount($discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $discount) {
          automaticAppDiscount { discountId title status }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          discount: {
            title: entry.title || `Discount (${entry.type} ${entry.value})`,
            functionHandle: functionNodeId,
            discountClasses: discountClassesForScope(),
            combinesWith: combinesForScope(scope),
            startsAt: new Date(Date.now() - 60000).toISOString(),
          },
        },
      }
    );
    return await resp.json();
  };

  try {
    const json = await doCreate(entry.scope);
    const result = json.data?.discountAutomaticAppCreate;

    if (result?.userErrors?.length) {
      return { error: result.userErrors.map((e: any) => e.message).join("; ") };
    }
    const discountId = result?.automaticAppDiscount?.discountId;
    if (!discountId) {
      return { error: "Shopify returned no discount ID and no errors" };
    }
    return { discountId };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ---------- Update Shopify discount ----------

export async function updateShopifyDiscount(
  admin: any,
  entry: DiscountEntry,
  functionNodeId: string
): Promise<string | null> {
  if (!entry.shopifyDiscountId) return "No shopifyDiscountId";

  try {
    const resp = await admin.graphql(
      `#graphql
      mutation updateDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
          automaticAppDiscount { discountId }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: entry.shopifyDiscountId,
          discount: {
            title: entry.title || `Discount (${entry.type} ${entry.value})`,
            functionHandle: functionNodeId,
            discountClasses: discountClassesForScope(),
            combinesWith: combinesForScope(entry.scope),
            startsAt: new Date(Date.now() - 60000).toISOString(),
          },
        },
      }
    );
    const json = await resp.json();
    const userErrors = json.data?.discountAutomaticAppUpdate?.userErrors || [];
    return userErrors.length > 0 ? userErrors.map((e: any) => e.message).join("; ") : null;
  } catch (e: any) {
    return e.message;
  }
}

// ---------- Delete Shopify discount ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function deleteShopifyDiscount(
  admin: any,
  discountId: string
): Promise<string | null> {
  try {
    const resp = await admin.graphql(
      `#graphql
      mutation discountAutomaticDelete($id: ID!) {
        discountAutomaticDelete(id: $id) {
          deletedAutomaticDiscountId
          userErrors { field message }
        }
      }`,
      { variables: { id: discountId } }
    );
    const json = await resp.json();

    if (json.errors) {
      const messages = (Array.isArray(json.errors) ? json.errors : [json.errors])
        .map((e: any) => e.message || String(e))
        .join("; ");
      return `GraphQL error: ${messages}`;
    }

    const userErrors = json.data?.discountAutomaticDelete?.userErrors || [];
    if (userErrors.length > 0) {
      return userErrors.map((e: any) => e.message).join("; ");
    }

    await sleep(2000);

    return null;
  } catch (e: any) {
    return e.message;
  }
}
