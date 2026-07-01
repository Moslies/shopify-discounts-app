import { authenticate } from "@/shopify.server";

export const loader = async ({ request }: { request: Request }) => {
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return Response.json({ error: "Admin context is unavailable" }, { status: 401 });
  }

  const response = await admin.graphql(`
    query {
      themes(first: 10) {
        edges {
          node {
            role
            files(filenames: ["config/settings_data.json"]) {
              edges {
                node {
                  body {
                    ... on OnlineStoreThemeFileBodyText {
                      content
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const result = await response.json();
  const activeTheme = result.data?.themes?.edges?.find(
    ({ node }: any) => node.role === "MAIN"
  );

  if (!activeTheme) {
    return Response.json(
      { error: "No active theme found" },
      { status: 400 }
    );
  }

  const fileContent =
    activeTheme.node.files?.edges?.[0]?.node?.body?.content;

  if (!fileContent) {
    return Response.json(
      { error: "No settings_data.json found, check read_themes scope" },
      { status: 400 }
    );
  }

  // 去掉 /* */ 注释再解析
  const cleanContent = fileContent.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const content = JSON.parse(cleanContent);
  return Response.json({ current: content.current });

};
