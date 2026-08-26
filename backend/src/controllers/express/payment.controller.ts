import { Request, Response } from 'express';

// Payment is now handled directly by the Payment Orchestration Service (POS).
// These stubs exist only to satisfy the router; actual logic lives on the frontend.

export async function initiatePayment(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ error: 'This endpoint is no longer used. Payment is handled via POS directly.' });
}

export async function handlePaymentResponse(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ error: 'This endpoint is no longer used.' });
}

export async function checkPaymentStatus(_req: Request, res: Response): Promise<void> {
  res.status(410).json({ error: 'This endpoint is no longer used.' });
}
