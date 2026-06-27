import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/peopleflow',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    const migrationsDir = path.join(__dirname);
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`Running ${file}...`);
      await client.query(sql);
      console.log(`  ✓ ${file} done`);
    }

    console.log('\nAll migrations complete.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
