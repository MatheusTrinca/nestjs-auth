import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPoolEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    end: mockPoolEnd,
  })),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: mockConnect,
    $disconnect: mockDisconnect,
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    post: { findUnique: jest.fn(), findMany: jest.fn() },
  })),
}));

describe('PrismaService', () => {
  let service: PrismaService;

  const mockConfigService = {
    get: jest
      .fn()
      .mockReturnValue({ url: 'postgresql://user:pass@localhost:5432/testdb' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose user model via getter', () => {
    expect(service.user).toBeDefined();
  });

  it('should expose post model via getter', () => {
    expect(service.post).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call $connect on the Prisma client', async () => {
      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on the Prisma client', async () => {
      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should call end on the connection pool', async () => {
      await service.onModuleDestroy();

      expect(mockPoolEnd).toHaveBeenCalledTimes(1);
    });
  });
});
