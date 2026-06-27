import { useEffect, useMemo, useState } from "react";
import type { HeadersFunction } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { loader } from "./loader.server";
export { loader };
import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function CleanupPage() {
  const { orphans, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isDeleting =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "DELETE";

  // Derived: are all items selected?
  const allSelected = useMemo(
    () => orphans.length > 0 && selected.size === orphans.length,
    [orphans, selected]
  );

  // Toast for action result
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show(`${fetcher.data.deletedCount} orphan discount(s) deleted from Shopify`);
      setTimeout(() => window.location.reload(), 1200);
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orphans.map((o) => o.discountId)));
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} orphan discount(s) from Shopify?`)) return;
    fetcher.submit(
      { discountIds: JSON.stringify([...selected]) },
      { method: "DELETE" }
    );
  };

  const handleDeleteAll = () => {
    if (orphans.length === 0) return;
    if (!window.confirm(`Delete all ${orphans.length} orphan discount(s) from Shopify?`)) return;
    fetcher.submit(
      { discountIds: JSON.stringify(orphans.map((o) => o.discountId)) },
      { method: "DELETE" }
    );
  };

  return (
    <s-page heading="Clean Up Orphan Discounts">
      <s-button slot="primary-action" variant="tertiary" onClick={() => navigate("/app/discounts")}>
        Back to Discounts
      </s-button>

      {error ? (
        <s-banner tone="critical">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      ) : orphans.length === 0 ? (
        <s-banner>
          <s-paragraph>
            No orphan discounts found. All Shopify discounts are linked to your local config.
          </s-paragraph>
        </s-banner>
      ) : (
        <>
          <s-banner tone="warning">
            <s-paragraph>
              Found <strong>{orphans.length}</strong> discount(s) in Shopify that are no longer in your local config.
              These were likely left behind when the local delete didn't sync properly.
            </s-paragraph>
          </s-banner>

          <s-section heading="Orphan Discounts">
            {orphans.length > 1 && (
              <s-stack direction="inline" gap="base" alignItems="center" paddingBlockEnd="base">
                <s-button
                  variant={allSelected ? "primary" : "secondary"}
                  onClick={handleSelectAll}
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </s-button>
                <s-button
                  variant="secondary"
                  tone="critical"
                  disabled={selected.size === 0 || isDeleting}
                  onClick={handleDeleteSelected}
                  {...(isDeleting ? { loading: true } : {})}
                >
                  Delete Selected ({selected.size})
                </s-button>
                <s-button
                  variant="tertiary"
                  tone="critical"
                  disabled={orphans.length === 0 || isDeleting}
                  onClick={handleDeleteAll}
                  {...(isDeleting ? { loading: true } : {})}
                >
                  Delete All
                </s-button>
              </s-stack>
            )}

            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-stack direction="block" gap="base">
                {orphans.map((entry) => (
                  <s-box
                    key={entry.discountId}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                    {...(selected.has(entry.discountId)
                      ? { background: "strong" as const }
                      : {})}
                  >
                    <s-stack
                      direction="inline"
                      gap="base"
                      alignItems="center"
                    >
                      <s-button
                        variant="tertiary"
                        onClick={() => toggleItem(entry.discountId)}
                      >
                        {selected.has(entry.discountId) ? "Selected" : "Select"}
                      </s-button>
                      <s-stack direction="block" gap="none" inlineSize="100%">
                        <s-text color="base">
                          {entry.title}
                        </s-text>
                        <s-text color="subdued">
                          ID: {entry.discountId}
                          {" - "}Status: {entry.status}
                        </s-text>
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))}
              </s-stack>
            </s-box>
          </s-section>
        </>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
