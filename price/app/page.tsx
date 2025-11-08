import Link from "next/link";

import { getPricingSources } from "@/lib/pricing/config";
import type { PricingSource } from "@/lib/pricing/types";

export default function Home() {
  let sources: PricingSource[] = [];
  let configError: string | null = null;

  try {
    sources = Array.from(getPricingSources().values());
  } catch (error) {
    configError =
      error instanceof Error
        ? error.message
        : "Pricing sources have not been configured.";
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-slate-200">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3)_0%,_rgba(10,12,28,0.92)_60%,_rgba(2,6,23,1)_100%)]"
      />
      <div className="relative flex max-w-4xl flex-col items-center text-center">
        <span className="rounded-full bg-sky-500/10 px-4 py-1 text-sm font-semibold uppercase tracking-widest text-sky-300 ring-1 ring-sky-500/30">
          AI EPIC Pricing Portal
        </span>
        <h1 className="mt-6 text-5xl font-bold leading-tight text-slate-50 sm:text-6xl">
          Compare plans in real time
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-300">
          Pick a pricing category below and swap the currency slug in the URL
          to instantly reload localized prices. For example,{" "}
          <code className="rounded bg-slate-900/50 px-2 py-1 text-sm text-sky-200">
            /pricing/vps/usd
          </code>{" "}
          or{" "}
          <code className="rounded bg-slate-900/50 px-2 py-1 text-sm text-sky-200">
            /pricing/vds/eur
          </code>
          .
        </p>
      </div>

      <div className="relative mt-14 grid w-full max-w-5xl gap-6 md:grid-cols-2">
        {configError ? (
          <div className="col-span-full rounded-3xl border border-amber-400/40 bg-amber-500/10 p-8 text-center text-amber-200">
            <h2 className="text-2xl font-semibold">Configuration needed</h2>
            <p className="mt-3 text-base text-amber-100/90">
              {configError}. Populate{" "}
              <code className="rounded bg-slate-900/60 px-2 py-1 text-sm text-sky-200">
                PRICING_SOURCES
              </code>{" "}
              and related variables in your <code>.env</code> file to unlock the
              pricing explorer.
            </p>
          </div>
        ) : (
          sources.map((source) => (
            <Link
              key={source.key}
              href={`/pricing/${source.key}/usd`}
              className="group flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-left shadow-[0_30px_70px_-40px_rgba(14,165,233,0.35)] transition hover:-translate-y-1.5 hover:border-sky-400/40 hover:shadow-[0_40px_120px_-30px_rgba(14,165,233,0.45)]"
            >
              <span className="text-sm font-semibold uppercase tracking-widest text-sky-300">
                {source.label}
              </span>
              <span className="text-3xl font-bold text-slate-50">
                Explore {source.label} plans
              </span>
              <p className="text-base text-slate-300">
                Scraped directly from source with server-side rendering and
                automatic price adjustments tuned to your business logic.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 group-hover:text-sky-200">
                View pricing &rarr;
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
