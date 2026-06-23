import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';
import { Roles, User } from '@prisma/client';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn(),
}));

import bcrypt from 'bcrypt';

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

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let prismaUserMock: { findUnique: jest.Mock };
  let abilityService: { createForUser: jest.Mock; ability: unknown };

  beforeEach(async () => {
    prismaUserMock = { findUnique: jest.fn() };

    jwtService = { sign: jest.fn().mockReturnValue('mock-jwt-token') };

    abilityService = {
      createForUser: jest.fn().mockReturnValue(mockAbility),
      ability: mockAbility,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        {
          provide: PrismaService,
          useValue: { user: prismaUserMock },
        },
        { provide: CaslAbilityService, useValue: abilityService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return an access_token on valid credentials', async () => {
      prismaUserMock.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'mock-jwt-token' });
    });

    it('should query the user by email', async () => {
      prismaUserMock.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ email: 'test@example.com', password: 'password' });

      expect(prismaUserMock.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should call jwtService.sign with correct payload', async () => {
      prismaUserMock.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ email: 'test@example.com', password: 'password' });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockUser.name,
          email: mockUser.email,
          role: mockUser.role,
          sub: mockUser.id,
        }),
      );
    });

    it('should create CASL ability for the authenticated user', async () => {
      prismaUserMock.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login({ email: 'test@example.com', password: 'password' });

      expect(abilityService.createForUser).toHaveBeenCalledWith(mockUser);
    });

    it('should throw when user does not exist', async () => {
      prismaUserMock.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw when password is incorrect', async () => {
      prismaUserMock.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should not call jwtService.sign when credentials are invalid', async () => {
      prismaUserMock.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password' }),
      ).rejects.toThrow();

      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });
});
