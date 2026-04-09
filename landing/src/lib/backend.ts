function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getBackendApiUrl() {
  return trimTrailingSlash(
    process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_API_URL ||
      "http://localhost:3001"
  );
}

export function getFrontendAppUrl(fallbackOrigin?: string) {
  return trimTrailingSlash(
    process.env.FRONTEND_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      fallbackOrigin ||
      "http://localhost:3002"
  );
}
