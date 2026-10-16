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

/**
 * fetchAllRows for reads that span many pages (the reports and analytics: a
 * year of sales_jobs is ~28 pages). fetchAllRows reads them one after another,
 * one round trip each; this asks for an exact count alongside the first page
 * and then fetches the rest `concurrency` at a time, so the cost is about two
 * round trips whatever the range.
 *
 * `buildQuery` gets a third argument and must pass it to `.select(cols, { count })`.
 * The same ordering rule applies: a stable `.order()` ending on a unique column.
 * If rows are inserted after the count, the pages past it are read serially
 * until a short one, exactly as fetchAllRows would.
 */
export async function fetchAllRowsParallel<T>(
  buildQuery: (
    from: number,
    to: number,
    count?: "exact",
  ) => PromiseLike<{ data: unknown; error: unknown; count?: number | null }>,
  concurrency = 6,
): Promise<T[]> {
  const CHUNK = 1000;
  const first = await buildQuery(0, CHUNK - 1, "exact");
  if (first.error) throw first.error;
  const all = (first.data ?? []) as T[];
  if (all.length < CHUNK) return all;

  const starts: number[] = [];
  for (let from = CHUNK; from < (first.count ?? 0); from += CHUNK) starts.push(from);
  const pages: T[][] = new Array(starts.length);
  let next = 0;
  const worker = async () => {
    while (next < starts.length) {
      const i = next++;
      const { data, error } = await buildQuery(starts[i], starts[i] + CHUNK - 1);
      if (error) throw error;
      pages[i] = (data ?? []) as T[];
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, starts.length) }, worker));
  for (const page of pages) all.push(...page);

  // The count was missing, or rows arrived after it: carry on serially.
  if (pages.length === 0 || pages[pages.length - 1].length === CHUNK) {
    for (let from = CHUNK * (starts.length + 1); ; from += CHUNK) {
      const { data, error } = await buildQuery(from, from + CHUNK - 1);
      if (error) throw error;
      const rows = (data ?? []) as T[];
      all.push(...rows);
      if (rows.length < CHUNK) break;
    }
  }
  return all;
}
