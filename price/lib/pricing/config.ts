import "server-only";

import { PricingSource } from "./types";

type SourceMap = Map<string, PricingSource>;

let cachedSources: SourceMap | null = null;

const SOURCE_LIST_ENV = "PRICING_SOURCES";

const readEnv = (name: string, required = true): string | undefined => {
  const value = process.env[name];
  if (required && (!value || value.trim().length === 0)) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value?.trim();
};

const normalizeKey = (key: string) => key.trim().toLowerCase();

const toEnvToken = (key: string) =>
  normalizeKey(key)
    .replace(/[^a-z0-9]/gi, "_")
    .toUpperCase();

const buildSource = (rawKey: string): PricingSource => {
  const key = normalizeKey(rawKey);
  const token = toEnvToken(rawKey);
  const prefix = `PRICING_${token}`;

  const urlTemplate = readEnv(`${prefix}_URL`)!;
  const selector = readEnv(`${prefix}_SELECTOR`)!;
  const percentRaw = readEnv(`${prefix}_PRICE_PERCENT`, false) ?? "0";
  const label =
    readEnv(`${prefix}_LABEL`, false) ?? key.toUpperCase().replace(/[_-]+/g, " ");

  const priceIncreasePercent = Number.parseFloat(percentRaw);

  if (Number.isNaN(priceIncreasePercent)) {
    throw new Error(
      `Invalid value for ${prefix}_PRICE_PERCENT. Expected a number, received "${percentRaw}".`,
    );
  }

  return {
    key,
    label: label.trim(),
    urlTemplate: urlTemplate.trim(),
    rootSelector: selector.trim(),
    priceIncreasePercent,
  };
};

const parseSources = (): SourceMap => {
  const list = readEnv(SOURCE_LIST_ENV);
  if (!list) {
    throw new Error(`Environment variable ${SOURCE_LIST_ENV} must be defined.`);
  }

  const map: SourceMap = new Map();
  const keys = list.split(",").map((item) => item.trim()).filter(Boolean);

  if (keys.length === 0) {
    throw new Error(
      `${SOURCE_LIST_ENV} does not contain any entries. Provide at least one pricing source key.`,
    );
  }

  for (const rawKey of keys) {
    const source = buildSource(rawKey);
    map.set(source.key, source);
  }

  return map;
};

export const getPricingSources = (): SourceMap => {
  if (!cachedSources) {
    cachedSources = parseSources();
  }

  return cachedSources;
};

export const getPricingSource = (key: string): PricingSource => {
  const sources = getPricingSources();
  const normalizedKey = normalizeKey(key);
  const source = sources.get(normalizedKey);

  if (!source) {
    throw new Error(
      `No pricing source configured for key "${key}". Check ${SOURCE_LIST_ENV}.`,
    );
  }

  return source;
};

