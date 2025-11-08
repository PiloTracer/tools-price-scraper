import "server-only";

export type PricingSource = {
  key: string;
  label: string;
  urlTemplate: string;
  rootSelector: string;
  priceIncreasePercent: number;
};

export type PricingProduct = {
  id: string;
  name: string;
  badge?: string;
  price: number;
  adjustedPrice: number;
  currencySymbol: string;
  billingPeriod: string;
  specs: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaHrefRaw?: string;
  ctaPath: string;
  ctaLocale: string;
  ctaService: string;
  ctaPlan: string;
  rawPriceFragments: {
    preDecimal: string;
    decimal?: string;
  };
};

export type PricingDataset = {
  source: PricingSource;
  products: PricingProduct[];
  fetchedAt: Date;
  resolvedUrl: string;
};
