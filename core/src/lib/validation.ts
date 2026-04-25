import type { Context } from 'hono'
import type { z } from 'zod'

/**
 * @summary Shared hook for `@hono/zod-validator` — returns a uniform
 * 400 response on validation failure.
 *
 * @remarks
 * Every route that accepts a JSON body uses this hook so error shapes
 * stay consistent: `{ error: 'Validation failed', fields: <flattened> }`.
 */
export const validationHook = (
  result: { success: boolean; error?: z.ZodError },
  c: Context,
) => {
  if (!result.success) {
    return c.json(
      { error: 'Validation failed', fields: result.error?.flatten() },
      400,
    )
  }
}
