import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Roles, User } from '@prisma/client';
import { AuthGuard } from './auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';

const mockUser: User = {
  id: 'user-id',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: Roles.ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAbility = { rules: [] };

const makeContext = (headers: Record<string, string> = {}): ExecutionContext => {
  const request = { headers, user: undefined, ability: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verify: jest.Mock };
  let prismaUserMock: { findUnique: jest.Mock };
  let abilityService: { createForUser: jest.Mock; ability: unknown };

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    prismaUserMock = { findUnique: jest.fn() };
    abilityService = {
      createForUser: jest.fn().mockReturnValue(mockAbility),
      ability: mockAbility,
    };

    guard = new AuthGuard(
      jwtService as unknown as JwtService,
      { user: prismaUserMock } as unknown as PrismaService,
      abilityService as unknown as CaslAbilityService,
    );
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for a valid token', async () => {
      const payload = { sub: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(mockUser);

      const context = makeContext({ authorization: 'Bearer valid-token' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should attach user to request when token is valid', async () => {
      const payload = { sub: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(mockUser);

      const request = { headers: { authorization: 'Bearer valid-token' }, user: undefined, ability: undefined };
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(request.user).toEqual(mockUser);
    });

    it('should attach ability to request when token is valid', async () => {
      const payload = { sub: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(mockUser);

      const request = { headers: { authorization: 'Bearer valid-token' }, user: undefined, ability: undefined };
      const context = {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(request.ability).toEqual(mockAbility);
      expect(abilityService.createForUser).toHaveBeenCalledWith(mockUser);
    });

    it('should throw UnauthorizedException when no token is provided', async () => {
      const context = makeContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when authorization header has no token part', async () => {
      const context = makeContext({ authorization: 'Bearer' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when JWT is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const context = makeContext({ authorization: 'Bearer invalid-token' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is not found in database', async () => {
      const payload = { sub: 'non-existent-id', name: 'Ghost', email: 'ghost@example.com', role: Roles.READER };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(null);

      const context = makeContext({ authorization: 'Bearer valid-token' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should look up user by payload.sub', async () => {
      const payload = { sub: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(mockUser);

      const context = makeContext({ authorization: 'Bearer valid-token' });
      await guard.canActivate(context);

      expect(prismaUserMock.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should verify JWT with HS256 algorithm', async () => {
      const payload = { sub: mockUser.id, name: mockUser.name, email: mockUser.email, role: mockUser.role };
      jwtService.verify.mockReturnValue(payload);
      prismaUserMock.findUnique.mockResolvedValue(mockUser);

      const context = makeContext({ authorization: 'Bearer valid-token' });
      await guard.canActivate(context);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        algorithms: ['HS256'],
      });
    });
  });
});
