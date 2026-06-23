// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as express from 'express';
import type { User } from '@prisma/client';
import type { AppAbility } from '../../casl/casl-ability/casl-ability.service';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
      ability?: AppAbility;
    }
  }
}
