import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';
import { accessibleBy } from '@casl/prisma';

@Injectable()
export class PostsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly abilityService: CaslAbilityService,
  ) {}

  create(createPostDto: CreatePostDto & { authorId: string }) {
    const ability = this.abilityService.ability;

    if (!ability.can('create', 'Post')) {
      throw new ForbiddenException();
    }

    return this.prismaService.post.create({
      data: createPostDto,
    });
  }

  findAll() {
    const ability = this.abilityService.ability;

    return this.prismaService.post.findMany({
      where: {
        AND: [accessibleBy(ability, 'read').ofType('Post')],
      },
    });
  }

  findOne(id: string) {
    const ability = this.abilityService.ability;

    return this.prismaService.post.findUnique({
      where: { id, AND: [accessibleBy(ability, 'read').ofType('Post')] },
    });
  }

  async update(id: string, updatePostDto: UpdatePostDto) {
    const ability = this.abilityService.ability;

    const post = await this.prismaService.post.findUnique({
      where: { id, AND: [accessibleBy(ability, 'update').ofType('Post')] },
    });

    if (!post) {
      throw new ForbiddenException('Unauthorized');
    }

    return this.prismaService.post.update({
      where: { id },
      data: updatePostDto,
    });
  }

  async remove(id: string) {
    const ability = this.abilityService.ability;

    const post = await this.prismaService.post.findUnique({
      where: { id, AND: [accessibleBy(ability, 'update').ofType('Post')] },
    });

    if (!post) {
      throw new ForbiddenException('Unauthorized');
    }

    return this.prismaService.post.delete({ where: { id } });
  }
}
