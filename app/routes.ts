import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/_index/route.tsx"),

  route("auth/login", "routes/auth.login/route.tsx"),
  route("auth/*", "routes/auth/$.tsx"),
  route("app/proxy/theme-colors", "routes/proxy/app.proxy.theme-colors.tsx"),
  
  route("app", "routes/app/route.tsx", [
    index("routes/app/_index/route.tsx"),

    route("discounts", "routes/app/discounts/route.tsx", [
      // Shared sub-resources
      route("products", "routes/app/discounts/products/route.tsx"),
      route("cleanup", "routes/app/discounts/cleanup/route.tsx"),

      // Order-discount sub-routes
      route("order-discount", "routes/app/discounts/order-discount/route.tsx", [
        index("routes/app/discounts/order-discount/_index/route.tsx"),
        route("new", "routes/app/discounts/order-discount/new/route.tsx"),
        route(":id", "routes/app/discounts/order-discount/$id/route.tsx"),
      ]),

      // Tiered-discount sub-routes
      route("tiered-discount", "routes/app/discounts/tiered-discount/route.tsx", [
        index("routes/app/discounts/tiered-discount/_index/route.tsx"),
        route("new", "routes/app/discounts/tiered-discount/new/route.tsx"),
        route(":id", "routes/app/discounts/tiered-discount/$id/route.tsx"),
      ]),
    ]),

    route("subscriptions", "routes/app/subscriptions/route.tsx", [
      index("routes/app/subscriptions/_index/route.tsx"),
      route("new", "routes/app/subscriptions/new/route.tsx"),
      route(":id", "routes/app/subscriptions/$id/route.tsx"),
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
