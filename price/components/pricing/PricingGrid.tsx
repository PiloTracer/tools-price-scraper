import type { PricingDataset, PricingProduct } from "@/lib/pricing/types";

type PricingGridProps = {
  dataset: PricingDataset;
  currencySlug: string;
};

const formatWithSymbol = (
  value: number,
  symbol: string,
  fallback?: Intl.NumberFormat,
) => {
  if (fallback) {
    try {
      return fallback.format(value);
    } catch {
      // Swallow and fall back to manual formatting.
    }
  }

  return `${symbol}${value.toFixed(2)}`;
};

const createCurrencyFormatter = (currencySlug: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencySlug.toUpperCase(),
      minimumFractionDigits: 2,
    });
  } catch {
    return undefined;
  }
};

const renderSpecList = (specs: PricingProduct["specs"]) =>
  specs.map((spec) => (
    <li key={spec} className="flex items-start gap-2 text-sm text-slate-100">
      <span
        aria-hidden
        className="mt-1 size-2.5 flex-none rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
      />
      <span>{spec}</span>
    </li>
  ));

export const PricingGrid = ({ dataset, currencySlug }: PricingGridProps) => {
  const formatter = createCurrencyFormatter(currencySlug);
  const adjustmentCopy =
    dataset.source.priceIncreasePercent !== 0
      ? `Includes ${dataset.source.priceIncreasePercent > 0 ? "+" : ""}${dataset.source.priceIncreasePercent}% adjustment`
      : "No price adjustment applied";
  const fetchedAt = dataset.fetchedAt.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 md:px-10 lg:px-16">
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="rounded-full bg-sky-500/10 px-4 py-1 text-sm font-semibold uppercase tracking-widest text-sky-300 ring-1 ring-sky-500/30">
          {dataset.source.label} Pricing
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight text-slate-50 sm:text-5xl">
          Cloud infrastructure tailored for demanding workloads
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          Real-time pricing scraped directly from{" "}
          <a
            className="font-semibold text-sky-300 hover:text-sky-200"
            href={dataset.resolvedUrl}
            target="_blank"
            rel="noreferrer"
          >
            Contabo
          </a>{" "}
          and enriched to fit your configuration needs. {adjustmentCopy}.
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Last refreshed at {fetchedAt}.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {dataset.products.map((product) => (
          <article
            key={product.id}
            className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-[0_40px_80px_-40px_rgba(56,189,248,0.45)] backdrop-blur-md transition-transform hover:-translate-y-1 hover:shadow-[0_40px_120px_-30px_rgba(14,165,233,0.55)]"
          >
            {product.badge && (
              <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.65)]" />
                {product.badge}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-semibold text-slate-50">
              {product.name}
            </h2>

            <div className="mt-6 flex items-end gap-3">
              <div className="text-5xl font-bold text-slate-50">
                {formatWithSymbol(
                  product.adjustedPrice,
                  product.currencySymbol,
                  formatter,
                )}
              </div>
              <span className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-300">
                {product.billingPeriod}
              </span>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              Base price:{" "}
              {formatWithSymbol(
                product.price,
                product.currencySymbol,
                formatter,
              )}
            </p>

            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {renderSpecList(product.specs)}
            </ul>

            <a
              href={product.ctaHref}
              target="_blank"
              rel="noreferrer"
              className="group mt-8 inline-flex items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-3 text-base font-semibold text-slate-900 transition hover:bg-sky-400"
            >
              {product.ctaLabel}
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-900/10 transition group-hover:bg-slate-900/25">
                &rarr;
              </span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
};

export default PricingGrid;
