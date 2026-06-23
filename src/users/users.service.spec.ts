import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Roles, User } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn().mockReturnValue('hashed-password'),
}));

const makeUser = (override: Partial<User> = {}): User => ({
  id: 'user-id',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: Roles.ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const buildAbility = (role: Roles) => {
  const svc = new CaslAbilityService();
  return svc.createForUser(makeUser({ role }));
};

describe('UsersService', () => {
  let service: UsersService;
  let prismaUserMock: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let abilityService: {
    ability: ReturnType<CaslAbilityService['createForUser']>;
  };

  const setupModule = async (role: Roles) => {
    prismaUserMock = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    abilityService = { ability: buildAbility(role) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: { user: prismaUserMock } },
        { provide: CaslAbilityService, useValue: abilityService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  };

  it('should be defined', async () => {
    await setupModule(Roles.ADMIN);
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: Roles.READER,
    };

    it('should create a user when ADMIN', async () => {
      await setupModule(Roles.ADMIN);
      const created = makeUser({ ...dto, id: 'new-id' });
      prismaUserMock.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(prismaUserMock.create).toHaveBeenCalledWith({
        data: { ...dto, password: 'hashed-password' },
      });
    });

    it('should hash the password before creating', async () => {
      await setupModule(Roles.ADMIN);
      prismaUserMock.create.mockResolvedValue(makeUser());

      await service.create(dto);

      expect(prismaUserMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashed-password',
          }) as unknown,
        }),
      );
    });

    it('should throw ForbiddenException for EDITOR role', async () => {
      await setupModule(Roles.EDITOR);

      expect(() => service.create(dto)).toThrow(ForbiddenException);
      expect(prismaUserMock.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for WRITER role', async () => {
      await setupModule(Roles.WRITER);

      expect(() => service.create(dto)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for READER role', async () => {
      await setupModule(Roles.READER);

      expect(() => service.create(dto)).toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return all users when ADMIN', async () => {
      await setupModule(Roles.ADMIN);
      const users = [
        makeUser(),
        makeUser({ id: 'other-id', email: 'other@example.com' }),
      ];
      prismaUserMock.findMany.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(prismaUserMock.findMany).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for EDITOR role', async () => {
      await setupModule(Roles.EDITOR);

      expect(() => service.findAll()).toThrow(ForbiddenException);
      expect(prismaUserMock.findMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException for READER role', async () => {
      await setupModule(Roles.READER);

      expect(() => service.findAll()).toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return a user when ADMIN', async () => {
      await setupModule(Roles.ADMIN);
      const user = makeUser();
      prismaUserMock.findUnique.mockResolvedValue(user);

      const result = await service.findOne('user-id');

      expect(result).toEqual(user);
      expect(prismaUserMock.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('should throw ForbiddenException for non-ADMIN roles', async () => {
      await setupModule(Roles.EDITOR);

      expect(() => service.findOne('user-id')).toThrow(ForbiddenException);
      expect(prismaUserMock.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const dto: UpdateUserDto = { name: 'Updated Name' };

    it('should update a user when ADMIN', async () => {
      await setupModule(Roles.ADMIN);
      const updated = makeUser({ name: 'Updated Name' });
      prismaUserMock.update.mockResolvedValue(updated);

      const result = await service.update('user-id', dto);

      expect(result).toEqual(updated);
      expect(prismaUserMock.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: dto,
      });
    });

    it('should throw ForbiddenException for non-ADMIN roles', async () => {
      await setupModule(Roles.WRITER);

      expect(() => service.update('user-id', dto)).toThrow(ForbiddenException);
      expect(prismaUserMock.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a user when ADMIN', async () => {
      await setupModule(Roles.ADMIN);
      const user = makeUser();
      prismaUserMock.delete.mockResolvedValue(user);

      const result = await service.remove('user-id');

      expect(result).toEqual(user);
      expect(prismaUserMock.delete).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('should throw ForbiddenException for non-ADMIN roles', async () => {
      await setupModule(Roles.READER);

      expect(() => service.remove('user-id')).toThrow(ForbiddenException);
      expect(prismaUserMock.delete).not.toHaveBeenCalled();
    });
  });
});
