# DreamShop: Running Costs & Scaling Guide

This document outlines the costs, limits, and scaling path for running DreamShop at different tiers—from completely free to high-volume operations.

---

## Quick Summary

| Tier | Monthly Cost | Products | MAU | CCU | Best For |
|------|-------------|----------|-----|-----|----------|
| **Free** | $0 | 1,000 | ~3,000 | ~100 | Side projects, testing |
| **Starter** | $5 | 1,000 | ~200K-500K | ~10K | Small shops |
| **Growth** | $25 | 50,000 | ~200K-500K | ~10K | Growing businesses |
| **Scale** | $50+ | Unlimited | 1M+ | 50K+ | High-volume stores |

---

## Tier 1: Running for Free ($0/month)

### What You Get

| Service | Free Tier Limit | Notes |
|---------|-----------------|-------|
| **Cloudflare Workers** | 100K requests/day | API backend |
| **Cloudflare Pages** | Unlimited bandwidth | Static hosting |
| **Cloudflare R2** | 10GB storage, 10M reads/mo | Image hosting |
| **Airtable** | 1,000 records, 1,000 API calls/mo | Product database |
| **Stripe** | No monthly fee | 2.9% + $0.30 per transaction |

### Capacity

| Metric | Limit | Explanation |
|--------|-------|-------------|
| **Products** | 1,000 | Airtable record limit |
| **Events** | Shared with products | Same 1,000 record pool |
| **Images** | ~2,000 | 10GB ÷ ~5MB average |
| **MAU** | ~3,000 | Limited by Worker requests (100K/day) |
| **CCU** | ~100 | Peak concurrent users |
| **Sales Volume** | Unlimited | Stripe has no caps |

### Why It Works

DreamShop's 24-hour caching strategy means Airtable's 1,000 API calls/month limit is **never the bottleneck**. The Worker cache serves nearly all requests, hitting Airtable only on cache refresh (~3-5 calls per refresh).

### Ideal For
- Kids' businesses, hobby projects
- Testing and development
- Low-traffic niche stores
- Seasonal pop-up shops

---

## Tier 2: Starter ($5/month)

### What Changes

| Service | Upgrade | New Limit |
|---------|---------|-----------|
| **Cloudflare Workers** | Paid plan | 10M requests/month included |

### Capacity

| Metric | Limit | vs Free |
|--------|-------|---------|
| **Products** | 1,000 | Same |
| **MAU** | ~200K-500K | **66-166x increase** |
| **CCU** | ~10K-15K | **100x increase** |
| **Daily Users** | ~15K-20K | **50x increase** |

### The Math

- 10M requests/month ÷ ~20 requests per session = **500,000 sessions/month**
- Assuming 1-2 sessions per user = **200K-500K MAU**
- Traffic spread across day = **~10K-15K CCU**

### Bottleneck

At this tier, **product catalog size (1,000)** becomes the constraint, not traffic. A store with 200K+ monthly visitors typically needs more than 1,000 products.

### Ideal For
- Small businesses with limited SKUs
- Service-based businesses (few products, high traffic)
- Stores with curated, limited inventory

---

## Tier 3: Growth ($25/month)

### What Changes

| Service | Upgrade | Cost | New Limit |
|---------|---------|------|-----------|
| **Cloudflare Workers** | Paid plan | $5/mo | 10M requests/month |
| **Airtable** | Team plan | $20/seat/mo | 50K records, 100K API calls/mo |

### Capacity

| Metric | Limit | vs Starter |
|--------|-------|------------|
| **Products** | 50,000 | **50x increase** |
| **Events** | Thousands | Separate from products |
| **MAU** | ~200K-500K | Same |
| **CCU** | ~10K-15K | Same |

### When to Upgrade

Upgrade from Starter when you need:
- More than 1,000 products
- Multiple staff managing inventory
- Sync integrations with other tools
- Better Airtable views and organization

### Ideal For
- Growing e-commerce businesses
- Stores with large catalogs
- Multi-category retailers

---

## Tier 4: Scale ($50+/month)

At this point, consider migrating from Airtable to a more scalable database.

### Migration Triggers

| Signal | Threshold | Action |
|--------|-----------|--------|
| Products | >50,000 | Migrate to SQL database |
| MAU | >500K | Consider edge caching |
| API complexity | JOINs, aggregations | Migrate to SQL |
| Real-time needs | Live inventory | Use Supabase Realtime |
| Cost efficiency | >$100/mo on Airtable | SQL is cheaper at scale |

### Recommended Alternatives

#### Option A: Cloudflare D1 + Workers ($5-20/month)

| Component | Cost | Capacity |
|-----------|------|----------|
| D1 Database | Free tier: 5GB | Unlimited rows |
| Workers | $5/mo | 10M requests |
| R2 | Free | 10GB images |
| **Total** | **$5-20/mo** | Massive scale |

**Pros**: Same Cloudflare ecosystem, edge-native, simple migration
**Cons**: D1 still maturing, limited to SQLite features

#### Option B: Supabase + Cloudflare ($25-50/month)

| Component | Cost | Capacity |
|-----------|------|----------|
| Supabase Pro | $25/mo | 8GB database, 100K MAU |
| Workers | $5/mo | API layer |
| R2 | Free | Images |
| **Total** | **$30-50/mo** | Enterprise-grade |

**Pros**: PostgreSQL power, realtime subscriptions, auth built-in, generous free tier
**Cons**: Another service to manage, latency if not using edge

#### Option C: PlanetScale/Turso + Workers ($30-60/month)

| Component | Cost | Capacity |
|-----------|------|----------|
| PlanetScale/Turso | $29/mo | Branching, scale-to-zero |
| Workers | $5/mo | API layer |
| R2 | Free | Images |
| **Total** | **$35-65/mo** | MySQL/SQLite at edge |

**Pros**: Database branching, edge replicas (Turso)
**Cons**: More complex setup

### Scale Tier Capacity

| Metric | D1 | Supabase Pro | PlanetScale |
|--------|-----|--------------|-------------|
| **Products** | Unlimited | Unlimited | Unlimited |
| **MAU** | 500K+ | 100K (250K with add-on) | 500K+ |
| **CCU** | 15K+ | 10K+ | 15K+ |
| **Storage** | 5GB free | 8GB | 10GB |

---

## Platform Comparison: DreamShop vs Alternatives

### At Free Tier ($0/month)

| Platform | Monthly Cost | Products | Transaction Fee | MAU Limit |
|----------|-------------|----------|-----------------|-----------|
| **DreamShop** | $0 | 1,000 | 2.9% + $0.30 (Stripe) | ~3,000 |
| Shopify | $39+ | Unlimited | 2.9% + $0.30 + 2% | Unlimited |
| BigCommerce | $39+ | Unlimited | 2.2-2.9% + $0.30 | $50K sales cap |
| Squarespace | $27+ | Unlimited | 2.9% + $0.30 + 2% | Unlimited |
| Wix | $29+ | Unlimited | 2.9% + $0.30 | Unlimited |
| WooCommerce | $10-30+ (hosting) | Unlimited | 2.9% + $0.30 | Depends on host |

**DreamShop advantage**: Only truly free option with no monthly fees.

### At $5/month (DreamShop Starter)

| Platform | Monthly Cost | Products | Transaction Fee | MAU |
|----------|-------------|----------|-----------------|-----|
| **DreamShop** | $5 | 1,000 | 2.9% + $0.30 | ~200K-500K |
| Shopify Starter | $5 | Unlimited | 5% | Unlimited |
| BigCommerce | $39 | Unlimited | 2.2-2.9% | $50K sales |
| Squarespace | $16 | Unlimited | 2.9% + 2% | Unlimited |
| Wix | $17 | Unlimited | 2.9% + $0.30 | Unlimited |

**DreamShop advantage**: 200K-500K MAU capacity; Shopify Starter charges 5% transaction fee.

### At $25/month (DreamShop Growth)

| Platform | Monthly Cost | Products | Transaction Fee | Extras |
|----------|-------------|----------|-----------------|--------|
| **DreamShop** | $25 | 50,000 | 2.9% + $0.30 | Full control |
| Shopify Basic | $39 | Unlimited | 2.9% + $0.30 | Apps extra |
| BigCommerce Plus | $79 | Unlimited | 2.2-2.9% | $180K sales cap |
| Squarespace Core | $23 | Unlimited | 2.9% + $0.30 | 0% txn fee |
| Wix Business | $36 | Unlimited | 2.9% + $0.30 | Good value |

**DreamShop advantage**: Lower cost, no platform lock-in, 50K products.

### At $50/month (DreamShop Scale)

| Platform | Monthly Cost | Products | Features |
|----------|-------------|----------|----------|
| **DreamShop + Supabase** | $50 | Unlimited | Full SQL, realtime |
| Shopify Grow | $105 | Unlimited | Better reports, 5 staff |
| BigCommerce Pro | $299 | Unlimited | $400K sales cap |
| Squarespace Plus | $39 | Unlimited | Subscriptions, advanced |

**DreamShop advantage**: Unlimited products, no sales caps, own your data.

### Annual Cost Comparison (assuming $50K/year in sales)

| Platform | Annual Platform Cost | Transaction Fees* | Total Annual Cost |
|----------|---------------------|-------------------|-------------------|
| **DreamShop (Growth)** | $300 | $1,450 | **$1,750** |
| Shopify Basic | $468 | $1,450 | $1,918 |
| BigCommerce Standard | $348 | $1,100-1,450 | $1,448-1,798 |
| Squarespace Core | $276 | $1,450 | $1,726 |
| Wix Business | $432 | $1,450 | $1,882 |

*Transaction fees estimated at 2.9% + $0.30 average on $50K sales

---

## Cost Scaling Visualization

```
Monthly Cost vs Scale

$300 |                                          ┌─ Shopify Advanced
     |                                    ┌────┘
$200 |                              ┌─────┘
     |                        ┌─────┘
$100 |                  ┌─────┘─────────────────── BigCommerce Pro
     |            ┌─────┘
 $50 |      ┌─────┴─────────────────────────────── DreamShop + Supabase
     |      │     ┌───────────────────────────── Shopify Basic
 $25 |──────┴─────┴───────────────────────────── DreamShop Growth
     |
  $5 |────────────────────────────────────────── DreamShop Starter
     |
  $0 |────────────────────────────────────────── DreamShop Free
     └────────────────────────────────────────────────────────────
       1K      10K     50K    100K   200K   500K    MAU →
```

---

## Upgrade Decision Tree

```
START: Using DreamShop Free
         │
         ▼
    Need more than 100K requests/day?
         │
    YES  │  NO → Stay on Free
         ▼
    Upgrade Workers to $5/mo (Starter)
         │
         ▼
    Need more than 1,000 products?
         │
    YES  │  NO → Stay on Starter
         ▼
    Upgrade Airtable to Team $20/mo (Growth)
         │
         ▼
    Need more than 50K products OR
    complex queries OR real-time features?
         │
    YES  │  NO → Stay on Growth
         ▼
    Migrate to SQL database (Scale)
         │
         ├─→ Cloudflare D1 (simple, cheap)
         ├─→ Supabase (feature-rich)
         └─→ PlanetScale/Turso (edge performance)
```

---

## Summary

DreamShop's architecture is optimized for **cost efficiency at every scale**:

1. **$0/month**: Perfect for small projects up to ~3K MAU
2. **$5/month**: Unlocks massive traffic (~500K MAU) with minimal spend
3. **$25/month**: Production-ready for growing businesses (50K products)
4. **$50+/month**: Enterprise-grade with SQL migration

The key insight: **DreamShop's caching strategy makes it dramatically cheaper than traditional platforms** at equivalent scale, while giving you full ownership of your code and data.

---

## Sources

- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Airtable Plans Overview](https://support.airtable.com/docs/airtable-plans)
- [Airtable API Limits](https://support.airtable.com/docs/managing-api-call-limits-in-airtable)
- [Stripe Pricing](https://stripe.com/pricing)
- [Shopify Pricing](https://www.shopify.com/pricing)
- [BigCommerce Pricing](https://www.bigcommerce.com/essentials/pricing/)
- [Squarespace Pricing](https://www.squarespace.com/pricing)
- [Wix Pricing](https://www.wix.com/plans)
