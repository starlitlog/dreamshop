# AI Context: DreamShop

This document helps AI assistants quickly understand the project.

## What Is This?

DreamShop is an open-source, zero-cost e-commerce template. Stack:
- **Frontend**: Alpine.js + Tailwind CSS (single-page app)
- **API**: Cloudflare Workers
- **Database**: Airtable (visual, no SQL)
- **Payments**: Stripe Checkout
- **Images**: Cloudflare R2 (auto-synced from Airtable)

**Origin**: Built for a kid's 3D printing business (3DreamS.shop), now open-sourced as a template.

## Project Structure

```
dreamshop/
├── src/
│   ├── index.html              # Template with <!-- include:path --> markers
│   └── partials/
│       ├── head.html           # <head>: meta tags, Tailwind, styles
│       ├── header.html         # Navigation (desktop + mobile)
│       ├── pages.html          # All pages: shop, deals, events, about, cart
│       ├── modals.html         # Product modal, event modal, cache refresh modal
│       ├── footer.html         # Footer with social share links
│       └── scripts.html        # Alpine.js shop() function - ALL app logic
├── dist/                       # Built output (git-ignored)
├── _workers/
│   ├── worker.js               # Cloudflare Worker API
│   └── wrangler.toml           # Worker config
├── config.js                   # Shop config (API URL, shipping, shop name)
├── build.js                    # Combines partials into dist/index.html
└── Makefile                    # Dev commands
```

## Build System

Simple include system (no npm dependencies):
```html
<!-- include:partials/header.html -->
```

Build: `node build.js` → reads `src/index.html`, replaces includes, outputs to `dist/`

**Important**: The build script uses `() => content` as replacer to avoid `$` in JS strings being treated as regex patterns.

## Key Files to Understand

### 1. `src/partials/scripts.html` (~880 lines)
Contains the entire Alpine.js app in one `shop()` function:
- State management (products, cart, events, deals)
- API calls to Cloudflare Worker
- Cart logic with localStorage (`dreamshop_cart`)
- Stripe checkout integration
- Product/event modals
- Search and filtering

### 2. `_workers/worker.js`
Cloudflare Worker with:
- `SHOP_CONFIG` at top - URLs and CORS origins
- Product/event/deals fetch from Airtable
- Image sync from Airtable → R2
- Stripe checkout session creation
- Stripe webhook handling
- 24-hour caching via CF Cache API

### 3. `config.js`
Frontend config loaded before Alpine:
```js
const CONFIG = {
  API_BASE_URL: 'https://api.your-domain.com/v1',
  SHIPPING_FLAT_RATE: 10,
  FREE_SHIPPING_THRESHOLD: 25,
  SHOP_NAME: 'Your Shop Name',
  SHOP_EMAIL: 'hello@your-domain.com'
};
```

## Common Tasks

### Add a new page section
1. Add HTML in `src/partials/pages.html` with `x-show="page === 'newpage'"`
2. Add nav button in `src/partials/header.html`
3. Run `make build` to test

### Modify product display
Look in `src/partials/pages.html` for the product grid template (search for `x-for="product in paginatedProducts"`)

### Change checkout flow
In `src/partials/scripts.html`, find `proceedToCheckout()` function

### Add new API endpoint
In `_workers/worker.js`, add handler in the main fetch switch statement

### Modify what's stored in Airtable on order
In `_workers/worker.js`, find `handleCreateCheckout()` and modify the Airtable record creation

## Gotchas

1. **Alpine.js reactivity**: Use `this.property = value` not direct DOM manipulation
2. **Image URLs**: Products/events use R2 URLs after sync, format is either string or `{url: '...'}` object - check both
3. **Cache**: Worker caches for 24h. Force refresh with `?refresh=true&key=ADMIN_KEY`
4. **Stripe webhooks**: Must fetch full session from Stripe API - webhook payload doesn't include shipping details
5. **CORS**: Update `SHOP_CONFIG.ALLOWED_ORIGINS` in worker.js when adding domains
6. **Build script**: Must use function replacer `() => content` due to `$` characters in JS

## Current State (as of last session)

**Completed**:
- Full e-commerce flow working
- Stripe Checkout with shipping address collection
- Image sync Airtable → R2 (products and events)
- Deep linking (`#product/SKU`)
- Social sharing
- Split into partials for maintainability
- Generic template (all 3dreams branding removed)

**TODO markers**: Search for `TODO:` in partials - these mark places users need to customize

**Not implemented**:
- Inventory tracking
- Multiple shipping options
- User accounts
- Order history

## Testing Locally

```bash
make build    # Build src/ → dist/
make dev      # Build + serve at localhost:8000
```

Worker needs Cloudflare account with secrets set.

## Deployment

**Frontend (Cloudflare Pages)**:
- Build command: `node build.js`
- Output directory: `dist`

**API (Cloudflare Worker)**:
```bash
cd _workers
wrangler deploy
```

## Questions?

Check README.md for full setup instructions and Airtable schema.
