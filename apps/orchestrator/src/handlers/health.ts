// Health check endpoint handler

import type { Request, Response } from 'express';

export async function handleHealthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'unknown',
  });
}
