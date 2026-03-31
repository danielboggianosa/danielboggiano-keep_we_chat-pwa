import type { Request, Response, NextFunction } from 'express';

/**
 * Common SQL injection patterns to strip from string inputs.
 */
const SQL_PATTERNS = [
  /(\b)(union\s+select|select\s+.*\s+from|insert\s+into|update\s+.*\s+set|delete\s+from|drop\s+table|alter\s+table|create\s+table|exec\s*\(|execute\s*\()/gi,
  /('|"|;|--|\b(or|and)\b\s+\d+\s*=\s*\d+)/gi,
  /(\/\*[\s\S]*?\*\/)/g, // block comments
];

/**
 * Common XSS patterns to strip from string inputs.
 */
const XSS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<\s*\/?\s*script\b[^>]*>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // event handlers like onclick="..."
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /<\s*\/?\s*iframe\b[^>]*>/gi,
  /<object\b[^>]*>[\s\S]*?<\/object>/gi,
  /<embed\b[^>]*>/gi,
];

/**
 * Sanitizes a single string value by stripping SQL injection and XSS patterns.
 */
export function sanitizeString(value: string): string {
  let sanitized = value;

  for (const pattern of SQL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Trim whitespace that may result from stripping
  return sanitized.trim();
}

/**
 * Recursively sanitizes all string values in an object or array.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Input sanitization middleware.
 * Strips SQL injection patterns and XSS payloads from req.body, req.query, and req.params.
 */
export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as typeof req.query;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params) as typeof req.params;
  }
  next();
}
