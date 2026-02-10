import { Request, Response, NextFunction } from 'express';
import { TenantContext } from '../types';

/**
 * Extend Express Request to include tenant context.
 */
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Middleware that extracts tenant context from request headers.
 *
 * Expected headers:
 *   x-tenant-id: the tenant UUID
 *   x-user-email: the authenticated user's email
 *
 * Your existing auth middleware should set these headers
 * before reaching the IRIS routes.
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;
  const userEmail = req.headers['x-user-email'] as string | undefined;

  if (!tenantId || !userEmail) {
    res.status(401).json({
      error: 'Missing required headers: x-tenant-id and x-user-email',
    });
    return;
  }

  req.tenant = { tenantId, userEmail };
  next();
}
