#!/usr/bin/env node

/**
 * DreamShop Airtable Migration Script
 *
 * Upgrades an existing Airtable base to the latest schema version.
 *
 * Usage:
 *   node migrate-airtable.js --token YOUR_PAT --base-id appXXXXXXXX
 *
 * Required token scopes:
 *   - schema.bases:read
 *   - schema.bases:write
 *   - data.records:read
 *   - data.records:write
 */

const CURRENT_VERSION = '1.0';

// Migration definitions - add new migrations here
const MIGRATIONS = {
  // Example migration for future use:
  // '1.0_to_1.1': {
  //   description: 'Add Inventory field to Products',
  //   async migrate(api, baseId) {
  //     // Get Products table ID
  //     const schema = await api.getBaseSchema(baseId);
  //     const productsTable = schema.tables.find(t => t.name === 'Products');
  //
  //     // Add new field
  //     await api.createField(baseId, productsTable.id, {
  //       name: 'Inventory',
  //       type: 'number',
  //       options: { precision: 0 }
  //     });
  //   }
  // }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    token: process.env.AIRTABLE_PAT || null,
    baseId: process.env.AIRTABLE_BASE_ID || null,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--token':
      case '-t':
        options.token = args[++i];
        break;
      case '--base-id':
      case '-b':
        options.baseId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
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
DreamShop Airtable Migration Script

Upgrades an existing Airtable base to the latest schema version.

USAGE:
  node migrate-airtable.js --token YOUR_PAT --base-id appXXX [options]

OPTIONS:
  -t, --token <token>       Airtable Personal Access Token (required)
  -b, --base-id <id>        Base ID to migrate (required)
  --dry-run                 Show what would be done without making changes
  -h, --help                Show this help message

REQUIRED TOKEN SCOPES:
  - schema.bases:read       To read current schema
  - schema.bases:write      To modify schema
  - data.records:read       To read current version
  - data.records:write      To update version

EXAMPLE:
  node migrate-airtable.js --token patXXX --base-id appXXX
  node migrate-airtable.js --token patXXX --base-id appXXX --dry-run

Current target version: ${CURRENT_VERSION}
`);
}

// Airtable API helpers
class AirtableAPI {
  constructor(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`https://api.airtable.com/v0${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
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

  async getBaseSchema(baseId) {
    return this.request(`/meta/bases/${baseId}/tables`);
  }

  async getRecords(baseId, tableName, options = {}) {
    const params = new URLSearchParams();
    if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula);
    if (options.maxRecords) params.set('maxRecords', options.maxRecords);

    const query = params.toString() ? `?${params}` : '';
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}${query}`);
  }

  async updateRecord(baseId, tableName, recordId, fields) {
    return this.request(`/${baseId}/${encodeURIComponent(tableName)}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields })
    });
  }

  async createField(baseId, tableId, fieldConfig) {
    return this.request(`/meta/bases/${baseId}/tables/${tableId}/fields`, {
      method: 'POST',
      body: JSON.stringify(fieldConfig)
    });
  }

  async createTable(baseId, tableConfig) {
    return this.request(`/meta/bases/${baseId}/tables`, {
      method: 'POST',
      body: JSON.stringify(tableConfig)
    });
  }
}

async function getCurrentVersion(api, baseId) {
  try {
    const result = await api.getRecords(baseId, '_Meta', {
      filterByFormula: "{Key} = 'schema_version'",
      maxRecords: 1
    });

    if (result.records && result.records.length > 0) {
      return {
        version: result.records[0].fields.Value || '0.0',
        recordId: result.records[0].id
      };
    }
  } catch (error) {
    // _Meta table might not exist
    console.log('Note: _Meta table not found, assuming version 0.0');
  }

  return { version: '0.0', recordId: null };
}

function getMigrationPath(fromVersion, toVersion) {
  const path = [];
  let current = fromVersion;

  // Simple version comparison (works for x.y format)
  const versions = Object.keys(MIGRATIONS)
    .map(key => {
      const [from, to] = key.split('_to_');
      return { key, from, to };
    })
    .sort((a, b) => parseFloat(a.from) - parseFloat(b.from));

  for (const migration of versions) {
    if (parseFloat(migration.from) >= parseFloat(current) &&
        parseFloat(migration.to) <= parseFloat(toVersion)) {
      path.push(migration.key);
      current = migration.to;
    }
  }

  return path;
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
    process.exit(1);
  }

  if (!options.baseId) {
    console.error('Error: Base ID is required.');
    console.error('Use --base-id appXXX or set AIRTABLE_BASE_ID environment variable.');
    process.exit(1);
  }

  const api = new AirtableAPI(options.token);

  try {
    console.log('DreamShop Airtable Migration');
    console.log('='.repeat(40));
    console.log(`Base ID: ${options.baseId}`);
    console.log(`Target version: ${CURRENT_VERSION}`);
    if (options.dryRun) {
      console.log('Mode: DRY RUN (no changes will be made)');
    }
    console.log();

    // Get current version
    const { version: currentVersion, recordId: versionRecordId } = await getCurrentVersion(api, options.baseId);
    console.log(`Current version: ${currentVersion}`);

    if (currentVersion === CURRENT_VERSION) {
      console.log('\n✓ Base is already at the latest version. Nothing to do.');
      process.exit(0);
    }

    // Determine migration path
    const migrationPath = getMigrationPath(currentVersion, CURRENT_VERSION);

    if (migrationPath.length === 0) {
      console.log('\nNo migrations needed to reach target version.');
      console.log('If your base was created manually, you may need to create the _Meta table');
      console.log('and add a record with Key="schema_version" and Value="' + CURRENT_VERSION + '"');
      process.exit(0);
    }

    console.log(`\nMigrations to apply: ${migrationPath.length}`);
    for (const key of migrationPath) {
      console.log(`  - ${key}: ${MIGRATIONS[key].description}`);
    }

    if (options.dryRun) {
      console.log('\n[DRY RUN] No changes made.');
      process.exit(0);
    }

    // Apply migrations
    console.log('\nApplying migrations...');
    for (const key of migrationPath) {
      console.log(`\nRunning: ${key}`);
      await MIGRATIONS[key].migrate(api, options.baseId);
      console.log(`✓ ${key} complete`);
    }

    // Update version in _Meta
    if (versionRecordId) {
      await api.updateRecord(options.baseId, '_Meta', versionRecordId, {
        Value: CURRENT_VERSION
      });
      console.log(`\n✓ Updated schema_version to ${CURRENT_VERSION}`);
    } else {
      console.log('\nNote: Could not update schema_version (no _Meta record found)');
    }

    console.log('\n' + '='.repeat(40));
    console.log('Migration complete!');
    console.log(`Base is now at version ${CURRENT_VERSION}`);

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();
