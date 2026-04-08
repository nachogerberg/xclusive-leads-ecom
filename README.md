# Xclusive Leads Ecom Dashboard

Multi-source e-commerce dashboard aggregating **Meta Ads**, **Shopify**, and **Go High Level (GHL)** data.

## Integrations

| Service | Auth Method | Key Env Vars |
|---------|------------|-------------|
| Meta Ads | Long-lived access token | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| Shopify | Client credentials grant (auto-refreshing 24h token) | `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP_DOMAIN` |
| Go High Level | Bearer API key | `GHL_API_KEY`, `GHL_LOCATION_ID` |
| Supabase (cache) | Service role key | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.local.example` or set in Vercel dashboard:

```
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_SHOP_DOMAIN=
GHL_API_KEY=
GHL_LOCATION_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

## Deploy

Deploy on [Vercel](https://vercel.com). A daily cron job at 11:00 UTC refreshes the cache for all time ranges.
