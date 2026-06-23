import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import bcrypt from 'bcrypt';

type LoginResponse = { access_token: string };
type UserResponse = { id: string; name: string; email: string };

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let readerToken: string;

  const adminUser = {
    name: 'E2E Admin',
    email: 'e2e-admin-users@test.com',
    password: 'admin123',
    role: 'ADMIN' as const,
  };
  const readerUser = {
    name: 'E2E Reader',
    email: 'e2e-reader-users@test.com',
    password: 'reader123',
    role: 'READER' as const,
  };

  let adminId: string;
  let readerId: string;
  const createdUserIds: string[] = [];

  const getToken = async (email: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return (response.body as LoginResponse).access_token;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Seed users
    const [admin, reader] = await Promise.all([
      prisma.user.create({
        data: {
          ...adminUser,
          password: await bcrypt.hash(adminUser.password, 10),
        },
      }),
      prisma.user.create({
        data: {
          ...readerUser,
          password: await bcrypt.hash(readerUser.password, 10),
        },
      }),
    ]);
    adminId = admin.id;
    readerId = reader.id;

    // Get auth tokens
    [adminToken, readerToken] = await Promise.all([
      getToken(adminUser.email, adminUser.password),
      getToken(readerUser.email, readerUser.password),
    ]);
  });

  afterAll(async () => {
    const idsToDelete = [adminId, readerId, ...createdUserIds].filter(Boolean);
    if (idsToDelete.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
    await app?.close();
  });

  describe('GET /users (findAll)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should return 200 with users array when ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 403 when READER accesses user list', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(403);
    });
  });

  describe('POST /users (create)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Test',
          email: 'test@example.com',
          password: 'pass',
          role: 'READER',
        })
        .expect(401);
    });

    it('should create a user when ADMIN', async () => {
      const newUser = {
        name: 'E2E Created User',
        email: 'e2e-created@test.com',
        password: 'password123',
        role: 'READER',
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201);

      const created = response.body as UserResponse;
      expect(created).toHaveProperty('id');
      expect(created.email).toBe(newUser.email);
      expect(created.name).toBe(newUser.name);
      expect(response.body).not.toHaveProperty('password', newUser.password); // password should be hashed

      createdUserIds.push(created.id);
    });

    it('should return 403 when READER tries to create a user', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          name: 'Test',
          email: 'new@example.com',
          password: 'pass',
          role: 'READER',
        })
        .expect(403);
    });
  });

  describe('GET /users/:id (findOne)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get(`/users/${adminId}`).expect(401);
    });

    it('should return user by id when ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.id).toBe(adminId);
      expect(body.email).toBe(adminUser.email);
    });

    it('should return 403 when READER tries to get a user by id', async () => {
      await request(app.getHttpServer())
        .get(`/users/${adminId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(403);
    });
  });

  describe('PATCH /users/:id (update)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${readerId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should update user when ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/${readerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Reader Name' })
        .expect(200);

      expect((response.body as UserResponse).name).toBe('Updated Reader Name');
    });

    it('should return 403 when READER tries to update a user', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${adminId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  describe('DELETE /users/:id (remove)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${readerId}`)
        .expect(401);
    });

    it('should return 403 when READER tries to delete a user', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${adminId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(403);
    });

    it('should delete a user when ADMIN', async () => {
      // Create a temp user to delete
      const temp = await prisma.user.create({
        data: {
          name: 'Temp Delete User',
          email: 'e2e-temp-delete@test.com',
          password: await bcrypt.hash('pass', 10),
          role: 'READER',
        },
      });

      await request(app.getHttpServer())
        .delete(`/users/${temp.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify it's gone
      const found = await prisma.user.findUnique({ where: { id: temp.id } });
      expect(found).toBeNull();
    });
  });
});
