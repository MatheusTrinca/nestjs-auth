import { subject } from '@casl/ability';
import { Roles, User, Post } from '@prisma/client';
import { CaslAbilityService } from './casl-ability.service';

const makeUser = (override: Partial<User> = {}): User => ({
  id: 'user-id',
  name: 'Test User',
  email: 'test@example.com',
  password: 'hashed',
  role: Roles.READER,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const makePost = (override: Partial<Post> = {}): Post => ({
  id: 'post-id',
  title: 'Test Post',
  content: 'Test Content',
  published: true,
  authorId: 'user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

describe('CaslAbilityService', () => {
  let service: CaslAbilityService;

  beforeEach(() => {
    service = new CaslAbilityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ADMIN permissions', () => {
    const adminUser = makeUser({ id: 'admin-id', role: Roles.ADMIN });
    let ability: ReturnType<CaslAbilityService['createForUser']>;

    beforeEach(() => {
      ability = service.createForUser(adminUser);
    });

    it('can manage all resources', () => {
      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('can create users', () => {
      expect(ability.can('create', 'User')).toBe(true);
    });

    it('can read users', () => {
      expect(ability.can('read', 'User')).toBe(true);
    });

    it('can update users', () => {
      expect(ability.can('update', 'User')).toBe(true);
    });

    it('can delete users', () => {
      expect(ability.can('delete', 'User')).toBe(true);
    });

    it('can create posts', () => {
      expect(ability.can('create', 'Post')).toBe(true);
    });

    it('can read posts', () => {
      expect(ability.can('read', 'Post')).toBe(true);
    });

    it('can update posts', () => {
      expect(ability.can('update', 'Post')).toBe(true);
    });

    it('can delete posts', () => {
      expect(ability.can('delete', 'Post')).toBe(true);
    });

    it('stores the ability on the service after createForUser', () => {
      expect(service.ability).toBe(ability);
    });
  });

  describe('EDITOR permissions', () => {
    const editorUser = makeUser({ id: 'editor-id', role: Roles.EDITOR });
    let ability: ReturnType<CaslAbilityService['createForUser']>;

    beforeEach(() => {
      ability = service.createForUser(editorUser);
    });

    it('can create posts', () => {
      expect(ability.can('create', 'Post')).toBe(true);
    });

    it('can read any post', () => {
      expect(ability.can('read', 'Post')).toBe(true);
    });

    it('can update any post', () => {
      expect(ability.can('update', 'Post')).toBe(true);
    });

    it('cannot delete posts', () => {
      expect(ability.can('delete', 'Post')).toBe(false);
    });

    it('cannot create users', () => {
      expect(ability.can('create', 'User')).toBe(false);
    });

    it('cannot read users', () => {
      expect(ability.can('read', 'User')).toBe(false);
    });

    it('cannot update users', () => {
      expect(ability.can('update', 'User')).toBe(false);
    });

    it('cannot delete users', () => {
      expect(ability.can('delete', 'User')).toBe(false);
    });
  });

  describe('WRITER permissions', () => {
    const writerId = 'writer-user-id';
    const writerUser = makeUser({ id: writerId, role: Roles.WRITER });
    let ability: ReturnType<CaslAbilityService['createForUser']>;

    beforeEach(() => {
      ability = service.createForUser(writerUser);
    });

    it('can create posts', () => {
      expect(ability.can('create', 'Post')).toBe(true);
    });

    it('can read own posts', () => {
      const ownPost = makePost({ authorId: writerId });
      expect(ability.can('read', subject('Post', ownPost))).toBe(true);
    });

    it("cannot read other users' posts", () => {
      const otherPost = makePost({ authorId: 'another-user-id' });
      expect(ability.can('read', subject('Post', otherPost))).toBe(false);
    });

    it('can update own posts', () => {
      const ownPost = makePost({ authorId: writerId });
      expect(ability.can('update', subject('Post', ownPost))).toBe(true);
    });

    it("cannot update other users' posts", () => {
      const otherPost = makePost({ authorId: 'another-user-id' });
      expect(ability.can('update', subject('Post', otherPost))).toBe(false);
    });

    it('cannot delete posts', () => {
      expect(ability.can('delete', 'Post')).toBe(false);
    });

    it('cannot create users', () => {
      expect(ability.can('create', 'User')).toBe(false);
    });

    it('cannot read users', () => {
      expect(ability.can('read', 'User')).toBe(false);
    });
  });

  describe('READER permissions', () => {
    const readerUser = makeUser({ id: 'reader-id', role: Roles.READER });
    let ability: ReturnType<CaslAbilityService['createForUser']>;

    beforeEach(() => {
      ability = service.createForUser(readerUser);
    });

    it('can read published posts', () => {
      const publishedPost = makePost({ published: true });
      expect(ability.can('read', subject('Post', publishedPost))).toBe(true);
    });

    it('cannot read unpublished posts', () => {
      const unpublishedPost = makePost({ published: false });
      expect(ability.can('read', subject('Post', unpublishedPost))).toBe(false);
    });

    it('cannot create posts', () => {
      expect(ability.can('create', 'Post')).toBe(false);
    });

    it('cannot update posts', () => {
      expect(ability.can('update', 'Post')).toBe(false);
    });

    it('cannot delete posts', () => {
      expect(ability.can('delete', 'Post')).toBe(false);
    });

    it('cannot create users', () => {
      expect(ability.can('create', 'User')).toBe(false);
    });

    it('cannot read users', () => {
      expect(ability.can('read', 'User')).toBe(false);
    });
  });
});
