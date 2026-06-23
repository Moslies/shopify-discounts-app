// ----------------------------------------------------------------
// Shared server-side helpers for discount management
// ----------------------------------------------------------------

export const FUNCTION_UUID =
  "46f8b751-0dfd-0f4f-6972-a9f6330bd7491c5b791d-0e4d-4e8d-9d8d-8d8d8d8d8d8d";

export const PRODUCT_FUNCTION_UUID =
  "46f8b751-0dfd-0f4f-6972-a9f6330bd7492a6b791d-1e4d-5e8d-8d8d-7d7d7d7d7d7d";

export interface DiscountTier {
  minQuantity: number;
  value: string;
}

export interface DiscountEntry {
  id: string;
  title: string;
  type: "percentage" | "fixed_amount";
  /** 折扣作用范围: "order" = 订单减价, "product" = 产品减价 */
  scope: "order" | "product";
  value: string;
  minQuantity: number;
  message: string;
  active: boolean;
  shopifyDiscountId?: string | null;
  /** 商品折扣绑定的商品 GID 列表，为空则适用于所有商品 */
  productIds?: string[];
  /** 多阶梯折扣规则，为空则使用 value+minQuantity 作为默认规则 */
  tiers?: DiscountTier[];
}

/**
 * 根据购买数量选择最优的折扣阶梯
 * 1. 有 tiers 且不为空 → 选择满足条件的最高阶梯
 * 2. 否则使用默认的 value + minQuantity（向后兼容）
 */
export function resolveBestTier(
  totalQuantity: number,
  entry: { tiers?: DiscountTier[]; minQuantity: number; value: string }
): { value: string; minQuantity: number } | null {
  if (entry.tiers && entry.tiers.length > 0) {
    const sorted = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    let best = null;
    for (const tier of sorted) {
      if (totalQuantity >= tier.minQuantity) {
        best = tier;
      }
    }
    return best ? { value: best.value, minQuantity: best.minQuantity } : null;
  }
  if (totalQuantity >= entry.minQuantity) {
    return { value: entry.value, minQuantity: entry.minQuantity };
  }
  return null;
}

export interface DiscountConfig {
  discounts: DiscountEntry[];
}

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
        metafield(namespace: "discounts-allocator", key: "function-configuration") {
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
  // 兼容无 scope 的旧数据，默认订单减价
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
            namespace: "discounts-allocator",
            key: "function-configuration",
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
  return errors.length > 0 ? errors[0].message : null;
}

// ---------- Find function nodes ----------

export async function findFunctionNode(
  admin: any,
  uuid?: string
): Promise<{ id: string } | null> {
  const targetUuid = uuid || FUNCTION_UUID;
  const resp = await admin.graphql(
    `#graphql
    query { shopifyFunctions(first: 10) { nodes { id title } } }`
  );
  const json = await resp.json();
  const nodes = json.data?.shopifyFunctions?.nodes || [];
  return (
    nodes.find((n: any) => n.id?.endsWith(targetUuid) || n.title === "discounts-allocator") || null
  );
}

export async function findProductFunctionNode(
  admin: any
): Promise<{ id: string } | null> {
  const resp = await admin.graphql(
    `#graphql
    query { shopifyFunctions(first: 10) { nodes { id title } } }`
  );
  const json = await resp.json();
  const nodes = json.data?.shopifyFunctions?.nodes || [];
  return (
    nodes.find((n: any) => n.id?.endsWith(PRODUCT_FUNCTION_UUID) || n.title === "discounts-product") || null
  );
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
              appDiscountType { functionId }
            }
          }
        }
      }
    }`
  );
  const json = await resp.json();
  const nodes = json.data?.discountNodes?.nodes || [];
  return nodes.filter(
    (n: any) =>
      n.discount?.__typename === "DiscountAutomaticApp" &&
      ids.includes(n.discount?.appDiscountType?.functionId)
  );
}

function discountClassesForScope(scope: string): string[] {
  return scope === "product" ? ["PRODUCT"] : ["ORDER"];
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
            functionId: functionNodeId,
            discountClasses: discountClassesForScope(scope),
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
            functionId: functionNodeId,
            discountClasses: discountClassesForScope(entry.scope),
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

    // Check for GraphQL-level errors first
    if (json.errors) {
      const messages = (Array.isArray(json.errors) ? json.errors : [json.errors])
        .map((e: any) => e.message || String(e))
        .join("; ");
      return `GraphQL error: ${messages}`;
    }

    // Check for application-level errors
    const userErrors = json.data?.discountAutomaticDelete?.userErrors || [];
    if (userErrors.length > 0) {
      return userErrors.map((e: any) => e.message).join("; ");
    }

    // Wait for Shopify's monorail telemetry + cache invalidation to complete
    // so the next query returns fresh data
    await sleep(2000);

    return null;
  } catch (e: any) {
    return e.message;
  }
}
