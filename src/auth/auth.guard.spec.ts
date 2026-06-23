import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';

describe('AuthGuard', () => {
  it('should be defined', () => {
    expect(
      new AuthGuard(
        {} as JwtService,
        {} as PrismaService,
        {} as CaslAbilityService,
      ),
    ).toBeDefined();
  });
});
