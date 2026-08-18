import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReservationService } from './reservationService';

export const reserveSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const reserveHandler =
  (svc: ReservationService) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, quantity } = req.body as z.infer<typeof reserveSchema>;
      const userId = req.user!.id; // guaranteed by authMiddleware
      const result = await svc.reserve(userId, productId, quantity);
      res.status(201).json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  };
