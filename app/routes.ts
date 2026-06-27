import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/_index/route.tsx"),

  route("auth/login", "routes/auth.login/route.tsx"),
  route("auth/*", "routes/auth/$.tsx"),

  route("app", "routes/app/route.tsx", [
    index("routes/app/_index/route.tsx"),

    route("discounts", "routes/app/discounts/route.tsx", [
      index("routes/app/discounts/_index/route.tsx"),
      route("new", "routes/app/discounts/new/route.tsx"),
      route("cleanup", "routes/app/discounts/cleanup/route.tsx"),
      route("products", "routes/app/discounts/products/route.tsx"),
      route(":id", "routes/app/discounts/$id/route.tsx"),
    ]),
  ]),

  route(
    "webhooks/app/scopes_update",
    "routes/webhooks/app/scopes_update/route.tsx",
  ),
  route(
    "webhooks/app/uninstalled",
    "routes/webhooks/app/uninstalled/route.tsx",
  ),
] satisfies RouteConfig;
