import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PricingGrid from "@/components/pricing/PricingGrid";
import { getPricingSource, getPricingSources } from "@/lib/pricing/config";
import { scrapePricing } from "@/lib/pricing/scraper";

type PricingPageParams = {
  service: string;
  currency: string;
};

type PricingPageProps = {
  params: Promise<PricingPageParams>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PricingPageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const source = getPricingSource(resolvedParams.service);
    const currency = resolvedParams.currency.toUpperCase();

    return {
      title: `${source.label} Pricing (${currency})`,
      description: `Live ${source.label} plans scraped from source for ${currency} currency.`,
    };
  } catch {
    return {
      title: "Pricing",
    };
  }
}

const ErrorSection = ({
  message,
  docsHref,
}: {
  message: string;
  docsHref: string;
}) => (
  <section className="mx-auto flex min-h-[40vh] max-w-3xl flex-col items-center justify-center gap-6 rounded-3xl border border-red-500/30 bg-red-950/30 px-6 py-10 text-center text-red-100">
    <h1 className="text-3xl font-semibold">We hit a snag</h1>
    <p className="text-base leading-relaxed text-red-100/80">{message}</p>
    <Link
      href={docsHref}
      className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-5 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/35"
    >
      Review configuration guide →
    </Link>
  </section>
);

export default async function PricingPage({ params }: PricingPageProps) {
  const { service, currency } = await params;

  let dataset;

  try {
    dataset = await scrapePricing(service, currency);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No pricing source")) {
      notFound();
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while loading pricing data.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <ErrorSection message={message} docsHref="/" />
      </main>
    );
  }

  const sources = Array.from(getPricingSources().values());
  const otherSources = sources.filter(
    (source) => source.key !== dataset.source.key,
  );

  return (
    <main className="min-h-screen w-full overflow-hidden bg-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25)_0%,_rgba(10,12,28,0.95)_55%,_rgba(2,6,23,1)_100%)]"
      />
      <div className="relative">
        <header className="flex flex-col items-center gap-3 px-6 py-6 text-center text-slate-200 sm:flex-row sm:justify-between sm:text-left">
          <Link
            href="/"
            className="text-base font-semibold uppercase tracking-widest text-slate-200 hover:text-white"
          >
            EPIC Cloud Pricing
          </Link>
          {otherSources.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>View other options:</span>
              <nav className="flex gap-2">
                {sources.map((source) => (
                  <Link
                    key={source.key}
                    href={`/pricing/${source.key}/${currency}`}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      source.key === dataset.source.key
                        ? "bg-sky-500/20 text-sky-200"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                    }`}
                  >
                    {source.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </header>

        <PricingGrid dataset={dataset} currencySlug={currency} />
      </div>
    </main>
  );
}
