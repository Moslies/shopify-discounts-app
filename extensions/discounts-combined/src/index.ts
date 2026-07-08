// ---- Types matching Unified Discount Function API ----

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
  cost?: { subtotalAmount?: { amount?: string }; totalAmount?: { amount?: string; currencyCode?: string } };
}

interface Shop {
  metafield?: { value: string } | null;
}

interface Discount {
  metafield?: { value: string } | null;
}

interface RunInput {
  cart: Cart;
  shop: Shop;
  discount: Discount;
}

// ---- Config types (shared) ----

interface DiscountTier {
  minQuantity: number;
  value: string;
  message?: string;
  comboName?: string;
  badgeText?: string;
}

interface DiscountEntry {
  id: string;
  title: string;
  type: "percentage" | "fixed_amount";
  scope: "order" | "tiered";
  value: string;
  minQuantity: number;
  active: boolean;
  productIds?: string[];
  tiers?: DiscountTier[];
}

interface DiscountConfig {
  rules?: DiscountEntry[];
  discounts?: DiscountEntry[];
  discount?: DiscountEntry;
}

// ---- Output types for unified Discount Function API ----

interface CartLineTarget {
  cartLine: { id: string; quantity: number };
}

interface OrderSubtotalTarget {
  orderSubtotal: { excludedCartLineIds: string[] };
}

type ProductCandidateValue =
  | { percentage: { value: string } }
  | { fixedAmount: { amount: string; appliesToEachItem: boolean } };

type OrderCandidateValue =
  | { percentage: { value: string } }
  | { fixedAmount: { amount: string } };

interface ProductCandidate {
  message?: string;
  targets: CartLineTarget[];
  value: ProductCandidateValue;
}

interface OrderCandidate {
  message?: string;
  targets: OrderSubtotalTarget[];
  value: OrderCandidateValue;
}

interface Operation {
  productDiscountsAdd?: {
    candidates: ProductCandidate[];
    selectionStrategy: "ALL" | "FIRST";
  };
  orderDiscountsAdd?: {
    candidates: OrderCandidate[];
    selectionStrategy: "ALL" | "FIRST";
  };
}

interface FunctionRunResult {
  operations: Operation[];
}

// ---- Helper ----

function resolveBestTier(
  totalQuantity: number,
  entry: { tiers?: DiscountTier[]; minQuantity: number; value: string }
): { value: string; message?: string } | null {
  if (entry.tiers && entry.tiers.length > 0) {
    const sorted = [...entry.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    let best = null;
    for (const tier of sorted) {
      if (totalQuantity >= tier.minQuantity) {
        best = tier;
      }
    }
    return best ? { value: best.value, message: best.message } : null;
  }
  if (totalQuantity >= entry.minQuantity) {
    return { value: entry.value };
  }
  return null;
}

// ---- Estimate discount amount for threshold adjustment ----

function estimateDiscountAmount(
  type: "percentage" | "fixed_amount",
  tierValue: string,
  groupTotal: number,
  groupQuantity: number
): number {
  if (type === "percentage") {
    return groupTotal * (parseFloat(tierValue) / 100);
  }
  // fixed_amount uses appliesToEachItem: true, so it is per unit.
  return groupQuantity * parseFloat(tierValue);
}

function totalForProducts(lines: CartLine[], productIds: string[]): number {
  return lines
    .filter((line) => {
      const productId = line.merchandise?.product?.id;
      return productId ? productIds.includes(productId) : false;
    })
    .reduce((sum, line) => sum + parseFloat(line.cost?.totalAmount?.amount || "0"), 0);
}

function entriesFromConfig(config: DiscountConfig | DiscountEntry): DiscountEntry[] {
  const maybeConfig = config as DiscountConfig;
  if (Array.isArray(maybeConfig.discounts)) return maybeConfig.discounts;
  if (Array.isArray(maybeConfig.rules)) return maybeConfig.rules;
  if (maybeConfig.discount) return [maybeConfig.discount];
  return [config as DiscountEntry];
}

// ---- Compute product discount candidates & estimated discount ----

function computeProductDiscounts(
  cartLines: CartLine[],
  entries: DiscountEntry[],
  currencyCode: string
): { candidates: ProductCandidate[]; estimatedDiscount: number } {
  const candidates: ProductCandidate[] = [];
  let estimatedDiscount = 0;

  for (const entry of entries) {
    const productIds = entry.productIds || [];
    const eligibleLines = productIds.length === 0
      ? cartLines
      : cartLines.filter((line) => {
          const pid = line.merchandise?.product?.id;
          return pid ? productIds.includes(pid) : false;
        });

    if (eligibleLines.length === 0) continue;

    // Group by product
    const groups = new Map<string, { lines: CartLine[]; total: number; qty: number }>();

    const isUnbound = productIds.length === 0;
    if (isUnbound) {
      const total = eligibleLines.reduce((s, l) => s + parseFloat(l.cost?.totalAmount?.amount || "0"), 0);
      const qty = eligibleLines.reduce((s, l) => s + l.quantity, 0);
      groups.set("__all__", { lines: eligibleLines, total, qty });
    } else {
      for (const line of eligibleLines) {
        const pid = line.merchandise?.product?.id || "__unknown__";
        if (!groups.has(pid)) groups.set(pid, { lines: [], total: 0, qty: 0 });
        const g = groups.get(pid)!;
        g.lines.push(line);
        g.total += parseFloat(line.cost?.totalAmount?.amount || "0");
        g.qty += line.quantity;
      }
    }

    for (const group of groups.values()) {
      const tier = resolveBestTier(group.qty, entry);
      if (!tier) continue;

      const targets: CartLineTarget[] = group.lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({ cartLine: { id: l.id, quantity: l.quantity } }));

      if (targets.length === 0) continue;

      const value: ProductCandidateValue = entry.type === "percentage"
        ? { percentage: { value: tier.value } }
        : { fixedAmount: { amount: tier.value, appliesToEachItem: true } };

      candidates.push({
        message: tier.message || `Save ${tier.value}${entry.type === "percentage" ? "%" : ` ${currencyCode}`}`,
        targets,
        value,
      });

      estimatedDiscount += estimateDiscountAmount(
        entry.type, tier.value, group.total, group.qty
      );
    }
  }

  return { candidates, estimatedDiscount };
}

/** Merge product entries from the shop metafield into the node-scoped entries, so
 *  the order node can estimate the product discount amount for effectiveSubtotal. */
function allProductEntries(input: RunInput): DiscountEntry[] {
  const seen = new Set<string>();
  const result: DiscountEntry[] = [];

  // Entries already visible to this node
  const nodeJson = input.discount.metafield?.value;
  if (nodeJson) {
    try {
      const nodeEntries = entriesFromConfig(JSON.parse(nodeJson)).filter(
        (e) => e.active && e.scope === "tiered"
      );
      for (const e of nodeEntries) { seen.add(e.id); result.push(e); }
    } catch {}
  }

  // Product entries from the shop metafield that this node hasn't seen
  const shopJson = input.shop.metafield?.value;
  if (shopJson) {
    try {
      const shopEntries = entriesFromConfig(JSON.parse(shopJson)).filter(
        (e) => e.active && e.scope === "tiered" && !seen.has(e.id)
      );
      result.push(...shopEntries);
    } catch {}
  }

  return result;
}

// ---- Function Entry ----

export function run(input: RunInput): FunctionRunResult {
  const noDiscount: FunctionRunResult = { operations: [] };

  const configJson = input.discount.metafield?.value || input.shop.metafield?.value;
  if (!configJson) return noDiscount;

  let config: DiscountConfig | DiscountEntry;
  try { config = JSON.parse(configJson); } catch { return noDiscount; }

  const entries = entriesFromConfig(config);
  const productEntries = entries.filter((e) => e.active && e.scope === "tiered");
  const orderEntries = entries.filter((e) => e.active && e.scope !== "tiered");

  const cartLines = input.cart.lines;
  const currencyCode = input.cart.cost?.totalAmount?.currencyCode || "";
  const operations: Operation[] = [];

  // ---- Process product discounts ----

  const { candidates: productCandidates, estimatedDiscount: totalEstimatedProductDiscount } =
    computeProductDiscounts(cartLines, productEntries, currencyCode);

  if (productCandidates.length > 0) {
    operations.push({
      productDiscountsAdd: {
        candidates: productCandidates,
        selectionStrategy: "ALL",
      },
    });
  }

  // ---- Process order discounts ----

  if (orderEntries.length > 0) {
    const rawSubtotal = parseFloat(input.cart.cost?.subtotalAmount?.amount || "0");

    // If this node didn't see product entries (e.g. it's the order node running
    // independently), re-estimate the product discount from all known entries
    // so effectiveSubtotal correctly reflects already-applied product discounts.
    let effectiveProductDiscount = totalEstimatedProductDiscount;
    if (totalEstimatedProductDiscount === 0) {
      effectiveProductDiscount = computeProductDiscounts(
        cartLines, allProductEntries(input), currencyCode
      ).estimatedDiscount;
    }

    const effectiveSubtotal = Math.max(0, rawSubtotal - effectiveProductDiscount);
    const orderCandidates: OrderCandidate[] = [];

    for (const entry of orderEntries) {
      const productIds = entry.productIds || [];
      const thresholdAmount = productIds.length > 0
        ? totalForProducts(cartLines, productIds)
        : effectiveSubtotal;
      const tier = resolveBestTier(thresholdAmount, entry);
      if (!tier) continue;

      const value: OrderCandidateValue = entry.type === "percentage"
        ? { percentage: { value: tier.value } }
        : { fixedAmount: { amount: tier.value } };

      orderCandidates.push({
        message: tier.message || entry.title,
        targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
        value,
      });
    }

    if (orderCandidates.length > 0) {
      operations.push({
        orderDiscountsAdd: {
          candidates: orderCandidates,
          selectionStrategy: "FIRST",
        },
      });
    }
  }

  return { operations };
}
