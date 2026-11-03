import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthUser, roleCan } from '@wp-clone/shared-types';
import { slugify, uniqueSlug } from '../common/util/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const SAFE = {
  id: true, username: true, email: true, displayName: true, slug: true,
  bio: true, role: true, isActive: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(page = 1, perPage = 20, role?: string) {
    const where = role ? { role: role as never } : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where, select: SAFE, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, perPage };
  }

  async get(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: SAFE });
    if (!u) throw new NotFoundException();
    return u;
  }

  async create(dto: CreateUserDto) {
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email.toLowerCase() }] },
    });
    if (taken) throw new ConflictException('Username or email already in use');
    const slug = await uniqueSlug(slugify(dto.username), async (s) =>
      !!(await this.prisma.user.findUnique({ where: { slug: s } })),
    );
    return this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email.toLowerCase(),
        passwordHash: await argon2.hash(dto.password),
        displayName: dto.displayName,
        role: dto.role ?? 'SUBSCRIBER',
        slug,
      },
      select: SAFE,
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const isSelf = actor.id === id;
    const canEditUsers = roleCan(actor.role, 'edit_users');
    if (!isSelf && !canEditUsers) throw new ForbiddenException();
    if ((dto.role !== undefined || dto.isActive !== undefined) && !canEditUsers) {
      throw new ForbiddenException('Only administrators can change role or status');
    }
    if (isSelf && (dto.role !== undefined || dto.isActive === false)) {
      throw new BadRequestException('You cannot change your own role or deactivate yourself');
    }
    await this.get(id);
    const { password, email, ...rest } = dto;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(password ? { passwordHash: await argon2.hash(password) } : {}),
      },
      select: SAFE,
    });
  }

  /** Content of the deleted user is reassigned to the acting admin (WordPress behaviour). */
  async remove(id: string, actor: AuthUser) {
    if (id === actor.id) throw new BadRequestException('You cannot delete yourself');
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.post.updateMany({ where: { authorId: id }, data: { authorId: actor.id } }),
      this.prisma.postRevision.updateMany({ where: { authorId: id }, data: { authorId: actor.id } }),
      this.prisma.media.updateMany({ where: { uploaderId: id }, data: { uploaderId: actor.id } }),
      this.prisma.comment.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
  }
}
