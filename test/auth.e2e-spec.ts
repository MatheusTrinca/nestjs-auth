import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import bcrypt from 'bcrypt';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testUserId: string;

  const testUser = {
    name: 'E2E Test User',
    email: 'e2e-auth@test.com',
    password: 'testpassword123',
    role: 'ADMIN' as const,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Seed test user directly in the database
    const hashed = await bcrypt.hash(testUser.password, 10);
    const created = await prisma.user.create({
      data: {
        name: testUser.name,
        email: testUser.email,
        password: hashed,
        role: testUser.role,
      },
    });
    testUserId = created.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await app?.close();
  });

  describe('POST /auth/login', () => {
    it('should return 201 with access_token on valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(typeof response.body.access_token).toBe('string');
      expect(response.body.access_token.length).toBeGreaterThan(0);
    });

    it('should return a valid JWT structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const token = response.body.access_token as string;
      const parts = token.split('.');
      // JWT has 3 parts: header.payload.signature
      expect(parts).toHaveLength(3);
    });

    it('should return 500 when user does not exist', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'anypassword' })
        .expect(500);
    });

    it('should return 500 when password is incorrect', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' })
        .expect(500);
    });

    it('should return 400 or similar when body is empty', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({});

      expect([400, 500]).toContain(response.status);
    });
  });
});
