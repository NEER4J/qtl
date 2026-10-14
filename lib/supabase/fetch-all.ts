/**
 * Page through a PostgREST query that can return more than 1000 rows.
 *
 * Supabase's REST layer caps EVERY response at `max_rows` (1000 — see
 * `max_rows` in supabase/config.toml and the project's API settings), and
 * `.limit(10000)` does not lift it: the request still comes back with the first
 * 1000 rows and no error, so the overflow is silently dropped. Any table that
 * can grow past that has to be read in `.range()` chunks.
 *
 * `buildQuery` must apply a stable `.order()` — ideally on a unique column such
 * as `id` — or the pages can overlap or skip rows.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const CHUNK = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await buildQuery(from, from + CHUNK - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < CHUNK) break;
  }
  return all;
}
