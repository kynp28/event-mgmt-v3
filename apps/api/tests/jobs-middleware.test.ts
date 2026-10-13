import { describe, it, expect, vi } from 'vitest';
import { requireJobsSecret } from '../src/middlewares/jobs.middleware';
import { Request, Response, NextFunction } from 'express';

describe('requireJobsSecret middleware', () => {
  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  };

  it('should return 404 if JOBS_SECRET is unset', () => {
    delete process.env.JOBS_SECRET;
    const req = { header: vi.fn() } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireJobsSecret(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if JOBS_SECRET is set but header is missing', () => {
    process.env.JOBS_SECRET = 'secret';
    const req = { header: vi.fn().mockReturnValue(undefined) } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireJobsSecret(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if header is wrong', () => {
    process.env.JOBS_SECRET = 'secret';
    const req = { header: vi.fn().mockReturnValue('wrong') } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireJobsSecret(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if header is correct', () => {
    process.env.JOBS_SECRET = 'secret';
    const req = { header: vi.fn().mockReturnValue('secret') } as unknown as Request;
    const res = mockResponse();
    const next = vi.fn();

    requireJobsSecret(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
