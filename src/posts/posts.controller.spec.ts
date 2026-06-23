import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Roles, User, Post } from '@prisma/client';
import { Request } from 'express';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { AuthGuard } from '../auth/auth.guard';
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

describe('PostsController', () => {
  let controller: PostsController;
  let postsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const mockRequest = {
    user: makeUser(),
  } as unknown as Request;

  beforeEach(async () => {
    postsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: postsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PostsController>(PostsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const dto: CreatePostDto = {
      title: 'New Post',
      content: 'Post Content',
      published: false,
    };

    it('should pass authorId from request.user to postsService.create', async () => {
      const created = makePost({ ...dto });
      postsService.create.mockResolvedValue(created);

      await controller.create(dto, mockRequest);

      expect(postsService.create).toHaveBeenCalledWith({
        ...dto,
        authorId: mockRequest.user!.id,
      });
    });

    it('should return the created post', async () => {
      const created = makePost(dto);
      postsService.create.mockResolvedValue(created);

      const result = await controller.create(dto, mockRequest);

      expect(result).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return all accessible posts from postsService', async () => {
      const posts = [makePost(), makePost({ id: 'post-2' })];
      postsService.findAll.mockResolvedValue(posts);

      const result = await controller.findAll();

      expect(postsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(posts);
    });
  });

  describe('findOne', () => {
    it('should return the post when found', async () => {
      const post = makePost();
      postsService.findOne.mockResolvedValue(post);

      const result = await controller.findOne('post-id');

      expect(postsService.findOne).toHaveBeenCalledWith('post-id');
      expect(result).toEqual(post);
    });

    it('should throw NotFoundException when post is not found', async () => {
      postsService.findOne.mockResolvedValue(null);

      await expect(controller.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      postsService.findOne.mockResolvedValue(null);

      await expect(controller.findOne('non-existent-id')).rejects.toThrow(
        'Post not found',
      );
    });
  });

  describe('update', () => {
    const dto: UpdatePostDto = { title: 'Updated Title', published: true };

    it('should call postsService.update with id and DTO', async () => {
      const updated = makePost({ title: 'Updated Title', published: true });
      postsService.update.mockResolvedValue(updated);

      const result = await controller.update('post-id', dto);

      expect(postsService.update).toHaveBeenCalledWith('post-id', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call postsService.remove with the id', async () => {
      const deleted = makePost();
      postsService.remove.mockResolvedValue(deleted);

      const result = await controller.remove('post-id');

      expect(postsService.remove).toHaveBeenCalledWith('post-id');
      expect(result).toEqual(deleted);
    });
  });
});
