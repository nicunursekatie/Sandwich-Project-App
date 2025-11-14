import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment
const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

/**
 * Split SQL into individual statements, being careful about:
 * - DO $$ ... END $$; blocks (PL/pgSQL)
 * - String literals with semicolons
 * - Comments with semicolons
 */
function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let inSingleQuote = false;
  let inComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];
    const prev = sql[i - 1];

    // Check for -- comments
    if (!inDollarQuote && !inSingleQuote && char === '-' && next === '-') {
      inComment = true;
      current += char;
      continue;
    }

    // End of line ends comment
    if (inComment && (char === '\n' || char === '\r')) {
      inComment = false;
      current += char;
      continue;
    }

    // Skip if in comment
    if (inComment) {
      current += char;
      continue;
    }

    // Check for dollar quotes ($$, $tag$, etc.)
    if (char === '$') {
      // Find the dollar tag
      let tag = '$';
      let j = i + 1;
      while (j < sql.length && sql[j] !== '$') {
        tag += sql[j];
        j++;
      }
      if (j < sql.length) {
        tag += '$';

        if (!inDollarQuote) {
          // Starting a dollar quote
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i = j;
          continue;
        } else if (tag === dollarTag) {
          // Ending the dollar quote
          inDollarQuote = false;
          dollarTag = '';
          current += tag;
          i = j;
          continue;
        }
      }
    }

    // Check for single quotes
    if (!inDollarQuote && char === "'") {
      if (inSingleQuote && next === "'") {
        // Escaped quote ''
        current += char + next;
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    // Check for semicolon (statement terminator)
    if (!inDollarQuote && !inSingleQuote && char === ';') {
      current += char;
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  // Add any remaining content
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

async function runAllMigrations() {
  logger.log('🔄 Running database migrations...');

  // Connect to database using Neon HTTP
  const sql = neon(DATABASE_URL);

  try {
    // Create migrations tracking table if it doesn't exist
    await sql(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files from the migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      logger.error('❌ Migrations directory not found at:', migrationsDir);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    logger.log(`📁 Found ${files.length} migration files`);

    for (const file of files) {
      // Check if migration has already been executed
      const result = await sql`
        SELECT * FROM "_migrations" WHERE name = ${file}
      `;

      if (result.length > 0) {
        logger.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      // Read and execute the migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      logger.log(`📝 Executing ${file}...`);

      // Split by statement-breakpoint if it exists, otherwise split by semicolons
      let statements: string[];
      if (migrationSQL.includes('--> statement-breakpoint')) {
        statements = migrationSQL.split('--> statement-breakpoint');
      } else {
        // Split by semicolons, being careful of DO blocks and strings
        statements = splitSQLStatements(migrationSQL);
      }

      for (let idx = 0; idx < statements.length; idx++) {
        const statement = statements[idx];
        let trimmed = statement.trim();

        // Skip completely empty statements
        if (!trimmed) {
          logger.log(`  Skipping statement ${idx + 1}/${statements.length} (empty)`);
          continue;
        }

        // Remove standalone comment lines (lines that ONLY have comments)
        // but keep inline comments like: foo VARCHAR, -- this is a comment
        trimmed = trimmed
          .split('\n')
          .filter(line => {
            const lineTrimmed = line.trim();
            // Keep the line if it's not empty and doesn't start with --
            if (!lineTrimmed) return false;
            if (lineTrimmed.startsWith('--')) return false;
            return true;
          })
          .join('\n')
          .trim();

        // Skip if nothing left after removing comments
        if (!trimmed) {
          logger.log(`  Skipping statement ${idx + 1}/${statements.length} (comment-only)`);
          continue;
        }

        try {
          logger.log(`  Executing statement ${idx + 1}/${statements.length}...`);
          await sql(trimmed);
        } catch (error) {
          logger.error(`Failed on statement ${idx + 1}:`);
          logger.error(trimmed.substring(0, 200));
          throw error;
        }
      }

      // Mark migration as executed
      await sql`
        INSERT INTO "_migrations" (name) VALUES (${file})
      `;

      logger.log(`✅ ${file} completed`);
    }

    logger.log('✅ All migrations completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAllMigrations();
