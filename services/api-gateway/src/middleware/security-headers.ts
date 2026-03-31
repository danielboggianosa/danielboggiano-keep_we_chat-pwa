import helmet from 'helmet';
import type { RequestHandler } from 'express';

/**
 * Security headers middleware using helmet.
 * Configures CSP, X-Content-Type-Options, X-Frame-Options, and HSTS.
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    xContentTypeOptions: true,
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }) as RequestHandler;
}
