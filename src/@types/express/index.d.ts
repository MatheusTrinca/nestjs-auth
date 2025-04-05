// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as express from 'express';
import type { User } from '@prisma/client';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
    }
  }
}
