import { BRAND_ASSET_ENDPOINT_SECURITY, LOCAL_DEVELOPMENT } from "@/lib/constants";

export function isAllowedBrandAssetEndpoint(endpoint: string, runtimeEnvironment: string | undefined) {
  try {
    const parsed = new URL(endpoint);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
    const loopback = BRAND_ASSET_ENDPOINT_SECURITY.loopbackHostnames.some((hostname) => hostname === parsed.hostname)
      && BRAND_ASSET_ENDPOINT_SECURITY.allowedProtocols.some((protocol) => protocol === parsed.protocol);
    const localStackDocker = runtimeEnvironment === LOCAL_DEVELOPMENT.runtimeEnvironment
      && parsed.protocol === "http:"
      && parsed.hostname === LOCAL_DEVELOPMENT.objectStorageHostname
      && parsed.port === LOCAL_DEVELOPMENT.objectStoragePort
      && parsed.pathname === BRAND_ASSET_ENDPOINT_SECURITY.rootPath;
    return loopback || localStackDocker;
  } catch {
    return false;
  }
}
