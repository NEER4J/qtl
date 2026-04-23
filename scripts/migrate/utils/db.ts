// Postgres connection + savepoint-style transaction wrapper.
// Uses postgres (postgres.js) so we get a single long-lived connection and
// first-class transactions — supabase-js doesn't expose BEGIN/COMMIT.

import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;

let client: Sql | null = null;

export function getSql(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
    );
  }
  client = postgres(url, {
    max: 1,
    idle_timeout: 20,
    prepare: false,
    onnotice: () => {},
  });
  return client;
}

export async function closeSql(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
  }
}

/**
 * Run `fn` inside a transaction. If `commit === false` the transaction is
 * always rolled back at the end (dry-run). If `fn` throws, rollback either way.
 *
 * `setActorId` stamps a Postgres session-local setting so the audit trigger
 * (and any server-side helpers we add later) can fall back to it when
 * auth.uid() is null under service_role.
 */
export async function withTx<T>(
  opts: { commit: boolean; actorId?: string | null },
  fn: (sql: Sql) => Promise<T>,
): Promise<T> {
  const sql = getSql();
  try {
    const out = await sql.begin(async (tx) => {
      if (opts.actorId) {
        await tx`select set_config('app.actor_id', ${opts.actorId}, true)`;
      }
      const result = await fn(tx as unknown as Sql);
      if (!opts.commit) {
        throw new DryRunRollback<T>(result);
      }
      return result;
    });
    return out as T;
  } catch (err) {
    if (err instanceof DryRunRollback) return err.result as T;
    throw err;
  }
}

class DryRunRollback<T> extends Error {
  result: T;
  constructor(result: T) {
    super("dry-run rollback");
    this.result = result;
  }
}
