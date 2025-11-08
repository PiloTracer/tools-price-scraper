import "server-only";

type ProviderInfo = {
  name: string;
  url: string;
  baseUrl: string;
};

const DEFAULT_PROVIDER: ProviderInfo = {
  name: "Contabo",
  url: "https://contabo.com",
  baseUrl: "https://contabo.com",
};

let cachedProvider: ProviderInfo | null = null;

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_PROVIDER.baseUrl;
  }

  return trimmed.endsWith("/")
    ? trimmed.slice(0, Math.max(trimmed.length - 1, 1))
    : trimmed;
};

export const getProviderInfo = (): ProviderInfo => {
  if (cachedProvider) {
    return cachedProvider;
  }

  const name = process.env.PROVIDER_NAME?.trim();
  const url = process.env.PROVIDER_URL?.trim();
  const base = process.env.PROVIDER_BASE_URL?.trim();

  cachedProvider = {
    name: name && name.length > 0 ? name : DEFAULT_PROVIDER.name,
    url: url && url.length > 0 ? url : DEFAULT_PROVIDER.url,
    baseUrl: base && base.length > 0 ? normalizeBaseUrl(base) : DEFAULT_PROVIDER.baseUrl,
  };

  return cachedProvider;
};

