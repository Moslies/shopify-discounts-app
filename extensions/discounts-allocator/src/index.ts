// ---- Types matching Order Discount API ----

interface CartLine {
  quantity: number;
  cost?: { totalAmount?: { amount?: string } };
  merchandise?: { id?: string };
}

interface Cart {
  lines: CartLine[];
  cost?: { subtotalAmount?: { amount?: string } };
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
  value: string;
  minQuantity: number;
  message: string;
  active: boolean;
  shopifyDiscountId?: string | null;
}

interface DiscountConfig {
  rules?: DiscountEntry[];
  discounts?: DiscountEntry[];
}

interface DiscountOutput {
  targets: { orderSubtotal: { excludedVariantIds: string[] } }[];
  value:
    | { percentage: { value: string } }
    | { fixedAmount: { amount: string; appliesToEachItem: boolean } };
  message?: string;
}

interface FunctionRunResult {
  discounts: DiscountOutput[];
  discountApplicationStrategy: "FIRST" | "MAXIMUM" | "ALL";
}

// ---- Function Entry ----

export function run(input: RunInput): FunctionRunResult {
  const configJson = input.shop.metafield?.value;
  if (!configJson) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  let config: DiscountConfig;
  try {
    config = JSON.parse(configJson);
  } catch {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  // Support both "discounts" and legacy "rules" field
  const entries = config.discounts || config.rules || [];
  const activeEntries = entries.filter((e) => e.active);
  if (activeEntries.length === 0) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  const totalQuantity = input.cart.lines.reduce(
    (sum: number, line: CartLine) => sum + line.quantity,
    0
  );

  const discounts: DiscountOutput[] = activeEntries
    .map((entry) => {
      if (totalQuantity < entry.minQuantity) {
        return null;
      }

      let value: DiscountOutput["value"];
      if (entry.type === "percentage") {
        value = { percentage: { value: entry.value } };
      } else {
        value = {
          fixedAmount: { amount: entry.value, appliesToEachItem: false },
        };
      }

      return {
        targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
        value,
        message: entry.message || entry.title,
      };
    })
    .filter(Boolean) as DiscountOutput[];

  if (discounts.length === 0) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  return {
    discounts,
    discountApplicationStrategy: "FIRST",
  };
}
