/**
 * Typed application error. The central error middleware maps these to HTTP.
 * Anything that is not an AppError is treated as a 500.
 */
export class AppError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
