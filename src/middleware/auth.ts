import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors';

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

/**
 * DEMO auth: trusts an `x-user-id` header so the flows are runnable without an
 * identity provider. In production, replace with JWT verification / session
 * middleware that populates req.user from a verified token.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header('x-user-id');
  if (!userId) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Missing x-user-id header.'));
  }
  req.user = { id: userId };
  next();
}
