export function parseApiRoute(url: string, host = "localhost") {
  const parsed = new URL(url, `https://${host}`);
  const parts = parsed.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  return { parts, route: parts.join("/") };
}

export function isTrashHandlerRoute(route: string) {
  return route === "patients/trash" || route === "patients/trash/clear";
}

export function requiresAdminRoute(route: string, parts: string[], method?: string) {
  return (isTrashHandlerRoute(route) && method === "POST")
    || (parts[0] === "patients" && parts[2] === "permanent");
}
