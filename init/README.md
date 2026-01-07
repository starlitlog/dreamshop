# DreamShop Initialization Scripts

This folder contains scripts for setting up and maintaining your DreamShop Airtable database.

## Quick Start

### Option 1: Clone Template (Easiest)

Copy our pre-built template with one click:

**[Clone DreamShop Template](https://airtable.com/...)** *(link coming soon)*

### Option 2: Run Setup Script

Create the base programmatically:

```bash
# Get a Personal Access Token from https://airtable.com/create/tokens
# Required scopes: schema.bases:write, data.records:write

node init/scripts/setup-airtable.js --token YOUR_PAT
```

This creates a new base with:
- Products, Orders, Events, Deals tables
- Correct field types and options
- Sample data to get started
- `_Meta` table for version tracking

## Scripts

### `scripts/setup-airtable.js`

Creates a new Airtable base with the complete DreamShop schema.

```bash
# Basic usage
node init/scripts/setup-airtable.js --token patXXXXXX

# With custom base name
node init/scripts/setup-airtable.js --token patXXXXXX --name "My Shop"

# In specific workspace
node init/scripts/setup-airtable.js --token patXXXXXX --workspace wspXXXXXX
```

**Required token scopes:**
- `schema.bases:write` - To create base and tables
- `data.records:write` - To add sample data

### `scripts/migrate-airtable.js`

Upgrades an existing base to the latest schema version.

```bash
# Check what migrations would run
node init/scripts/migrate-airtable.js --token patXXX --base-id appXXX --dry-run

# Apply migrations
node init/scripts/migrate-airtable.js --token patXXX --base-id appXXX
```

**Required token scopes:**
- `schema.bases:read` - To read current schema
- `schema.bases:write` - To modify schema
- `data.records:read` - To read current version
- `data.records:write` - To update version

## Getting a Personal Access Token

1. Go to [Airtable Token Creation](https://airtable.com/create/tokens)
2. Click "Create new token"
3. Name it (e.g., "DreamShop Setup")
4. Add scopes:
   - `schema.bases:write`
   - `data.records:write`
   - (for migrations, also add `schema.bases:read` and `data.records:read`)
5. Add access to "All current and future bases in all current and future workspaces" (or specific workspace)
6. Create and copy the token

## Schema Versioning

The `_Meta` table tracks schema version:

| Key | Value |
|-----|-------|
| schema_version | 1.0 |

When schema updates are released:
1. Update your codebase
2. Run the migration script
3. Script applies only the needed migrations

## After Setup

1. Copy the Base ID from the script output
2. Add it to your worker secrets:
   ```bash
   cd _workers
   wrangler secret put AIRTABLE_BASE_ID
   ```
3. View your base at `https://airtable.com/YOUR_BASE_ID`
4. Delete sample data and add your own products!

## Troubleshooting

### "Airtable API error: 401"
Your token is invalid or expired. Create a new one.

### "Airtable API error: 403"
Token doesn't have required scopes. Check the scopes listed above.

### "Airtable API error: 422"
Usually means a field type issue. Check the error details.

### Migration says "No migrations needed"
Your base might have been created manually without the `_Meta` table. Add it:
1. Create a table called `_Meta`
2. Add fields: `Key` (text), `Value` (text)
3. Add row: Key=`schema_version`, Value=`1.0`
