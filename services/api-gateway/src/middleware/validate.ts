import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

interface ValidationError {
  field: string;
  message: string;
}

type RequestLocation = 'body' | 'query' | 'params';

/**
 * Generic Zod validation middleware factory.
 * Validates the specified request location (body, query, or params) against a Zod schema.
 * Returns 400 with a list of field-level errors on validation failure.
 */
export function validate(schema: z.ZodType, location: RequestLocation = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[location];
    const result = schema.safeParse(data);

    if (!result.success) {
      const details: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || location,
        message: issue.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        code: 400,
        details,
      });
      return;
    }

    // Replace with parsed (and coerced) data
    (req as unknown as Record<string, unknown>)[location] = result.data;
    next();
  };
}
