import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Returns the set of migration filenames that have already been applied.
 */
async function getAppliedMigrations(client: pg.Client): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(result.rows.map((r) => r.filename));
}

/**
 * Reads all .sql files from the migrations directory, sorted by name.
 */
function getMigrationFiles(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Runs all pending SQL migrations in order.
 * Connects to PostgreSQL using DATABASE_URL from environment variables.
 * Tracks applied migrations in a `schema_migrations` table.
 * Returns the number of migrations applied.
 */
export async function runMigrations(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);

    // Resolve migrations directory relative to this file.
    // In compiled output (dist/), migrations is at ../migrations/
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const files = getMigrationFiles(migrationsDir);

    let appliedCount = 0;

    for (const filename of files) {
      if (applied.has(filename)) {
        continue;
      }

      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Applying migration: ${filename}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`Migration applied: ${filename}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration failed: ${filename} — ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (appliedCount === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${appliedCount} migration(s).`);
    }

    return appliedCount;
  } finally {
    await client.end();
  }
}
