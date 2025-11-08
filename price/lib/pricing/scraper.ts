import "server-only";

import { randomUUID } from "crypto";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { getPricingSource } from "./config";
import { PricingDataset, PricingProduct, PricingSource } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

const sanitizeDigits = (value: string) => value.replace(/[^\d]/g, "");

const resolveUrlTemplate = (template: string, currency: string) => {
  if (template.includes("{currency}")) {
    return template.replaceAll("{currency}", currency);
  }

  return template;
};

const toAbsoluteUrl = (href: string | undefined, baseUrl: string) => {
  if (!href) {
    return baseUrl;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

const normalizePath = (path: string) => {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return "/";
  }

  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/{2,}/g, "/");
};

const parseCtaTarget = (
  rawHref: string | undefined,
  resolvedUrl: string,
  fallbackService: string,
  fallbackPlan: string,
) => {
  const defaultLocale = "en";
  let path = normalizePath(`${defaultLocale}/${fallbackService}/${fallbackPlan}`);

  if (rawHref) {
    try {
      const url = new URL(rawHref, resolvedUrl);
      path = normalizePath(url.pathname);
    } catch {
      path = normalizePath(rawHref);
    }
  }

  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  const segments = normalizedPath.split("/").filter(Boolean);

  const locale = segments[0] ?? defaultLocale;
  const service = segments[1] ?? fallbackService;
  const plan = (segments[2] ?? fallbackPlan).replace(/\/$/, "");

  return {
    locale,
    service,
    plan,
    path: normalizedPath,
  };
};

const parsePrice = ($product: cheerio.Cheerio<Element>) => {
  const currencySymbol = $product.find(".currency-symbol").first().text().trim();
  const preDecimal = sanitizeDigits(
    $product.find(".pre-decimal-col").first().text(),
  );
  const decimal = sanitizeDigits(
    $product.find(".decimal-col .decimal").first().text(),
  );

  const safePreDecimal = preDecimal.length > 0 ? preDecimal : "0";
  const decimalPart = decimal.length > 0 ? decimal : "00";

  const compound = Number.parseFloat(`${safePreDecimal}.${decimalPart}`);

  return {
    basePrice: compound,
    currencySymbol: currencySymbol || "$",
    fragments: {
      preDecimal: safePreDecimal,
      decimal: decimalPart,
    },
  };
};

const parseProductCard = (
  source: PricingSource,
  $: cheerio.CheerioAPI,
  element: Element,
  resolvedUrl: string,
): PricingProduct | null => {
  const $product = $(element);
  const id = $product.attr("data-product") ?? randomUUID();
  const name = $product.find(".product-name").first().text().trim();

  if (!name) {
    return null;
  }

  const badge = $product
    .find(".top-promotion .promotion-text")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const priceInfo = parsePrice($product);

  const billingPeriod = $product
    .find(".monthly")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim() || "/ month";

  const specs = $product
    .find(".specs-container .spec .title")
    .map((_, spec) => $(spec).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const cta = $product.find(".cta-container a").first();
  const ctaLabel = cta.text().replace(/\s+/g, " ").trim() || "Configure";
  const ctaHrefRaw = cta.attr("href")?.trim() ?? "";
  const ctaHref = toAbsoluteUrl(ctaHrefRaw, resolvedUrl);
  const ctaTarget = parseCtaTarget(ctaHrefRaw, resolvedUrl, source.key, id);

  const adjustedPrice =
    priceInfo.basePrice * (1 + source.priceIncreasePercent / 100);

  return {
    id,
    name,
    badge: badge || undefined,
    price: priceInfo.basePrice,
    adjustedPrice,
    currencySymbol: priceInfo.currencySymbol,
    billingPeriod,
    specs,
    ctaLabel,
    ctaHref,
    ctaHrefRaw: ctaHrefRaw || undefined,
    ctaPath: ctaTarget.path,
    ctaLocale: ctaTarget.locale,
    ctaService: ctaTarget.service,
    ctaPlan: ctaTarget.plan,
    rawPriceFragments: priceInfo.fragments,
  };
};

export const scrapePricing = async (
  key: string,
  currency: string,
): Promise<PricingDataset> => {
  const source = getPricingSource(key);
  const resolvedUrl = resolveUrlTemplate(source.urlTemplate, currency);

  const response = await fetch(resolvedUrl, {
    headers: {
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download pricing source "${key}". Received ${response.status} ${response.statusText}.`,
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const container = $(source.rootSelector).first();

  if (!container || container.length === 0) {
    throw new Error(
      `Unable to locate selector "${source.rootSelector}" for source "${key}".`,
    );
  }

  const products: PricingProduct[] = [];

  container
    .find(".product-container")
    .each((_, element) => {
      const product = parseProductCard(source, $, element, resolvedUrl);
      if (product) {
        products.push(product);
      }
    });

  if (products.length === 0) {
    throw new Error(
      `No products found for source "${key}". Review the selector and HTML structure.`,
    );
  }

  return {
    source,
    products,
    fetchedAt: new Date(),
    resolvedUrl,
  };
};
