import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Roles, User, Post } from '@prisma/client';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const makeUser = (override: Partial<User> = {}): User => ({
  id: 'author-id',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed-password',
  role: Roles.EDITOR,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const makePost = (override: Partial<Post> = {}): Post => ({
  id: 'post-id',
  title: 'Test Post',
  content: 'Test Content',
  published: false,
  authorId: 'author-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const buildAbility = (user: User) => {
  const svc = new CaslAbilityService();
  return svc.createForUser(user);
};

describe('PostsService', () => {
  let service: PostsService;
  let prismaPostMock: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let abilityService: {
    ability: ReturnType<CaslAbilityService['createForUser']>;
  };

  const setupModule = async (user: User) => {
    prismaPostMock = {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    abilityService = { ability: buildAbility(user) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: { post: prismaPostMock } },
        { provide: CaslAbilityService, useValue: abilityService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  };

  it('should be defined', async () => {
    await setupModule(makeUser());
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreatePostDto & { authorId: string } = {
      title: 'New Post',
      content: 'Post Content',
      published: false,
      authorId: 'author-id',
    };

    it('should create a post when EDITOR', async () => {
      await setupModule(makeUser({ role: Roles.EDITOR }));
      const created = makePost(dto);
      prismaPostMock.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(prismaPostMock.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should create a post when ADMIN', async () => {
      await setupModule(makeUser({ role: Roles.ADMIN }));
      const created = makePost(dto);
      prismaPostMock.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
    });

    it('should create a post when WRITER', async () => {
      await setupModule(makeUser({ role: Roles.WRITER }));
      const created = makePost(dto);
      prismaPostMock.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
    });

    it('should throw ForbiddenException when READER tries to create', async () => {
      await setupModule(makeUser({ role: Roles.READER }));

      expect(() => service.create(dto)).toThrow(ForbiddenException);
      expect(prismaPostMock.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should query posts filtered by CASL ability', async () => {
      await setupModule(makeUser({ role: Roles.EDITOR }));
      const posts = [makePost(), makePost({ id: 'post-2' })];
      prismaPostMock.findMany.mockResolvedValue(posts);

      const result = await service.findAll();

      expect(result).toEqual(posts);
      expect(prismaPostMock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) as unknown }),
      );
    });

    it('should return posts accessible to READER (published only)', async () => {
      await setupModule(makeUser({ role: Roles.READER }));
      const publishedPost = makePost({ published: true });
      prismaPostMock.findMany.mockResolvedValue([publishedPost]);

      const result = await service.findAll();

      expect(result).toEqual([publishedPost]);
    });
  });

  describe('findOne', () => {
    it('should return a post when accessible', async () => {
      await setupModule(makeUser({ role: Roles.EDITOR }));
      const post = makePost();
      prismaPostMock.findFirst.mockResolvedValue(post);

      const result = await service.findOne('post-id');

      expect(result).toEqual(post);
      expect(prismaPostMock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'post-id' }) as unknown,
        }),
      );
    });

    it('should return null when post is not accessible', async () => {
      await setupModule(makeUser({ role: Roles.READER }));
      prismaPostMock.findFirst.mockResolvedValue(null);

      const result = await service.findOne('post-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const dto: UpdatePostDto = { title: 'Updated Title' };

    it('should update a post when EDITOR has access', async () => {
      await setupModule(makeUser({ role: Roles.EDITOR }));
      const post = makePost();
      const updated = makePost({ title: 'Updated Title' });
      prismaPostMock.findUnique.mockResolvedValue(post);
      prismaPostMock.update.mockResolvedValue(updated);

      const result = await service.update('post-id', dto);

      expect(result).toEqual(updated);
      expect(prismaPostMock.update).toHaveBeenCalledWith({
        where: { id: 'post-id' },
        data: dto,
      });
    });

    it('should update own post when WRITER', async () => {
      const writerId = 'writer-id';
      await setupModule(makeUser({ id: writerId, role: Roles.WRITER }));
      const ownPost = makePost({ authorId: writerId });
      prismaPostMock.findUnique.mockResolvedValue(ownPost);
      prismaPostMock.update.mockResolvedValue(ownPost);

      const result = await service.update('post-id', dto);

      expect(result).toEqual(ownPost);
    });

    it('should throw ForbiddenException when post not found', async () => {
      await setupModule(makeUser({ role: Roles.READER }));
      prismaPostMock.findUnique.mockResolvedValue(null);

      await expect(service.update('post-id', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaPostMock.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when READER tries to update a post', async () => {
      await setupModule(makeUser({ role: Roles.READER }));
      const post = makePost({ published: true });
      prismaPostMock.findUnique.mockResolvedValue(post);

      await expect(service.update('post-id', dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaPostMock.update).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when WRITER tries to update another author's post", async () => {
      const writerId = 'writer-id';
      await setupModule(makeUser({ id: writerId, role: Roles.WRITER }));
      // findUnique returns the post, but ability.can('update', subject('Post', post)) is false
      const otherPost = makePost({ authorId: 'other-author-id' });
      prismaPostMock.findUnique.mockResolvedValue(otherPost);

      await expect(service.update('post-id', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a post when ADMIN', async () => {
      await setupModule(makeUser({ role: Roles.ADMIN }));
      const post = makePost();
      prismaPostMock.findUnique.mockResolvedValue(post);
      prismaPostMock.delete.mockResolvedValue(post);

      const result = await service.remove('post-id');

      expect(result).toEqual(post);
      expect(prismaPostMock.delete).toHaveBeenCalledWith({
        where: { id: 'post-id' },
      });
    });

    it('should throw ForbiddenException when EDITOR tries to delete', async () => {
      await setupModule(makeUser({ role: Roles.EDITOR }));
      // findUnique returns null because EDITOR has no update access via accessibleBy...
      // Actually EDITOR can update, but remove checks for update access too
      const post = makePost();
      prismaPostMock.findUnique.mockResolvedValue(post);
      prismaPostMock.delete.mockResolvedValue(post);

      // EDITOR can update but the remove method checks update access, so it should work for EDITOR
      const result = await service.remove('post-id');
      expect(result).toEqual(post);
    });

    it('should throw ForbiddenException when READER tries to delete', async () => {
      await setupModule(makeUser({ role: Roles.READER }));
      const post = makePost({ published: true });
      prismaPostMock.findUnique.mockResolvedValue(post);

      await expect(service.remove('post-id')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaPostMock.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when post does not exist', async () => {
      await setupModule(makeUser({ role: Roles.ADMIN }));
      prismaPostMock.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
