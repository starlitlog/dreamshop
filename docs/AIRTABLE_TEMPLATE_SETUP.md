# Creating a Shareable Airtable Template

This guide walks you through creating a public Airtable template that users can clone with one click.

---

## Steps to Create the Clone Link

1. **Create the template base** in Airtable with all tables/fields (Products, Orders, Events, Deals)

2. **Add sample data** (optional but recommended)
   - 2-3 example products with images
   - 1-2 example events
   - 1 example deal
   - Helps users understand the schema

3. **Create the share link**
   - Open the base
   - Click **Share** (top right)
   - Click **Create public link**
   - Toggle ON: **"Allow viewers to copy data out of this view"**
   - Copy the link

4. **Test it**
   - Open link in incognito
   - Click **"Copy base"** (next to base name)
   - Verify all tables/fields copy correctly

---

## Tips on Account & Publishing

| Consideration | Recommendation |
|---------------|----------------|
| **Which account?** | Create a dedicated account (e.g., `dreamshop-templates@...`) - not your personal one |
| **Why dedicated?** | Avoids exposing personal bases, cleaner for open source project |
| **Free vs Paid?** | Free tier works fine for a template base (it's just structure + sample data) |
| **Workspace name** | Something clear: "DreamShop Templates" |
| **Base name** | `DreamShop Template v1.0` (version it!) |

### Account Options

**Option A: GitHub-associated email**
- `dreamshop-oss@your-domain.com` or similar
- Ties to the project identity

**Option B: Use Airtable Universe** (if you want discoverability)
- Airtable has a [template marketplace](https://airtable.com/universe)
- More visibility, but requires approval process
- Probably overkill for now

**Option C: Just use your existing account**
- Simpler, but your other bases visible in workspace list
- Fine for MVP, can migrate later

---

## Recommended Setup

1. Create `dreamshop.templates@gmail.com` (or similar)
2. Create Airtable account with that email
3. Create workspace: "DreamShop Open Source"
4. Create base: "DreamShop Template v1.0"
5. Build schema + add sample data
6. Share link with copy enabled
7. Add link to README

---

## Schema Reference

### Products Table (required)

| Field | Type | Options/Notes |
|-------|------|---------------|
| Name | Single line text | Primary field |
| SKU | Single line text | Used for image sync |
| Description | Long text | Enable rich text formatting |
| Price | Number | Decimal, format as currency |
| Images | Attachment | Synced to R2 |
| Colors | Multiple select | e.g., Red, Blue, Green, Black, White |
| Sizes | Multiple select | e.g., S, M, L, XL, One Size |
| Tags | Multiple select | e.g., New, Featured, Sale, Handmade |
| Active | Checkbox | Default: checked |
| Pinned | Checkbox | Shows at top of shop |
| Made By Me | Checkbox | For handmade indicator |

### Orders Table (required)

| Field | Type | Options/Notes |
|-------|------|---------------|
| Order ID | Single line text | Primary field, auto-generated |
| Customer Name | Single line text | |
| Email | Email | |
| Address | Long text | Shipping address from Stripe |
| Items | Long text | JSON or formatted list |
| Total | Number | Decimal, format as currency |
| Status | Single select | `Pending Payment`, `Paid`, `Shipped`, `Delivered`, `Cancelled` |
| Notes | Long text | Internal notes |
| Created | Created time | Auto-populated |

### Events Table (optional)

| Field | Type | Options/Notes |
|-------|------|---------------|
| Name | Single line text | Primary field |
| Date | Date | Include time if needed |
| Location | Single line text | Venue name |
| City | Single line text | |
| State | Single line text | |
| Description | Long text | Enable rich text |
| Image | Attachment | Synced to R2 |
| Status | Single select | `Upcoming`, `Live`, `Completed`, `Cancelled` |
| Featured | Checkbox | Shows prominently |

### Deals Table (optional)

| Field | Type | Options/Notes |
|-------|------|---------------|
| Name | Single line text | Primary field |
| Description | Long text | What the deal offers |
| Min Amount | Number | Minimum cart value to trigger |
| Discount Value | Number | Amount or percentage |
| Discount Type | Single select | `Percentage`, `Fixed` |
| Active | Checkbox | Whether deal is currently active |

### _Meta Table (for versioning)

| Field | Type | Options/Notes |
|-------|------|---------------|
| Key | Single line text | Primary field |
| Value | Single line text | |

**Initial data:**
| Key | Value |
|-----|-------|
| schema_version | 1.0 |

---

## Sample Data Suggestions

### Products (2-3 examples)

```
Product 1:
- Name: "Sample Widget"
- SKU: "WIDGET-001"
- Description: "This is a sample product to show how the shop works."
- Price: 19.99
- Colors: Blue, Red
- Sizes: S, M, L
- Tags: New, Featured
- Active: ✓
- Pinned: ✓

Product 2:
- Name: "Demo Gadget"
- SKU: "GADGET-001"
- Description: "Another example product with different options."
- Price: 29.99
- Colors: Black, White
- Sizes: One Size
- Tags: Handmade
- Active: ✓
- Made By Me: ✓
```

### Events (1-2 examples)

```
Event 1:
- Name: "Sample Market Day"
- Date: (set to a future date)
- Location: "Community Center"
- City: "Your City"
- State: "Your State"
- Description: "Example event to show the events feature."
- Status: Upcoming
- Featured: ✓
```

### Deals (1 example)

```
Deal 1:
- Name: "Free Shipping Over $25"
- Description: "Get free shipping on orders over $25"
- Min Amount: 25
- Discount Value: 10
- Discount Type: Fixed
- Active: ✓
```

---

## After Creating the Template

1. Copy the share link
2. Update `README.md` - replace the placeholder link:
   ```markdown
   2. Copy our template base: **[Airtable Template](https://airtable.com/YOUR_LINK_HERE)**
   ```
3. Test the clone flow in an incognito window
4. Verify the worker can read from a cloned base

---

## Versioning Strategy

When you update the schema:

1. Update the template base
2. Increment version in `_Meta` table
3. Update `init/scripts/` migration scripts
4. Document changes in a `CHANGELOG.md`

This allows:
- New users to clone latest template
- Existing users to run migration scripts to upgrade
