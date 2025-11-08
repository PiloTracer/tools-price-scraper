# EPIC Pricing Experience – Demo

This repository hosts a white-labeled pricing experience powered by Next.js 16. It demonstrates how EPIC platforms can ingest live pricing from third-party providers (Contabo in this demo), enrich the raw data with marketing copy, and present a full purchase journey—including package detail pages with a realistic order form—without touching the upstream vendor UI.

The showcase focuses on:

- **Dynamic scraping:** Server-side rendering fetches provider pricing at request time using Cheerio, so site visitors always see fresh plan data.
- **Multi-source configuration:** Pricing sources, selectors, and price adjustments are entirely environment-driven, enabling quick swaps to new vendors or business rules.
- **White-label branding:** Provider names, URLs, and CTA behavior come from secrets, making it trivial to relaunch the experience under different brands.
- **Deep links:** Each package click opens an `/en/{service}/{package}` route that reuses the scraped payload, surfaces curated marketing extras, and renders a placeholder checkout form ready for real integrations.

---

## 1. Getting Started

### Prerequisites
- Node.js 22 (matching the Docker base image)
- npm 10+
- Docker Engine & Docker Compose (optional, for container workflows)

### Local install & dev server
```bash
cd price
npm install
npm run dev
# Visit http://localhost:3000 or the port exposed via docker-compose
```

### Containerized workflows
Two compose stacks mirror production and development setups:

- `docker-compose-price-dev.yaml` exposes hot reload and debug ports, mounting the code directory.
- `docker-compose-price-PRD.yaml` builds a lean production image using `Dockerfile.price.PRD`.

```bash
# Dev hot reload
docker compose -f docker-compose-price-dev.yaml up --build

# Production-like run
docker compose -f docker-compose-price-PRD.yaml up --build -d
```

Both compose files automatically load environment variables from `price/.env`.

---

## 2. Environment Configuration

Core behavior is configured through environment variables. Copy `price/.env.example` to `price/.env` and adjust values as needed.

```ini
PROVIDER_NAME=Your Cloud Brand
PROVIDER_URL=https://pricing.example.com
PROVIDER_BASE_URL=https://pricing.example.com

PRICING_SOURCES=vps,vds

PRICING_VPS_LABEL=Cloud VPS
PRICING_VPS_URL=https://contabo.com/en/vps/?currency={currency}
PRICING_VPS_SELECTOR=#flagship-vps-product-grid
PRICING_VPS_PRICE_PERCENT=0

PRICING_VDS_LABEL=Cloud VDS
PRICING_VDS_URL=https://contabo.com/en/vds/?currency={currency}
PRICING_VDS_SELECTOR=#vds-product-grid
PRICING_VDS_PRICE_PERCENT=50
```

Key notes:

- `PRICING_SOURCES` is a comma-separated list of logical service keys. For every entry `{KEY}` you must define `PRICING_{KEY}_URL`, `_SELECTOR`, and `_PRICE_PERCENT`. Optional `_LABEL` overrides default display names.
- `{currency}` tokens in URLs are dynamically replaced by the active currency slug (e.g., `/pricing/vps/usd`).
- Price adjustments apply percentage-based markups/discounts to scraped prices, enabling white-label margin control.
- Provider fields control the branding shown to users and the base domain used when generating CTA links.

---

## 3. Architecture Overview

| Path | Responsibility |
|------|----------------|
| `price/lib/pricing/config.ts` | Parses environment-driven source definitions, validates required variables, and caches results. |
| `price/lib/pricing/scraper.ts` | Downloads HTML, extracts product cards via Cheerio, normalizes CTA paths, and calculates adjusted pricing. |
| `price/lib/pricing/provider.ts` | Resolves provider branding (name/URL/base URL) from env vars. |
| `price/lib/pricing/extras.ts` | Supplies marketing copy and add-ons from `price/data/plan-extras.json`; replace this JSON or hook it to a REST call. |
| `price/app/page.tsx` | Landing page listing configured services. |
| `price/app/pricing/[service]/[currency]/page.tsx` | Service-level grid that scrapes pricing and links to package detail routes. |
| `price/app/en/[service]/[package]/page.tsx` | Package detail page; merges scraped payloads with enrichment data and renders the checkout form. |
| `price/components/pricing/PricingGrid.tsx` | Presentational grid component shared across services. |

### Customizing for other providers
1. **Update environment variables** to point at new provider URLs and selectors. If the DOM shape changes, adjust selectors inside `scraper.ts`.
2. **Adapt data enrichment** by editing `price/data/plan-extras.json` or replacing `getServiceExtras`/`getPlanExtras` with an API request in `price/lib/pricing/extras.ts`.
3. **Review parsing helpers** in `scraper.ts`—especially `parseProductCard`—if CTA structure, price formatting, or spec layout differ.
4. **Presentation tweaks** belong in the components within `price/components` or in the page routes under `price/app/...`.

Because the scraper emits normalized fields (`ctaService`, `ctaPlan`, etc.), any new provider simply needs to populate these values for routing and payload handoff to continue working.

---

## 4. Testing & Validation

```bash
cd price
npm run lint   # ESLint with Next.js config
npm run build  # Production build validation with type checks
```

Optional manual flows:

- Visit `/pricing/vps/usd` or `/pricing/vds/usd` to confirm scraping, price adjustments, and deep links.
- Click “Get Package” to inspect `/en/{service}/{package}?currency=...` and verify the plan payload propagates to specs, pricing, and billing cycle defaults.

When using Docker, run lint/build inside the dev container or rely on `docker compose -f docker-compose-price-PRD.yaml build` for CI-style verification.

---

## 5. Next Steps & Extensibility Ideas

- Replace `price/data/plan-extras.json` with a REST/GraphQL integration so marketing can update package copy without code changes.
- Use the encoded payload on package detail pages to seed a real checkout API call.
- Add automated snapshot tests for `PricingGrid` and package detail pages to detect selector regressions when provider HTML shifts.
- Expand `PRICING_SOURCES` with additional services (e.g., storage, bandwidth plans) to demonstrate multi-product catalog launches.

---

This demo is designed to be a starting point for production-grade pricing experiences. By isolating scraping, enrichment, and presentation concerns, teams can quickly extend the solution to new vendors, new verticals, and real commerce flows. 
