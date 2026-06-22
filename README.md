# Exchange Rates

A dark, Apple Stocks-inspired exchange-rate dashboard for comparing a home currency against global currencies.

## Features

- Full-bleed Three.js market scene behind the interface.
- Pick a home currency and amount.
- Switch between direct mode and reverse mode.
- Favorite currencies and keep them pinned near the top.
- Search by currency code or name.
- Open any currency card for a larger stat view with recent-rate stats and charting.
- Uses browser local storage for preferences.

## Data Sources

- Latest global rates: [ExchangeRate-API open endpoint](https://www.exchangerate-api.com/docs/free)
- Historical series: [Frankfurter API](https://frankfurter.dev/)

Both APIs are public and do not require an API key.

## Run Locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
