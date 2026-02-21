import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that restricts access to Builder endpoints.
 * Checks if the user email is in the allowed list (via BUILDER_EMAILS env var).
 *
 * Usage:
 *   BUILDER_EMAILS=admin@myseer.com,dev@myseer.com
 *
 * If BUILDER_EMAILS is not set, builder access is open (dev mode).
 */
export function builderMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedEmails = process.env.BUILDER_EMAILS;

  // If BUILDER_EMAILS not configured, allow all (dev mode)
  if (!allowedEmails) {
    next();
    return;
  }

  const userEmail = req.headers['x-user-email'] as string;

  if (!userEmail) {
    res.status(401).json({ error: 'x-user-email header é obrigatório' });
    return;
  }

  const allowed = allowedEmails.split(',').map(e => e.trim().toLowerCase());

  if (!allowed.includes(userEmail.toLowerCase())) {
    res.status(403).json({ error: 'Acesso ao Builder não autorizado para este usuário' });
    return;
  }

  next();
}
