export interface ChargeRequest {
  idempotencyKey: string;
  amount: string;
  userId: string;
}

export interface PaymentGateway {
  charge(req: ChargeRequest): Promise<{ transactionId: string }>;
}

/**
 * Stub gateway for local runs. A real implementation (Stripe/Razorpay/etc.)
 * must pass `idempotencyKey` through to the provider so a retried charge is
 * deduplicated on their side too.
 */
export class StubPaymentGateway implements PaymentGateway {
  async charge(req: ChargeRequest): Promise<{ transactionId: string }> {
    // Simulate the provider honouring the idempotency key.
    return { transactionId: `txn_${req.idempotencyKey}` };
  }
}
