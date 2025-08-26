import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as any;
    req.userId = payload.sub || payload.id;
    if (!req.userId) throw new Error('NO_SUB');
    next();
  } catch {
    return res.status(401).json({ error: 'BAD_TOKEN' });
  }
}
