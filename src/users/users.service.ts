import bcrypt from 'bcrypt';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CaslAbilityService } from '../casl/casl-ability/casl-ability.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly abilityService: CaslAbilityService,
  ) {}

  create(createUserDto: CreateUserDto) {
    const ability = this.abilityService.ability;

    if (!ability.can('create', 'User')) {
      throw new ForbiddenException();
    }

    return this.prismaService.user.create({
      data: {
        ...createUserDto,
        password: bcrypt.hashSync(createUserDto.password, 10),
      },
    });
  }

  findAll() {
    const ability = this.abilityService.ability;

    if (!ability.can('read', 'User')) {
      throw new ForbiddenException();
    }

    return this.prismaService.user.findMany();
  }

  findOne(id: string) {
    const ability = this.abilityService.ability;

    if (!ability.can('read', 'User')) {
      throw new ForbiddenException();
    }

    return this.prismaService.user.findUnique({ where: { id } });
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    const ability = this.abilityService.ability;

    if (!ability.can('update', 'User')) {
      throw new ForbiddenException();
    }

    return this.prismaService.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  remove(id: string) {
    const ability = this.abilityService.ability;

    if (!ability.can('delete', 'User')) {
      throw new ForbiddenException();
    }

    return this.prismaService.user.delete({ where: { id } });
  }
}
