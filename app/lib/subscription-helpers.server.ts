type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> }
  ) => Promise<{ json: () => Promise<unknown> }>;
};

export const SELLING_PLAN_GROUPS_QUERY = `#graphql
  query SellingPlanGroups {
    sellingPlanGroups(first: 50) {
      nodes {
        id
        name
        merchantCode
        description
        summary
        options
        sellingPlans(first: 10) {
          nodes {
            id
            name
          }
        }
        productsCount {
          count
        }
      }
    }
  }
`;

export const GET_SELLING_PLAN_GROUP_QUERY = `#graphql
  query GetSellingPlanGroup($id: ID!) {
    sellingPlanGroup(id: $id) {
      id
      name
      merchantCode
      description
      products(first: 10) {
        nodes {
          id
          title
        }
      }
      productsCount {
        count
      }
      sellingPlans(first: 10) {
        nodes {
          id
          name
          pricingPolicies {
            ... on SellingPlanFixedPricingPolicy {
              adjustmentType
              adjustmentValue {
                ... on SellingPlanPricingPolicyPercentageValue {
                  percentage
                }
              }
            }
          }
          billingPolicy {
            ... on SellingPlanRecurringBillingPolicy {
              interval
              intervalCount
            }
          }
          deliveryPolicy {
            ... on SellingPlanRecurringDeliveryPolicy {
              interval
              intervalCount
            }
          }
        }
      }
    }
  }
`;

export const DELETE_MUTATION = `#graphql
  mutation SellingPlanGroupDelete($id: ID!) {
    sellingPlanGroupDelete(id: $id) {
      userErrors { field message }
    }
  }
`;

export const CREATE_MUTATION = `#graphql
  mutation SellingPlanGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) {
    sellingPlanGroupCreate(input: $input, resources: $resources) {
      sellingPlanGroup {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const UPDATE_MUTATION = `#graphql
  mutation SellingPlanGroupUpdate($id: ID!, $input: SellingPlanGroupInput!) {
    sellingPlanGroupUpdate(id: $id, input: $input) {
      sellingPlanGroup { id name }
      userErrors { field message }
    }
  }
`;

export const ADD_PRODUCTS_MUTATION = `#graphql
  mutation SellingPlanGroupAddProducts($id: ID!, $productIds: [ID!]!) {
    sellingPlanGroupAddProducts(id: $id, productIds: $productIds) {
      sellingPlanGroup { id name }
      userErrors { field message }
    }
  }
`;

export const REMOVE_PRODUCTS_MUTATION = `#graphql
  mutation SellingPlanGroupRemoveProducts($id: ID!, $productIds: [ID!]!) {
    sellingPlanGroupRemoveProducts(id: $id, productIds: $productIds) {
      removedProductIds
      userErrors { field message }
    }
  }
`;

/** Fetch only the product IDs of a selling plan group (for use in the update flow). */
export const GET_SELLING_PLAN_GROUP_PRODUCTS_QUERY = `#graphql
  query GetSellingPlanGroupProducts($id: ID!) {
    sellingPlanGroup(id: $id) {
      products(first: 250) {
        nodes { id }
      }
    }
  }
`;

export async function fetchSellingPlanGroups(admin: AdminClient) {
  const response = await admin.graphql(SELLING_PLAN_GROUPS_QUERY);
  const responseJson = (await response.json()) as {
    data?: { sellingPlanGroups?: { nodes?: Array<Record<string, unknown>> } };
  };

  return responseJson.data?.sellingPlanGroups?.nodes ?? [];
}

export async function fetchSellingPlanGroup(admin: AdminClient, id: string) {
  const response = await admin.graphql(GET_SELLING_PLAN_GROUP_QUERY, {
    variables: { id },
  });
  const responseJson = (await response.json()) as {
    data?: { sellingPlanGroup?: Record<string, unknown> };
  };

  return responseJson.data?.sellingPlanGroup;
}

export async function createSellingPlanGroup(
  admin: AdminClient,
  input: Record<string, unknown>,
  resources?: Record<string, unknown>
) {
  const variables: Record<string, unknown> = { input };
  if (resources && Object.keys(resources).length > 0) {
    variables.resources = resources;
  }

  const response = await admin.graphql(CREATE_MUTATION, {
    variables,
  });
  const responseJson = (await response.json()) as {
    data?: {
      sellingPlanGroupCreate?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  };

  const userErrors = responseJson.data?.sellingPlanGroupCreate?.userErrors ?? [];
  return { userErrors };
}

export async function updateSellingPlanGroup(
  admin: AdminClient,
  id: string,
  input: Record<string, unknown>
) {
  const response = await admin.graphql(UPDATE_MUTATION, {
    variables: { id, input },
  });
  const responseJson = (await response.json()) as {
    data?: {
      sellingPlanGroupUpdate?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  };

  const userErrors = responseJson.data?.sellingPlanGroupUpdate?.userErrors ?? [];
  return { userErrors };
}

export async function addProductsToSellingPlanGroup(
  admin: AdminClient,
  id: string,
  productIds: string[]
) {
  const response = await admin.graphql(ADD_PRODUCTS_MUTATION, {
    variables: { id, productIds },
  });
  const responseJson = (await response.json()) as {
    data?: {
      sellingPlanGroupAddProducts?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  };

  const userErrors = responseJson.data?.sellingPlanGroupAddProducts?.userErrors ?? [];
  return { userErrors };
}

export async function fetchSellingPlanGroupProductIds(admin: AdminClient, id: string) {
  const response = await admin.graphql(GET_SELLING_PLAN_GROUP_PRODUCTS_QUERY, {
    variables: { id },
  });
  const responseJson = (await response.json()) as {
    data?: { sellingPlanGroup?: { products?: { nodes?: Array<{ id: string }> } } };
  };

  return (
    responseJson.data?.sellingPlanGroup?.products?.nodes?.map((n) => n.id) ?? []
  );
}

export async function removeProductsFromSellingPlanGroup(
  admin: AdminClient,
  id: string,
  productIds: string[]
) {
  const response = await admin.graphql(REMOVE_PRODUCTS_MUTATION, {
    variables: { id, productIds },
  });
  const responseJson = (await response.json()) as {
    data?: {
      sellingPlanGroupRemoveProducts?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  };

  const userErrors = responseJson.data?.sellingPlanGroupRemoveProducts?.userErrors ?? [];
  return { userErrors };
}

export async function deleteSellingPlanGroup(admin: AdminClient, id: string) {
  const response = await admin.graphql(DELETE_MUTATION, {
    variables: { id },
  });
  const responseJson = (await response.json()) as {
    data?: {
      sellingPlanGroupDelete?: {
        userErrors?: Array<{ field?: string; message?: string }>;
      };
    };
  };

  const userErrors = responseJson.data?.sellingPlanGroupDelete?.userErrors ?? [];
  return { userErrors };
}
