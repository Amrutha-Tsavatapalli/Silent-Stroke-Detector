/**
 * Verification script for database migration setup
 * 
 * This script verifies that:
 * 1. node-pg-migrate is installed
 * 2. Configuration file exists and is valid
 * 3. Migrations directory exists
 * 4. NPM scripts are configured correctly
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

console.log('🔍 Verifying Database Migration Setup...\n');

let allChecksPass = true;

// Check 1: Verify node-pg-migrate is installed
console.log('✓ Check 1: node-pg-migrate installation');
try {
  const packageJson = JSON.parse(
    readFileSync(join(projectRoot, 'package.json'), 'utf-8')
  );
  
  if (packageJson.dependencies['node-pg-migrate']) {
    console.log(`  ✅ node-pg-migrate ${packageJson.dependencies['node-pg-migrate']} is installed`);
  } else {
    console.log('  ❌ node-pg-migrate is NOT installed');
    allChecksPass = false;
  }
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
  allChecksPass = false;
}

// Check 2: Verify configuration file exists and is valid
console.log('\n✓ Check 2: Migration configuration file');
try {
  const configPath = join(projectRoot, '.node-pg-migraterc.json');
  
  if (!existsSync(configPath)) {
    console.log('  ❌ .node-pg-migraterc.json does NOT exist');
    allChecksPass = false;
  } else {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    console.log('  ✅ .node-pg-migraterc.json exists and is valid JSON');
    
    // Verify key configuration options
    const requiredOptions = [
      'database-url-var',
      'migrations-dir',
      'migration-file-language',
      'check-order'
    ];
    
    const missingOptions = requiredOptions.filter(opt => !(opt in config));
    
    if (missingOptions.length > 0) {
      console.log(`  ⚠️  Missing configuration options: ${missingOptions.join(', ')}`);
    } else {
      console.log('  ✅ All required configuration options are present');
    }
    
    // Display key configuration values
    console.log(`  📋 Configuration:`);
    console.log(`     - Database URL variable: ${config['database-url-var']}`);
    console.log(`     - Migrations directory: ${config['migrations-dir']}`);
    console.log(`     - Migration language: ${config['migration-file-language']}`);
    console.log(`     - Check order: ${config['check-order']}`);
    console.log(`     - Single transaction: ${config['single-transaction']}`);
  }
} catch (error) {
  console.log(`  ❌ Error reading configuration: ${error.message}`);
  allChecksPass = false;
}

// Check 3: Verify migrations directory exists
console.log('\n✓ Check 3: Migrations directory');
try {
  const migrationsDir = join(projectRoot, 'migrations');
  
  if (!existsSync(migrationsDir)) {
    console.log('  ❌ migrations/ directory does NOT exist');
    allChecksPass = false;
  } else {
    console.log('  ✅ migrations/ directory exists');
  }
} catch (error) {
  console.log(`  ❌ Error checking migrations directory: ${error.message}`);
  allChecksPass = false;
}

// Check 4: Verify NPM scripts are configured
console.log('\n✓ Check 4: NPM migration scripts');
try {
  const packageJson = JSON.parse(
    readFileSync(join(projectRoot, 'package.json'), 'utf-8')
  );
  
  const requiredScripts = {
    'migrate:up': 'node-pg-migrate up',
    'migrate:down': 'node-pg-migrate down',
    'migrate:create': 'node-pg-migrate create'
  };
  
  let allScriptsPresent = true;
  
  for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
    if (packageJson.scripts[scriptName]) {
      if (packageJson.scripts[scriptName].includes('node-pg-migrate')) {
        console.log(`  ✅ ${scriptName}: ${packageJson.scripts[scriptName]}`);
      } else {
        console.log(`  ⚠️  ${scriptName} exists but may not be correct: ${packageJson.scripts[scriptName]}`);
      }
    } else {
      console.log(`  ❌ ${scriptName} is NOT configured`);
      allScriptsPresent = false;
      allChecksPass = false;
    }
  }
  
  if (allScriptsPresent) {
    console.log('  ✅ All required migration scripts are configured');
  }
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
  allChecksPass = false;
}

// Check 5: Verify DATABASE_URL environment variable guidance
console.log('\n✓ Check 5: Environment variable configuration');
console.log('  ℹ️  The DATABASE_URL environment variable must be set to run migrations');
console.log('  ℹ️  Example: DATABASE_URL=postgresql://user:password@localhost:5432/dbname');
console.log('  ℹ️  Set this in your .env file or as an environment variable');

if (process.env.DATABASE_URL) {
  // Don't print the actual URL for security
  console.log('  ✅ DATABASE_URL is currently set');
} else {
  console.log('  ⚠️  DATABASE_URL is NOT currently set (required to run migrations)');
}

// Summary
console.log('\n' + '='.repeat(60));
if (allChecksPass) {
  console.log('✅ All checks passed! Migration system is properly configured.');
  console.log('\n📚 Next steps:');
  console.log('   1. Set DATABASE_URL environment variable');
  console.log('   2. Create migrations with: npm run migrate:create <name>');
  console.log('   3. Apply migrations with: npm run migrate:up');
  console.log('   4. See docs/MIGRATIONS.md for detailed usage guide');
} else {
  console.log('❌ Some checks failed. Please review the errors above.');
  process.exit(1);
}
console.log('='.repeat(60));
