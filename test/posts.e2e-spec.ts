import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import bcrypt from 'bcrypt';

describe('Posts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken: string;
  let editorToken: string;
  let writerToken: string;
  let readerToken: string;

  let adminId: string;
  let editorId: string;
  let writerId: string;
  let readerId: string;

  let sharedPostId: string;

  const seedUsers = [
    { name: 'E2E Admin Posts', email: 'e2e-admin-posts@test.com', password: 'admin123', role: 'ADMIN' as const },
    { name: 'E2E Editor Posts', email: 'e2e-editor-posts@test.com', password: 'editor123', role: 'EDITOR' as const },
    { name: 'E2E Writer Posts', email: 'e2e-writer-posts@test.com', password: 'writer123', role: 'WRITER' as const },
    { name: 'E2E Reader Posts', email: 'e2e-reader-posts@test.com', password: 'reader123', role: 'READER' as const },
  ];

  const getToken = async (email: string, password: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return response.body.access_token as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Seed all test users
    const [admin, editor, writer, reader] = await Promise.all(
      seedUsers.map((u) =>
        prisma.user.create({
          data: { ...u, password: bcrypt.hashSync(u.password, 10) },
        }),
      ),
    );
    adminId = admin.id;
    editorId = editor.id;
    writerId = writer.id;
    readerId = reader.id;

    // Get tokens
    [adminToken, editorToken, writerToken, readerToken] = await Promise.all([
      getToken(seedUsers[0].email, seedUsers[0].password),
      getToken(seedUsers[1].email, seedUsers[1].password),
      getToken(seedUsers[2].email, seedUsers[2].password),
      getToken(seedUsers[3].email, seedUsers[3].password),
    ]);

    // Create a shared post for read/update/delete tests
    const post = await prisma.post.create({
      data: { title: 'Shared Test Post', content: 'Content', published: true, authorId: editorId },
    });
    sharedPostId = post.id;
  });

  afterAll(async () => {
    const userIds = [adminId, editorId, writerId, readerId].filter(Boolean);
    if (userIds.length > 0) {
      // Clean up posts then users (foreign key constraint)
      await prisma.post.deleteMany({
        where: { authorId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await app?.close();
  });

  describe('GET /posts (findAll)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get('/posts').expect(401);
    });

    it('should return accessible posts for ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return accessible posts for EDITOR (all posts)', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return only published posts for READER', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All returned posts should be published
      (response.body as Array<{ published: boolean }>).forEach((post) => {
        expect(post.published).toBe(true);
      });
    });
  });

  describe('POST /posts (create)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/posts')
        .send({ title: 'Test', content: 'Content', published: false })
        .expect(401);
    });

    it('should create a post when EDITOR', async () => {
      const postDto = { title: 'Editor Post', content: 'Editor Content', published: false };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${editorToken}`)
        .send(postDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(postDto.title);
      expect(response.body.authorId).toBe(editorId);
    });

    it('should create a post when WRITER', async () => {
      const postDto = { title: 'Writer Post', content: 'Writer Content', published: false };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${writerToken}`)
        .send(postDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.authorId).toBe(writerId);
    });

    it('should create a post when ADMIN', async () => {
      const postDto = { title: 'Admin Post', content: 'Admin Content', published: true };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(postDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.authorId).toBe(adminId);
    });

    it('should return 403 when READER tries to create a post', async () => {
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ title: 'Unauthorized', content: 'Content', published: false })
        .expect(403);
    });
  });

  describe('GET /posts/:id (findOne)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer()).get(`/posts/${sharedPostId}`).expect(401);
    });

    it('should return post when ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(sharedPostId);
    });

    it('should return post when EDITOR', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(200);

      expect(response.body.id).toBe(sharedPostId);
    });

    it('should return published post when READER', async () => {
      // sharedPostId is published: true
      const response = await request(app.getHttpServer())
        .get(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(200);

      expect(response.body.id).toBe(sharedPostId);
    });

    it('should return 404 for non-existent post', async () => {
      await request(app.getHttpServer())
        .get('/posts/non-existent-id-12345')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 404 when READER tries to access unpublished post', async () => {
      // Create an unpublished post
      const unpublished = await prisma.post.create({
        data: { title: 'Unpublished', content: 'Content', published: false, authorId: editorId },
      });

      await request(app.getHttpServer())
        .get(`/posts/${unpublished.id}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(404);

      // Clean up
      await prisma.post.delete({ where: { id: unpublished.id } });
    });
  });

  describe('PATCH /posts/:id (update)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .patch(`/posts/${sharedPostId}`)
        .send({ title: 'Updated' })
        .expect(401);
    });

    it('should update post when ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Title' })
        .expect(200);

      expect(response.body.title).toBe('Admin Updated Title');
    });

    it('should update any post when EDITOR', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ title: 'Editor Updated Title' })
        .expect(200);

      expect(response.body.title).toBe('Editor Updated Title');
    });

    it('should update own post when WRITER', async () => {
      // Create a post owned by the writer
      const writerPost = await prisma.post.create({
        data: { title: 'Writer Own Post', content: 'Content', published: false, authorId: writerId },
      });

      const response = await request(app.getHttpServer())
        .patch(`/posts/${writerPost.id}`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ title: 'Writer Updated Own Post' })
        .expect(200);

      expect(response.body.title).toBe('Writer Updated Own Post');

      // Clean up
      await prisma.post.delete({ where: { id: writerPost.id } });
    });

    it("should return 403 when WRITER tries to update another author's post", async () => {
      // sharedPostId is authored by editorId, not writerId
      await request(app.getHttpServer())
        .patch(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${writerToken}`)
        .send({ title: 'Hacked' })
        .expect(403);
    });

    it('should return 403 when READER tries to update a post', async () => {
      await request(app.getHttpServer())
        .patch(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({ title: 'Hacked' })
        .expect(403);
    });
  });

  describe('DELETE /posts/:id (remove)', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${sharedPostId}`)
        .expect(401);
    });

    it('should return 403 when READER tries to delete a post', async () => {
      await request(app.getHttpServer())
        .delete(`/posts/${sharedPostId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .expect(403);
    });

    it('should delete own post when WRITER', async () => {
      const writerPost = await prisma.post.create({
        data: { title: 'To Delete', content: 'Content', published: false, authorId: writerId },
      });

      await request(app.getHttpServer())
        .delete(`/posts/${writerPost.id}`)
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      const found = await prisma.post.findUnique({ where: { id: writerPost.id } });
      expect(found).toBeNull();
    });

    it('should delete any post when ADMIN', async () => {
      const postToDelete = await prisma.post.create({
        data: { title: 'Admin Deletes This', content: 'Content', published: false, authorId: editorId },
      });

      await request(app.getHttpServer())
        .delete(`/posts/${postToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = await prisma.post.findUnique({ where: { id: postToDelete.id } });
      expect(found).toBeNull();
    });
  });
});
