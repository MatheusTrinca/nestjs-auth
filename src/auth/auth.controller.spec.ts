import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };

  beforeEach(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({ access_token: 'mock-token' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should call authService.login with the provided DTO', async () => {
      await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should return the access_token from authService', async () => {
      const result = await controller.login(loginDto);

      expect(result).toEqual({ access_token: 'mock-token' });
    });

    it('should propagate errors from authService', async () => {
      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
