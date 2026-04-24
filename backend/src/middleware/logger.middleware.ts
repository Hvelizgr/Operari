import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import pinoHttp from 'pino-http';

import { logger } from '../config/logger.config';

export const requestLogger = pinoHttp({
  logger,
  genReqId: req => (req.headers['x-request-id'] as string) || randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'duration',
  },
  serializers: {
    req: req => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    }),
    res: res => ({
      statusCode: res.statusCode,
    }),
  },
  autoLogging: {
    ignore: req => {
      return req.url === '/health' || req.url === '/live' || req.url === '/metrics';
    },
  },
});

export const addUserContext = (req: Request, res: Response, next: NextFunction) => {
  // authenticate() decorates req with `user`; at this middleware layer
  // we type it structurally so we don't drag the full AuthRequest
  // interface through an import cycle with auth.middleware.
  const authed = req as Request & {
    user?: { id: string; tenantId: string };
  };
  if (authed.user) {
    req.log = req.log.child({
      userId: authed.user.id,
      tenantId: authed.user.tenantId,
    });
  }
  next();
};
