import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CheckoutService } from './checkoutService';
import { AppError } from '../../common/errors';

export const checkoutSchema = z.object({
  reservationId: z.string().uuid(),
});

export const checkoutHandler =
  (svc: CheckoutService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reservationId } = req.body as z.infer<typeof checkoutSchema>;
      const userId = req.user!.id;

      // Idempotency key travels in a header (standard for payment-style APIs).
      const idempotencyKey = req.header('idempotency-key');
      if (!idempotencyKey) {
        throw new AppError(400, 'MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required.');
      }

      const order = await svc.checkout(userId, reservationId, idempotencyKey);
      res.status(201).json({ ok: true, order });
    } catch (e) {
      next(e);
    }
  };
