import { SetMetadata } from '@nestjs/common';
import { Roles } from '@prisma/client';

export const RequiredRoles = (...roles: Roles[]) => SetMetadata('roles', roles);
