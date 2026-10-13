import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requireJobsSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.JOBS_SECRET;
  if (!secret || secret.trim() === '') {
    return res.status(404).json({ error: 'Not Found' });
  }

  const provided = req.header('x-jobs-secret');
  if (!provided) {
    return res.status(404).json({ error: 'Not Found' });
  }

  const secretHash = crypto.createHash('sha256').update(secret).digest();
  const providedHash = crypto.createHash('sha256').update(provided).digest();

  if (secretHash.length !== providedHash.length || !crypto.timingSafeEqual(secretHash, providedHash)) {
    return res.status(404).json({ error: 'Not Found' });
  }

  next();
}
