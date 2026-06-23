interface CartLine {
  id: string;
  quantity: number;
  cost?: { totalAmount?: { amount?: string } };
  merchandise?: {
    id?: string;
    product?: { id?: string };
  };
}

interface Cart {
  lines: CartLine[];
}

interface Shop {
  metafield?: { value: string } | null;
}

interface RunInput {
  cart: Cart;
  shop: Shop;
}

interface DiscountEntry {
  id: string;
  title: string;
  type: "percentage" | "fixed_amount";
  scope: "order" | "product";
  value: string;
  minQuantity: number;
  message: string;
  active: boolean;
  productIds?: string[];
  tiers?: { minQuantity: number; value: string }[];
}

interface DiscountTier {
  minQuantity: number;
  value: string;
}

function resolveBestTier(
  totalQuantity: number,
  entry: { tiers?: DiscountTier[]; minQuantity: number; value: string }
): { value: string } | null {
  if (entry.tiers && entry.tiers.length > 0) {
    const sorted = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    let best = null;
    for (const tier of sorted) {
      if (totalQuantity >= tier.minQuantity) best = tier;
    }
    return best ? { value: best.value } : null;
  }
  if (totalQuantity >= entry.minQuantity) return { value: entry.value };
  return null;
}

interface DiscountConfig {
  rules?: DiscountEntry[];
  discounts?: DiscountEntry[];
}

interface FunctionRunResult {
  discounts: Discount[];
  discountApplicationStrategy: "FIRST" | "MAXIMUM" | "ALL";
}

interface Discount {
  targets: Target[];
  value: DiscountValue;
  message?: string;
}

interface Target {
  productVariant: { id: string };
}

interface DiscountValue {
  percentage?: { value: string };
  fixedAmount?: { amount: string; appliesToEachItem: boolean };
}

interface ProductGroup {
  productId: string;
  lines: CartLine[];
}

export function run(input: RunInput): FunctionRunResult {
  const noDiscount: FunctionRunResult = {
    discounts: [],
    discountApplicationStrategy: "ALL"
  };

  const configJson = input.shop.metafield?.value;
  if (!configJson) return noDiscount;

  let config: DiscountConfig;
  try {
    config = JSON.parse(configJson);
  } catch {
    return noDiscount;
  }

  const entries = config.discounts || config.rules || [];

  const activeEntries = entries.filter(
    (e) => e.active && e.scope === "product"
  );
  if (activeEntries.length === 0) return noDiscount;

  const discounts: Discount[] = [];

  for (const entry of activeEntries) {
    // 过滤该规则适用的购物车行
    const productIds = entry.productIds || [];
    const eligibleLines = productIds.length === 0
      ? input.cart.lines
      : input.cart.lines.filter((line) => {
          const pid = line.merchandise?.product?.id;
          return pid ? productIds.includes(pid) : false;
        });

    if (eligibleLines.length === 0) continue;

    // 按 productId 分组，每个产品独立计算数量是否达标
    const groups = new Map<string, ProductGroup>();

    const isUnbound = productIds.length === 0;
    // 未绑定特定产品时，整批视为一组
    if (isUnbound) {
      groups.set("__all__", { productId: "__all__", lines: eligibleLines });
    } else {
      for (const line of eligibleLines) {
        const pid = line.merchandise?.product?.id || "__unknown__";
        if (!groups.has(pid)) {
          groups.set(pid, { productId: pid, lines: [] });
        }
        groups.get(pid)!.lines.push(line);
      }
    }

    for (const group of groups.values()) {
      const groupQuantity = group.lines.reduce(
        (sum, line) => sum + line.quantity,
        0
      );

      // 每个产品独立判断阶梯
      const tier = resolveBestTier(groupQuantity, entry);
      if (!tier) continue;

      // 构建该产品的 targets
      const targets: Target[] = group.lines
        .filter((line) => line.quantity > 0 && line.merchandise?.id)
        .map((line) => ({
          productVariant: { id: line.merchandise!.id as string }
        }));

      if (targets.length === 0) continue;

      const value: DiscountValue = entry.type === "percentage"
        ? { percentage: { value: tier.value } }
        : { fixedAmount: { amount: tier.value, appliesToEachItem: false } };

      discounts.push({
        targets,
        value,
        message: entry.message || `省 ${tier.value}${entry.type === "percentage" ? "%" : "元"}`
      });
    }
  }
  return {
    discounts,
    discountApplicationStrategy: "ALL"
  };
}
