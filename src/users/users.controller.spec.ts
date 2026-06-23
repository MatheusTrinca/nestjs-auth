import { Test, TestingModule } from '@nestjs/testing';
import { Roles, User } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
      role: Roles.READER,
    };

    it('should call usersService.create with the DTO', async () => {
      const created = makeUser({ ...dto, id: 'new-id' });
      usersService.create.mockResolvedValue(created);

      const result = await controller.create(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return all users from usersService', async () => {
      const users = [makeUser(), makeUser({ id: 'id-2', email: 'other@example.com' })];
      usersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('findOne', () => {
    it('should call usersService.findOne with the id', async () => {
      const user = makeUser();
      usersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne('user-id');

      expect(usersService.findOne).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(user);
    });
  });

  describe('update', () => {
    const dto: UpdateUserDto = { name: 'Updated Name' };

    it('should call usersService.update with id and DTO', async () => {
      const updated = makeUser({ name: 'Updated Name' });
      usersService.update.mockResolvedValue(updated);

      const result = await controller.update('user-id', dto);

      expect(usersService.update).toHaveBeenCalledWith('user-id', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call usersService.remove with the id', async () => {
      const deleted = makeUser();
      usersService.remove.mockResolvedValue(deleted);

      const result = await controller.remove('user-id');

      expect(usersService.remove).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(deleted);
    });
  });
});
