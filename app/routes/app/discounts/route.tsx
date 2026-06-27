import { Outlet } from "react-router";
import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function DiscountsLayout() {
  return <Outlet />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
