import type { ActionFunctionArgs } from "react-router";
import { login } from "@/shopify.server";
import { loginErrorMessage } from "./error.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};
