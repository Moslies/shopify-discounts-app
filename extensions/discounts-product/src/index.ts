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

    // 计算该规则适用商品的总数量
    const ruleQuantity = eligibleLines.reduce(
      (sum, line) => sum + line.quantity,
      0
    );

    // 不满足最低购买数量，跳过
    if (ruleQuantity < entry.minQuantity) continue;

    // 构建 targets
    const targets: Target[] = eligibleLines
      .filter((line) => line.quantity > 0 && line.merchandise?.id)
      .map((line) => ({
        productVariant: { id: line.merchandise!.id as string }
      }));

    if (targets.length === 0) continue;

    // 构建折扣值
    const value: DiscountValue = entry.type === "percentage"
      ? { percentage: { value: entry.value } }
      : { fixedAmount: { amount: entry.value, appliesToEachItem: false } };

    discounts.push({
      targets,
      value,
      message: entry.message || `省 ${entry.value}${entry.type === "percentage" ? "%" : "元"}`
    });
  }

  return {
    discounts,
    discountApplicationStrategy: "ALL"
  };
}
