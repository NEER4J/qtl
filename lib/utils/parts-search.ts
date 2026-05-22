// Build a PostgREST filter chain that matches each whitespace-separated word
// in `query` across one or more text columns (OR'd within a word, AND'd
// across words).
//
// Why: a naive `.or("part_number.ilike.%foo%,description.ilike.%foo%")` breaks
// the moment the search term contains a comma, parenthesis, period, or colon —
// PostgREST treats those as filter delimiters and the query silently mis-parses.
// Wrapping each value in `"..."` per PostgREST's "enclosed string" rules makes
// special characters safe, and splitting on whitespace lets the user type
// "donaldson air" to find "Donaldson — Air filter".

type Filterable = {
  or: (filter: string) => Filterable;
};

const SQL_WILDCARDS = /[%_]/g;

function escapeIlikeValue(word: string): string {
  // ilike treats % and _ as wildcards — escape so a user-typed % matches a
  // literal %. The leading/trailing % we add ourselves for substring matching.
  const escaped = word.replace(SQL_WILDCARDS, (m) => `\\${m}`);
  return `%${escaped}%`;
}

function quoteOrValue(value: string): string {
  // PostgREST's `.or()` parser uses , : ( ) . as delimiters. Wrapping the
  // value in double quotes and escaping embedded quotes/backslashes keeps the
  // raw user input intact. https://postgrest.org/en/stable/references/api/url_grammar.html
  const inner = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${inner}"`;
}

/**
 * Apply a multi-word ilike search across the given columns. Each whitespace-
 * separated word becomes its own `.or(col.ilike.<word>, col.ilike.<word>, …)`
 * filter, and chaining multiple `.or()` calls AND's them together — so a query
 * of "donaldson air" requires every column-set to match "donaldson" AND
 * "air" somewhere.
 *
 * Pass it directly into a Supabase query builder chain:
 *   query = applyPartsSearch(query, q, ["part_number", "description", "brand"]);
 */
export function applyPartsSearch<Q extends Filterable>(
  query: Q,
  rawSearch: string | undefined | null,
  columns: readonly string[],
): Q {
  const term = rawSearch?.trim();
  if (!term) return query;

  const words = term.split(/\s+/).filter((w) => w.length > 0);
  let chain = query;
  for (const word of words) {
    const value = quoteOrValue(escapeIlikeValue(word));
    const orParts = columns.map((col) => `${col}.ilike.${value}`).join(",");
    chain = chain.or(orParts) as Q;
  }
  return chain;
}
