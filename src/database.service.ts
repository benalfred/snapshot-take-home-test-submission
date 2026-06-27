import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  async onModuleInit() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/peopleflow',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected pool error', err.message);
    });

    // Verify connection on startup
    const client = await this.pool.connect();
    client.release();
    this.logger.log('Database connection pool ready');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /** Execute a single query */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  /** Execute a single query and return first row or null */
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Run a set of operations inside a serializable transaction.
   * The callback receives a PoolClient so it can issue multiple
   * queries atomically. Row-level locking (SELECT … FOR UPDATE)
   * is available inside the callback.
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
