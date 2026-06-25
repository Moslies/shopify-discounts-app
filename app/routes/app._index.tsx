import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="欢迎使用 🎉">
      <s-section heading="你好，欢迎来到 Bundle Sales Shop 应用！">
        <s-paragraph>
          感谢你使用本应用。这里是你的应用仪表盘，你可以在这里管理店铺的各项功能。
        </s-paragraph>
        <s-paragraph>
          本应用基于 Shopify 平台构建，使用现代化的技术栈，为你提供便捷的店铺管理体验。
        </s-paragraph>
      </s-section>

      <s-section heading="快速开始">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/discounts">查看折扣规则</s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/api/admin-graphql"
              target="_blank"
            >
              了解 Shopify Admin API
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://reactrouter.com/"
              target="_blank"
            >
              了解 React Router
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section heading="功能特色">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>🚀 高性能</s-heading>
            <s-paragraph>
              使用 React Router 构建的现代化单页应用，响应迅速。
            </s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>🔒 安全可靠</s-heading>
            <s-paragraph>
              基于 Shopify 官方认证流程，确保数据安全。
            </s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>🎨 精美界面</s-heading>
            <s-paragraph>
              使用 Polaris 设计系统，界面简洁美观。
            </s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>⚡ 强大 API</s-heading>
            <s-paragraph>
              集成 Shopify GraphQL API，功能丰富强大。
            </s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="小贴士">
        <s-paragraph>
          开始探索你的应用，你会发现更多强大的功能！
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};