import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      ok: false,
      error: { code: err.code, message: err.message },
    });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  });
}
