const LOCAL_BACKEND_API_URL = "http://localhost:3001";
const LOCAL_FRONTEND_APP_URL = "http://localhost:3002";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getConfiguredUrl(...values: Array<string | undefined>) {
  const configuredValue = values.find((value) => typeof value === "string" && value.trim().length > 0);
  return configuredValue ? trimTrailingSlash(configuredValue) : undefined;
}

export function getBackendApiUrl() {
  const configuredUrl = getConfiguredUrl(
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL
  );

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_BACKEND_API_URL;
  }

  throw new Error("BACKEND_API_URL must be set in production.");
}

export function getFrontendAppUrl(fallbackOrigin?: string) {
  const configuredUrl = getConfiguredUrl(
    process.env.FRONTEND_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    fallbackOrigin
  );

  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_FRONTEND_APP_URL;
  }

  throw new Error("FRONTEND_APP_URL or NEXT_PUBLIC_APP_URL must be set in production.");
}
