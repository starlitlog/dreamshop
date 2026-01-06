# DreamShop

A zero-cost, edge-first e-commerce template built with Cloudflare Workers, Airtable, and Stripe.

**Origin story:** Built for a 10-year-old's 3D printing business. Now open source for anyone who needs a simple shop without the complexity of WordPress or the fees of Shopify.

## Features

- **Zero hosting costs** - Runs on Cloudflare's free tier
- **No server to manage** - Edge-native with Workers
- **Visual database** - Airtable as CMS (no SQL needed)
- **Image CDN included** - R2 storage with auto-sync from Airtable
- **Stripe payments** - Secure checkout with webhook support
- **24-hour caching** - Fast loads, minimal API calls
- **Mobile-first design** - Responsive out of the box
- **Deep linking** - Shareable product URLs (`#product/SKU`)
- **Social sharing** - Built-in share buttons

## Stack

| Layer | Technology | Cost |
|-------|------------|------|
| Frontend | Alpine.js + Tailwind CSS | Free |
| API | Cloudflare Workers | Free (100k req/day) |
| Database | Airtable | Free (1k records) |
| Images | Cloudflare R2 | Free (10GB) |
| Payments | Stripe | 2.9% + $0.30/txn |

**Total monthly cost: $0** (until you outgrow free tiers)

## Quick Start

### 1. Clone this repo

```bash
git clone https://github.com/starlitlog/dreamshop.git
cd dreamshop
```

### 2. Set up Airtable

1. Create an [Airtable account](https://airtable.com)
2. Copy our template base: **[Airtable Template](https://airtable.com/...)** *(coming soon)*
3. Get your API key from [Airtable Settings](https://airtable.com/create/tokens)
4. Note your Base ID from the URL: `airtable.com/BASE_ID/...`

### 3. Set up Cloudflare

1. Create a [Cloudflare account](https://cloudflare.com)
2. Install Wrangler CLI: `npm install -g wrangler`
3. Login: `wrangler login`
4. Create R2 bucket: `wrangler r2 bucket create your-shop-name`
5. Make R2 bucket public with custom domain (for images)

### 4. Configure Worker

Edit `_workers/wrangler.toml`:

```toml
name = "your-shop-api"
main = "worker.js"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-shop-name"

[[routes]]
pattern = "api.your-domain.com"
zone_name = "your-domain.com"
custom_domain = true
```

### 5. Set secrets

```bash
cd _workers
wrangler secret put AIRTABLE_API_KEY
wrangler secret put AIRTABLE_BASE_ID
wrangler secret put AIRTABLE_API_KEY_WEB_RESOURCE  # Can be same as above
wrangler secret put AIRTABLE_BASE_ID_WEB_RESOURCE  # Can be same as above
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put ADMIN_REFRESH_KEY              # Any random string
```

### 6. Deploy

```bash
cd _workers
wrangler deploy
```

### 7. Deploy frontend

The frontend is static HTML. Deploy to:
- **Cloudflare Pages** (recommended)
- GitHub Pages
- Netlify
- Any static host

### 8. Set up Stripe webhooks

1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api.your-domain.com/v1/stripe-webhook`
3. Select event: `checkout.session.completed`
4. Copy signing secret to Worker secrets

## Configuration

Edit `config.js`:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://api.your-domain.com/v1',
  SHIPPING_FLAT_RATE: 10,
  FREE_SHIPPING_THRESHOLD: 25,
  SHOP_NAME: 'Your Shop Name',
  SHOP_EMAIL: 'hello@your-domain.com'
};
```

## Airtable Schema

### Products

| Field | Type | Required |
|-------|------|----------|
| Name | Text | Yes |
| SKU | Text | Yes (for image sync) |
| Description | Long text | No |
| Price | Number | Yes |
| Images | Attachment | No (synced to R2) |
| Colors | Multiple select | No |
| Sizes | Multiple select | No |
| Tags | Multiple select | No |
| Active | Checkbox | Yes |
| Pinned | Checkbox | No |
| Made By Me | Checkbox | No |

### Orders

| Field | Type |
|-------|------|
| Customer Name | Text |
| Email | Email |
| Address | Long text |
| Items | Long text |
| Total | Number |
| Status | Single select: `Pending Payment`, `Paid`, `Shipped` |
| Notes | Long text |

### Events (optional)

| Field | Type |
|-------|------|
| Name | Text |
| Date | Date |
| Location | Text |
| City | Text |
| State | Text |
| Description | Long text |
| Image | Attachment (synced to R2) |
| Status | Single select |
| Featured | Checkbox |

### Deals (optional)

| Field | Type |
|-------|------|
| Name | Text |
| Description | Long text |
| Min Amount | Number |
| Discount Value | Number |
| Discount Type | Single select: `Percentage`, `Fixed` |
| Active | Checkbox |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/products` | GET | List products (cached 24h) |
| `/v1/products?refresh=true&key=X` | GET | Force cache refresh |
| `/v1/events` | GET | List events (cached 24h) |
| `/v1/deals` | GET | List deals (cached 24h) |
| `/v1/create-checkout` | POST | Create Stripe session |
| `/v1/stripe-webhook` | POST | Handle Stripe events |
| `/v1/submit-order` | POST | Legacy order submission |
| `/v1/submit-contact` | POST | Contact form |

## Customization

### Branding

1. Replace `icon.png` with your logo
2. Search `index.html` for `purple` and `pink` to change colors
3. Update meta tags for SEO
4. Edit the footer text

### Sections

The template includes:
- **Shop** - Product grid with filters
- **Events** - Upcoming events calendar
- **Deals** - Automatic discounts
- **About** - Your story
- **Cart** - Checkout flow

Hide sections by removing nav links and corresponding HTML.

## How It Works

### Caching

Products, events, and deals are cached for 24 hours to minimize Airtable API calls. Trigger a refresh with:

```
GET /v1/products?refresh=true&key=YOUR_ADMIN_KEY
```

### Image Sync

When cache refreshes, images are automatically:
1. Downloaded from Airtable attachments
2. Uploaded to R2 (if not already there)
3. Served from your R2 custom domain

This prevents Airtable's expiring URLs from breaking images.

### Checkout Flow

1. Customer adds items to cart (localStorage)
2. Clicks checkout → POST to `/v1/create-checkout`
3. Order created in Airtable as "Pending Payment"
4. Redirect to Stripe Checkout
5. Customer pays
6. Stripe webhook → Order updated to "Paid"
7. Shipping address captured from Stripe

## Limitations

- **Airtable free tier**: 1,000 records max
- **Best for**: Small shops with < 100 products
- **Not for**: High-volume stores

When you outgrow this, consider Shopify or a custom solution.

## Live Example

**[3DreamS.shop](https://3dreams.shop)** - The original shop this was built for.

## Support

This is a free, open-source project. For help:
- Open a [GitHub Issue](https://github.com/starlitlog/dreamshop/issues)
- Check existing issues first

For commercial support or custom development, contact via GitHub.

## License

MIT - Use it however you want. Attribution appreciated but not required.

---

*Built with curiosity. If this helped you, star the repo!*
