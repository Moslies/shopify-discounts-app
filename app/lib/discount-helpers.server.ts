// ----------------------------------------------------------------
// Shared server-side helpers for discount management
// ----------------------------------------------------------------

export const FUNCTION_UUID =
  "46f8b751-0dfd-0f4f-6972-a9f6330bd7491c5b791d-0e4d-4e8d-9d8d-8d8d8d8d8d8d";

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
        metafield(namespace: "$app:discounts-allocator", key: "function-configuration") {
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
            namespace: "$app:discounts-allocator",
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

// ---------- Find our function node ----------

export async function findFunctionNode(
  admin: any
): Promise<{ id: string } | null> {
  const resp = await admin.graphql(
    `#graphql
    query { shopifyFunctions(first: 10) { nodes { id title } } }`
  );
  const json = await resp.json();
  const nodes = json.data?.shopifyFunctions?.nodes || [];
  return (
    nodes.find(
      (n: any) =>
        n.id?.endsWith(FUNCTION_UUID) || n.title === "discounts-allocator"
    ) || null
  );
}

// ---------- Get linked Shopify discounts ----------

export async function getLinkedDiscounts(
  admin: any,
  functionNodeId: string
): Promise<any[]> {
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
      n.discount?.appDiscountType?.functionId === functionNodeId
  );
}

function discountClassesForScope(scope: string): string[] {
  return scope === "product" ? ["PRODUCT"] : ["ORDER"];
}

// ---------- Create Shopify discount ----------

export async function createShopifyDiscount(
  admin: any,
  functionNodeId: string,
  entry: DiscountEntry
): Promise<{ discountId?: string; error?: string }> {
  try {
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
            discountClasses: discountClassesForScope(entry.scope),
            combinesWith: {
              orderDiscounts: true,
              productDiscounts: true,
              shippingDiscounts: false,
            },
            startsAt: new Date().toISOString(),
          },
        },
      }
    );
    const json = await resp.json();
    const result = json.data?.discountAutomaticAppCreate;
    if (result?.userErrors?.length) {
      return { error: result.userErrors[0].message };
    }
    return { discountId: result?.automaticAppDiscount?.discountId };
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
            combinesWith: {
              orderDiscounts: true,
              productDiscounts: true,
              shippingDiscounts: false,
            },
            startsAt: new Date().toISOString(),
          },
        },
      }
    );
    const json = await resp.json();
    const errors = json.data?.discountAutomaticAppUpdate?.userErrors || [];
    return errors.length > 0 ? errors[0].message : null;
  } catch (e: any) {
    return e.message;
  }
}

// ---------- Delete Shopify discount ----------

export async function deleteShopifyDiscount(
  admin: any,
  discountId: string
): Promise<string | null> {
  try {
    const resp = await admin.graphql(
      `#graphql
      mutation deleteDiscount($id: ID!) {
        discountAutomaticAppDelete(id: $id) {
          userErrors { field message }
        }
      }`,
      { variables: { id: discountId } }
    );
    const json = await resp.json();
    const errors = json.data?.discountAutomaticAppDelete?.userErrors || [];
    return errors.length > 0 ? errors[0].message : null;
  } catch (e: any) {
    return e.message;
  }
}
