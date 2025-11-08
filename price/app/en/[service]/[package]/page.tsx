import { Buffer } from "buffer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getPricingSources } from "@/lib/pricing/config";
import { getPlanExtras, getServiceExtras } from "@/lib/pricing/extras";
import { getProviderInfo } from "@/lib/pricing/provider";
import type { PricingProduct } from "@/lib/pricing/types";
import { scrapePricing } from "@/lib/pricing/scraper";

type PlanPageParams = {
  service: string;
  package: string;
};

type PlanPageSearchParams = {
  currency?: string;
  payload?: string;
};

type PlanDetailPageProps = {
  params: Promise<PlanPageParams>;
  searchParams: Promise<PlanPageSearchParams>;
};

type ProductPayload = {
  id?: string;
  ctaPlan?: string;
  ctaService?: string;
  ctaLocale?: string;
  name?: string;
  badge?: string;
  specs?: string[];
  price?: number;
  adjustedPrice?: number;
  currencySymbol?: string;
  billingPeriod?: string;
  currencySlug?: string;
  priceIncreasePercent?: number;
  sourceLabel?: string;
};

const DEFAULT_CURRENCY = "usd";

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
};

const humanizeSlug = (slug: string) =>
  slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeSlug = (value?: string) => {
  if (!value) {
    return "";
  }

  return value.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
};

const collectSlugVariants = (value?: string) => {
  const normalized = normalizeSlug(value);
  if (!normalized) {
    return [];
  }

  const segments = normalized.split("/").filter(Boolean);
  const tail = segments[segments.length - 1];
  return tail && tail !== normalized ? [normalized, tail] : [normalized];
};

const decodePayload = (raw?: string): ProductPayload | null => {
  if (!raw) {
    return null;
  }

  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as ProductPayload;
  } catch {
    return null;
  }
};

const fallbackProductFromPayload = (payload: ProductPayload): PricingProduct => {
  const price = payload.price ?? payload.adjustedPrice ?? 0;
  const adjustedPrice = payload.adjustedPrice ?? payload.price ?? 0;
  const [preDecimal, decimal] = price
    .toFixed(2)
    .split(".") as [string, string | undefined];

  return {
    id: payload.id ?? payload.ctaPlan ?? "package",
    name: payload.name ?? humanizeSlug(payload.ctaPlan ?? "Package"),
    badge: payload.badge,
    price,
    adjustedPrice,
    currencySymbol: payload.currencySymbol ?? "$",
    billingPeriod: payload.billingPeriod ?? "/ month",
    specs: payload.specs ?? [],
    ctaLabel: "Get Package",
    ctaHref: "",
    ctaHrefRaw: undefined,
    ctaPath: `/${payload.ctaLocale ?? "en"}/${payload.ctaService ?? "vps"}/${
      payload.ctaPlan ?? "package"
    }/`,
    ctaLocale: payload.ctaLocale ?? "en",
    ctaService: payload.ctaService ?? "vps",
    ctaPlan: payload.ctaPlan ?? "package",
    rawPriceFragments: {
      preDecimal,
      decimal,
    },
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: PlanDetailPageProps): Promise<Metadata> {
  try {
    const { service, package: packageSlug } = await params;
    const { name: providerName } = getProviderInfo();
    const currency =
      (await searchParams)?.currency?.toUpperCase() ?? DEFAULT_CURRENCY.toUpperCase();

    return {
      title: `${humanizeSlug(packageSlug)} | ${humanizeSlug(service)} | ${providerName}`,
      description: `Purchase ${humanizeSlug(packageSlug)} from ${providerName} in ${currency}. Review resources, specs, and optional add-ons before checkout.`,
    };
  } catch {
    return {
      title: "Package Detail",
    };
  }
}

const buildBackLink = (service: string, currency: string) => {
  const sources = Array.from(getPricingSources().values());
  const matched = sources.find(
    (source) => source.key.toLowerCase() === service.toLowerCase(),
  );
  if (!matched) {
    return "/pricing";
  }

  return `/pricing/${matched.key}/${currency}`;
};

export default async function PlanDetailPage({
  params,
  searchParams,
}: PlanDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) ?? {};

  const serviceSlug = resolvedParams.service;
  const packageSlug = resolvedParams.package;
  const currencySlug =
    typeof resolvedSearch.currency === "string" && resolvedSearch.currency.length > 0
      ? resolvedSearch.currency
      : DEFAULT_CURRENCY;
  const payload = decodePayload(resolvedSearch.payload);

  let dataset;
  try {
    dataset = await scrapePricing(serviceSlug, currencySlug);
  } catch {
    notFound();
  }

  const slugTargets = new Set<string>();
  collectSlugVariants(packageSlug).forEach((slug) => slugTargets.add(slug));
  collectSlugVariants(`${serviceSlug}/${packageSlug}`).forEach((slug) =>
    slugTargets.add(slug),
  );
  if (payload) {
    collectSlugVariants(payload.ctaPlan).forEach((slug) => slugTargets.add(slug));
    collectSlugVariants(payload.id).forEach((slug) => slugTargets.add(slug));
    collectSlugVariants(
      payload.ctaService && payload.ctaPlan
        ? `${payload.ctaService}/${payload.ctaPlan}`
        : undefined,
    ).forEach((slug) => slugTargets.add(slug));
  }

  const productMatch = dataset.products.find((plan) => {
    const planSlugCandidates = [
      plan.ctaPlan,
      plan.id,
      plan.ctaPath,
      plan.ctaHrefRaw,
      `${plan.ctaService}/${plan.ctaPlan}`,
    ]
      .flatMap((candidate) => collectSlugVariants(candidate))
      .filter(Boolean);

    return planSlugCandidates.some((candidate) => slugTargets.has(candidate));
  });

  const product = productMatch ?? (payload ? fallbackProductFromPayload(payload) : null);

  if (!product) {
    notFound();
  }

  const provider = getProviderInfo();
  const serviceExtras = getServiceExtras(serviceSlug);
  const planExtras = getPlanExtras(serviceSlug, product.ctaPlan);

  const effectiveCurrency =
    payload?.currencySlug && payload.currencySlug.length > 0
      ? payload.currencySlug
      : currencySlug;

  const displayName = payload?.name ?? product.name;
  const displayBadge = payload?.badge ?? product.badge;
  const displaySpecs =
    payload?.specs && payload.specs.length > 0 ? payload.specs : product.specs;
  const displayAdjustedPrice =
    payload?.adjustedPrice ?? product.adjustedPrice ?? product.price;
  const displayBasePrice = payload?.price ?? product.price ?? product.adjustedPrice;
  const displayBillingPeriod = payload?.billingPeriod ?? product.billingPeriod;
  const priceAdjustmentPercent =
    payload?.priceIncreasePercent ?? dataset.source.priceIncreasePercent;
  const sourceLabel = payload?.sourceLabel ?? dataset.source.label;

  const adjustedPriceLabel = formatCurrency(displayAdjustedPrice, effectiveCurrency);
  const basePriceLabel = formatCurrency(displayBasePrice, effectiveCurrency);

  const backHref = buildBackLink(serviceSlug, effectiveCurrency);

  return (
    <main className="relative min-h-screen bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25)_0%,_rgba(10,12,28,0.95)_55%,_rgba(2,6,23,1)_100%)]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 lg:px-12">
        <nav className="flex items-center justify-between text-sm text-slate-300">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest transition hover:border-sky-500/40 hover:text-sky-200"
          >
            ← Back to plans
          </Link>
          <span className="hidden items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500 sm:flex">
            {provider.name}
          </span>
        </nav>

        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-[0_40px_120px_-45px_rgba(14,165,233,0.55)] backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-300">
                {serviceExtras?.serviceHeadline ?? humanizeSlug(sourceLabel)}
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-snug text-white sm:text-5xl">
                {humanizeSlug(displayName)}
              </h1>
              {displayBadge && (
                <span className="mt-3 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-sky-200">
                  {displayBadge}
                </span>
              )}
              {planExtras?.tagline && (
                <p className="mt-3 text-lg text-slate-300">{planExtras.tagline}</p>
              )}
              {planExtras?.summary && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                  {planExtras.summary}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/30 bg-slate-900/70 px-6 py-5 text-right">
              <span className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Monthly investment
              </span>
              <span className="text-4xl font-semibold text-white">
                {adjustedPriceLabel}
              </span>
              <span className="text-xs text-slate-400">
                Base price {basePriceLabel} · includes{" "}
                {priceAdjustmentPercent > 0
                  ? `+${priceAdjustmentPercent}%`
                  : `${priceAdjustmentPercent}%`}{" "}
                adjustment
              </span>
              {displayBillingPeriod && (
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Billing cycle {displayBillingPeriod.trim()}
                </span>
              )}
            </div>
          </div>

          {serviceExtras?.serviceHighlights && (
            <ul className="mt-6 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
              {serviceExtras.serviceHighlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-2xl border border-slate-800/50 bg-slate-900/60 px-4 py-3"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </header>

        <section className="grid gap-10 lg:grid-cols-[2fr,1fr]">
          <article className="rounded-3xl border border-white/10 bg-slate-900/60 p-8">
            <h2 className="text-2xl font-semibold text-white">Technical specs</h2>
            <p className="mt-2 text-sm text-slate-400">
              Directly parsed from {provider.name}&rsquo;s public catalog and refreshed
              on demand.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {displaySpecs.map((spec) => (
                <li
                  key={spec}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/70 px-5 py-4 text-sm text-slate-200"
                >
                  {spec}
                </li>
              ))}
            </ul>

            {planExtras?.highlights && planExtras.highlights.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white">
                  Concierge upgrades included
                </h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {planExtras.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                    >
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {planExtras?.faqs && planExtras.faqs.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-white">Common questions</h3>
                <dl className="mt-4 space-y-4">
                  {planExtras.faqs.map((faq) => (
                    <div
                      key={faq.question}
                      className="rounded-2xl border border-slate-800/50 bg-slate-900/60 px-4 py-4"
                    >
                      <dt className="text-sm font-semibold text-slate-200">
                        {faq.question}
                      </dt>
                      <dd className="mt-2 text-sm text-slate-400">{faq.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </article>

          <aside className="flex flex-col gap-6">
            {planExtras?.addons && planExtras.addons.length > 0 && (
              <div className="rounded-3xl border border-sky-500/30 bg-slate-900/60 p-6">
                <h3 className="text-lg font-semibold text-white">
                  Optional add-ons
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {planExtras.addons.map((addon) => (
                    <li
                      key={addon.name}
                      className="rounded-2xl border border-slate-800/60 bg-slate-900/70 px-4 py-3"
                    >
                      <div className="flex items-center justify-between text-slate-200">
                        <span className="font-semibold">{addon.name}</span>
                        {addon.price && (
                          <span className="text-xs uppercase tracking-widest text-sky-300">
                            {addon.price}
                          </span>
                        )}
                      </div>
                      {addon.description && (
                        <p className="mt-2 text-xs text-slate-400">
                          {addon.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form
              className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6"
              action="#"
              noValidate
            >
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Secure your package
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Submit your provisioning request and a specialist will follow up
                  within 15 minutes.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  First name
                  <input
                    type="text"
                    name="firstName"
                    placeholder="Taylor"
                    required
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Last name
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Morgan"
                    required
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Business email
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  required
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-300">
                Company (optional)
                <input
                  type="text"
                  name="company"
                  placeholder="EPIC Labs"
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Phone number
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+1 555 012 4567"
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Country/Region
                  <select
                    name="country"
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    defaultValue="US"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="DE">Germany</option>
                    <option value="UK">United Kingdom</option>
                    <option value="CR">Costa Rica</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Billing cycle
                  <select
                    name="billingCycle"
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    defaultValue="monthly"
                  >
                    <option value="monthly">Monthly · {adjustedPriceLabel}</option>
                    <option value="quarterly">
                      Quarterly ·{" "}
                      {formatCurrency(displayAdjustedPrice * 3, effectiveCurrency)}
                    </option>
                    <option value="annual">
                      Annual ·{" "}
                      {formatCurrency(displayAdjustedPrice * 12, effectiveCurrency)}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Preferred start date
                  <input
                    type="date"
                    name="startDate"
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  />
                </label>
              </div>

              <fieldset className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                <legend className="text-sm font-semibold text-white">
                  Payment method
                </legend>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    defaultChecked
                    className="size-4 accent-sky-400"
                  />
                  Credit or debit card
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="wire"
                    className="size-4 accent-sky-400"
                  />
                  Wire transfer
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="paypal"
                    className="size-4 accent-sky-400"
                  />
                  PayPal
                </label>
              </fieldset>

              <div className="grid gap-4">
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Card number
                  <input
                    type="text"
                    inputMode="numeric"
                    name="cardNumber"
                    placeholder="4242 4242 4242 4242"
                    className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Expiry
                    <input
                      type="text"
                      name="expiry"
                      placeholder="MM / YY"
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Security code
                    <input
                      type="text"
                      name="cvc"
                      placeholder="CVC"
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-start gap-3 text-xs text-slate-400">
                <input
                  type="checkbox"
                  name="terms"
                  className="mt-1 size-4 rounded border border-slate-600 bg-slate-900 text-sky-400 focus:ring-2 focus:ring-sky-400/40"
                />
                I authorize {provider.name} to contact me about provisioning, billing,
                and optional add-ons for this package.
              </label>

              <button
                type="button"
                className="mt-2 inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold uppercase tracking-widest text-slate-900 transition hover:bg-sky-400"
              >
                Submit order request
              </button>

              <p className="text-xs text-slate-500">
                This is a demo submission flow. No payment will be processed. A sales
                engineer from {provider.name} will confirm configuration details before
                activating your services.
              </p>
            </form>
          </aside>
        </section>
      </div>
    </main>
  );
}
