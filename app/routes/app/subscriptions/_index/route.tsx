import { useEffect, useState } from "react";
import type { HeadersFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import ConfirmDialog from "@/components/ConfirmDialog";

import { loader } from "./loader.server";
export { loader };
import { action } from "./action.server";
export { action };

// ----------------------------------------------------------------
// Components
// ----------------------------------------------------------------

function DeleteButton({ id }: { id: string }) {
  const fetcher = useFetcher<typeof action>();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (fetcher.data?.ok) {
      setConfirming(false);
    }
  }, [fetcher.data]);

  return (
    <>
      <s-button variant="tertiary" tone="critical" onClick={() => setConfirming(true)}>
        Delete
      </s-button>
      <ConfirmDialog
        open={confirming}
        title="Delete subscription group"
        message="Are you sure you want to delete this subscription group? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => fetcher.submit({ id }, { method: "POST" })}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

export default function SubscriptionListPage() {
  const { groups } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.state === "idle") {
      shopify.toast.show("Subscription group deleted");
    } else if (fetcher.data?.ok === false && fetcher.data?.errors) {
      shopify.toast.show(`Error: ${fetcher.data.errors[0]}`);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  return (
    <s-page heading="Subscription Groups">
      <s-button slot="primary-action" variant="primary" onClick={() => navigate("/app/subscriptions/new")}>
        Create subscription group
      </s-button>

      {groups.length === 0 ? (
        <s-section heading="No subscription groups yet">
          <s-paragraph>
            Create your first subscription group to offer subscription purchase options to your customers.
          </s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`${groups.length} subscription groups`}>
          <s-box padding="base" borderWidth="large-100" borderRadius="base">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--s-border-color, #ccc)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Code</th>
                  <th style={{ textAlign: "left", padding: "8px 12px" }}>Plans</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", width: "18%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group: any) => (
                  <tr key={group.id} style={{ borderBottom: "1px solid var(--s-border-color-subdued, #eee)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="base">{group.name}</s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">{group.merchantCode}</s-text>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-text color="subdued">{group.sellingPlans?.nodes?.length ?? 0}</s-text>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <s-stack direction="inline" gap="base">
                        <s-button variant="tertiary" onClick={() => navigate(`/app/subscriptions/${group.id.split("/").pop()}`)}>
                          Edit
                        </s-button>
                        <DeleteButton id={group.id} />
                      </s-stack>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
