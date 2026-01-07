#!/usr/bin/env node

/**
 * DreamShop Airtable Setup Script
 *
 * Creates a new Airtable base with the DreamShop schema.
 *
 * Usage:
 *   node setup-airtable.js --token YOUR_PERSONAL_ACCESS_TOKEN
 *
 * Or set environment variable:
 *   AIRTABLE_PAT=xxx node setup-airtable.js
 *
 * Required token scopes:
 *   - schema.bases:write
 *   - data.records:write
 */

const SCHEMA_VERSION = '1.0';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    token: process.env.AIRTABLE_PAT || null,
    workspaceId: process.env.AIRTABLE_WORKSPACE_ID || null,
    baseName: 'DreamShop',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--token':
      case '-t':
        options.token = args[++i];
        break;
      case '--workspace':
      case '-w':
        options.workspaceId = args[++i];
        break;
      case '--name':
      case '-n':
        options.baseName = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
DreamShop Airtable Setup Script

Creates a new Airtable base with the complete DreamShop schema.

USAGE:
  node setup-airtable.js --token YOUR_PAT [options]

OPTIONS:
  -t, --token <token>       Airtable Personal Access Token (required)
                            Can also use AIRTABLE_PAT env variable
  -w, --workspace <id>      Workspace ID to create base in (optional)
                            If not provided, creates in default workspace
  -n, --name <name>         Base name (default: "DreamShop")
  -h, --help                Show this help message

REQUIRED TOKEN SCOPES:
  - schema.bases:write      To create the base and tables
  - data.records:write      To add sample data and meta info

GET YOUR TOKEN:
  1. Go to https://airtable.com/create/tokens
  2. Create a new token with the scopes above
  3. Copy the token (starts with 'pat')

EXAMPLE:
  node setup-airtable.js --token patXXXXXXXXXXXXXX
  node setup-airtable.js --token patXXX --name "My Shop"

OUTPUT:
  On success, prints the Base ID to use in your worker configuration.
`);
}

// Airtable API helper
async function airtableRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.airtable.com/v0${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Airtable API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

// Schema definitions
const TABLES = [
  {
    name: 'Products',
    description: 'Store products with pricing, images, and variants',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'SKU', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Price', type: 'number', options: { precision: 2 } },
      { name: 'Images', type: 'multipleAttachments' },
      {
        name: 'Colors',
        type: 'multipleSelects',
        options: {
          choices: [
            { name: 'Red', color: 'redLight2' },
            { name: 'Blue', color: 'blueLight2' },
            { name: 'Green', color: 'greenLight2' },
            { name: 'Black', color: 'grayLight2' },
            { name: 'White', color: 'grayLight1' },
            { name: 'Yellow', color: 'yellowLight2' },
            { name: 'Purple', color: 'purpleLight2' },
            { name: 'Pink', color: 'pinkLight2' },
            { name: 'Orange', color: 'orangeLight2' }
          ]
        }
      },
      {
        name: 'Sizes',
        type: 'multipleSelects',
        options: {
          choices: [
            { name: 'XS', color: 'blueLight2' },
            { name: 'S', color: 'cyanLight2' },
            { name: 'M', color: 'tealLight2' },
            { name: 'L', color: 'greenLight2' },
            { name: 'XL', color: 'yellowLight2' },
            { name: 'XXL', color: 'orangeLight2' },
            { name: 'One Size', color: 'grayLight2' }
          ]
        }
      },
      {
        name: 'Tags',
        type: 'multipleSelects',
        options: {
          choices: [
            { name: 'New', color: 'greenLight2' },
            { name: 'Featured', color: 'blueLight2' },
            { name: 'Sale', color: 'redLight2' },
            { name: 'Handmade', color: 'purpleLight2' },
            { name: 'Limited', color: 'orangeLight2' },
            { name: 'Bestseller', color: 'yellowLight2' }
          ]
        }
      },
      { name: 'Active', type: 'checkbox' },
      { name: 'Pinned', type: 'checkbox' },
      { name: 'Made By Me', type: 'checkbox' }
    ]
  },
  {
    name: 'Orders',
    description: 'Customer orders and order status tracking',
    fields: [
      { name: 'Order ID', type: 'singleLineText' },
      { name: 'Customer Name', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'Address', type: 'multilineText' },
      { name: 'Items', type: 'multilineText' },
      { name: 'Total', type: 'number', options: { precision: 2 } },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Pending Payment', color: 'yellowLight2' },
            { name: 'Paid', color: 'greenLight2' },
            { name: 'Shipped', color: 'blueLight2' },
            { name: 'Delivered', color: 'purpleLight2' },
            { name: 'Cancelled', color: 'redLight2' }
          ]
        }
      },
      { name: 'Notes', type: 'multilineText' },
      { name: 'Stripe Session ID', type: 'singleLineText' },
      { name: 'Created', type: 'dateTime', options: { timeZone: 'utc', dateFormat: { name: 'iso' } } }
    ]
  },
  {
    name: 'Events',
    description: 'Markets, fairs, and other events',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Date', type: 'dateTime', options: { timeZone: 'client', dateFormat: { name: 'local' }, timeFormat: { name: '12hour' } } },
      { name: 'Location', type: 'singleLineText' },
      { name: 'City', type: 'singleLineText' },
      { name: 'State', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Image', type: 'multipleAttachments' },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Upcoming', color: 'blueLight2' },
            { name: 'Live', color: 'greenLight2' },
            { name: 'Completed', color: 'grayLight2' },
            { name: 'Cancelled', color: 'redLight2' }
          ]
        }
      },
      { name: 'Featured', type: 'checkbox' }
    ]
  },
  {
    name: 'Deals',
    description: 'Discounts and promotional offers',
    fields: [
      { name: 'Name', type: 'singleLineText' },
      { name: 'Description', type: 'multilineText' },
      { name: 'Min Amount', type: 'number', options: { precision: 2 } },
      { name: 'Discount Value', type: 'number', options: { precision: 2 } },
      {
        name: 'Discount Type',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Percentage', color: 'blueLight2' },
            { name: 'Fixed', color: 'greenLight2' }
          ]
        }
      },
      { name: 'Active', type: 'checkbox' }
    ]
  },
  {
    name: '_Meta',
    description: 'Schema versioning and configuration',
    fields: [
      { name: 'Key', type: 'singleLineText' },
      { name: 'Value', type: 'singleLineText' }
    ]
  }
];

// Sample data for new bases
const SAMPLE_DATA = {
  Products: [
    {
      fields: {
        'Name': 'Sample Widget',
        'SKU': 'WIDGET-001',
        'Description': 'This is a sample product to show how the shop works. Replace it with your own products!',
        'Price': 19.99,
        'Colors': ['Blue', 'Red'],
        'Sizes': ['S', 'M', 'L'],
        'Tags': ['New', 'Featured'],
        'Active': true,
        'Pinned': true
      }
    },
    {
      fields: {
        'Name': 'Demo Gadget',
        'SKU': 'GADGET-001',
        'Description': 'Another example product with different options. Delete these samples when you add your own!',
        'Price': 29.99,
        'Colors': ['Black', 'White'],
        'Sizes': ['One Size'],
        'Tags': ['Handmade'],
        'Active': true,
        'Made By Me': true
      }
    }
  ],
  Events: [
    {
      fields: {
        'Name': 'Sample Market Day',
        'Date': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        'Location': 'Community Center',
        'City': 'Your City',
        'State': 'Your State',
        'Description': 'Example event to show the events feature. Update with your real events!',
        'Status': 'Upcoming',
        'Featured': true
      }
    }
  ],
  Deals: [
    {
      fields: {
        'Name': 'Free Shipping Over $25',
        'Description': 'Get free shipping on orders over $25',
        'Min Amount': 25,
        'Discount Value': 10,
        'Discount Type': 'Fixed',
        'Active': true
      }
    }
  ],
  '_Meta': [
    {
      fields: {
        'Key': 'schema_version',
        'Value': SCHEMA_VERSION
      }
    }
  ]
};

async function createBase(token, workspaceId, baseName) {
  console.log(`\nCreating base "${baseName}"...`);

  const payload = {
    name: baseName,
    tables: TABLES
  };

  if (workspaceId) {
    payload.workspaceId = workspaceId;
  }

  const result = await airtableRequest('/meta/bases', {
    method: 'POST',
    token,
    body: JSON.stringify(payload)
  });

  console.log(`✓ Base created: ${result.id}`);
  return result;
}

async function addSampleData(token, baseId) {
  console.log('\nAdding sample data...');

  for (const [tableName, records] of Object.entries(SAMPLE_DATA)) {
    if (records.length === 0) continue;

    console.log(`  Adding ${records.length} record(s) to ${tableName}...`);

    await airtableRequest(`/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ records })
    });
  }

  console.log('✓ Sample data added');
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.token) {
    console.error('Error: Airtable Personal Access Token is required.');
    console.error('Use --token YOUR_PAT or set AIRTABLE_PAT environment variable.');
    console.error('Run with --help for more information.');
    process.exit(1);
  }

  try {
    // Create the base
    const base = await createBase(options.token, options.workspaceId, options.baseName);

    // Add sample data
    await addSampleData(options.token, base.id);

    // Success output
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS! Your DreamShop Airtable base is ready.');
    console.log('='.repeat(60));
    console.log(`
Base ID: ${base.id}

Next steps:

1. Add the Base ID to your worker secrets:
   cd _workers
   wrangler secret put AIRTABLE_BASE_ID
   # Paste: ${base.id}

2. View your new base:
   https://airtable.com/${base.id}

3. Add your own products and delete the samples!

Schema version: ${SCHEMA_VERSION}
`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
