import "server-only";

import { ZodError, type ZodType, type z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";

import { AuthorizationError, requireProfile, requireRole } from "@/lib/auth/require";
import type { Profile, UserRole } from "@/lib/db/types";

/**
 * Thrown when a save would consume more of a part/oil than is on hand at the
 * location. Carries its own error code so the client can offer a role-gated
 * "sell anyway" override instead of just showing a dead-end error.
 */
export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      code?: string;
    };

// Use the schema's OUTPUT type (post-parse) for the handler input.
// z.infer<S> === z.output<S>.
export interface WrapActionOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S extends ZodType<any, any, any>,
  Output,
> {
  schema: S;
  roles?: UserRole[];
  handler: (input: z.infer<S>, profile: Profile) => Promise<Output>;
}

/**
 * Common action wrapper:
 *   1. Loads the caller profile.
 *   2. Enforces role (optional).
 *   3. Zod-parses input.
 *   4. Runs handler.
 *   5. Maps Postgres / Supabase errors to friendly messages.
 *
 * Usage:
 *   export const createLocation = wrapAction({
 *     schema: CreateLocationInput,
 *     roles: ['owner'],
 *     handler: async (input, profile) => { ... },
 *   });
 *
 * Returns an async function `(input) => ActionResult<Output>`.
 */
export function wrapAction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  S extends ZodType<any, any, any>,
  Output,
>({
  schema,
  roles,
  handler,
}: WrapActionOptions<S, Output>) {
  return async (rawInput: unknown): Promise<ActionResult<Output>> => {
    let profile: Profile;
    try {
      profile = roles?.length
        ? await requireRole(...roles)
        : await requireProfile();
    } catch (err) {
      if (err instanceof AuthorizationError) {
        return { ok: false, error: err.message, code: "forbidden" };
      }
      throw err;
    }

    let parsed: z.infer<S>;
    try {
      parsed = schema.parse(rawInput);
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "_";
          fieldErrors[key] = fieldErrors[key] ?? [];
          fieldErrors[key].push(issue.message);
        }
        return {
          ok: false,
          error: "Please fix the highlighted fields.",
          fieldErrors,
          code: "validation",
        };
      }
      throw err;
    }

    try {
      const data = await handler(parsed, profile);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, ...mapError(err) };
    }
  };
}

function mapError(err: unknown): { error: string; code?: string; fieldErrors?: Record<string, string[]> } {
  if (err instanceof AuthorizationError) {
    return { error: err.message, code: "forbidden" };
  }
  if (err instanceof InsufficientStockError) {
    return { error: err.message, code: "insufficient_stock" };
  }
  const pgErr = err as PostgrestError | undefined;
  if (pgErr && typeof pgErr === "object" && "code" in pgErr) {
    // Always log the raw PG error server-side — the user-facing message is
    // intentionally generic but we need the real detail for diagnosis.
    console.error("[pgErr]", {
      code: pgErr.code,
      message: pgErr.message,
      details: pgErr.details,
      hint: pgErr.hint,
    });
    switch (pgErr.code) {
      case "23505":
        // Unique violation — try to surface which column.
        return {
          error: "Duplicate value: a record with the same unique field already exists.",
          code: pgErr.code,
        };
      case "23503":
        return {
          error: "Referenced record not found.",
          code: pgErr.code,
        };
      case "23514":
        // Name the rule that rejected the write — "Value violates a
        // constraint." on its own is undiagnosable from a support screenshot.
        return {
          error: pgErr.message
            ? `Value violates a constraint: ${pgErr.message}`
            : "Value violates a constraint.",
          code: pgErr.code,
        };
      case "42501":
        // Include the PG message so the client sees *which* rule blocked
        // the write. Internal tool — no need to hide it.
        return {
          error: pgErr.message
            ? `Not authorised: ${pgErr.message}`
            : "You are not authorised to perform this action.",
          code: pgErr.code,
        };
      default:
        if (pgErr.message) {
          return { error: pgErr.message, code: pgErr.code };
        }
    }
  }
  if (err instanceof Error) {
    console.error("[actionErr]", err);
    return { error: err.message };
  }
  console.error("[actionErr] unknown", err);
  return { error: "Unexpected error." };
}

/**
 * Shortcut for read-only queries that don't need schema validation.
 * Still enforces the caller is signed in.
 */
export async function withProfile<T>(handler: (profile: Profile) => Promise<T>): Promise<T> {
  const profile = await requireProfile();
  return handler(profile);
}
