import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { slugify, uniqueSlug } from '../common/util/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';

@Injectable()
export class TermsService {
  constructor(private prisma: PrismaService) {}

  list(taxonomy?: 'CATEGORY' | 'TAG') {
    return this.prisma.term.findMany({
      where: taxonomy ? { taxonomy } : {},
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateTermDto) {
    const base = slugify(dto.slug ?? dto.name);
    const slug = await uniqueSlug(base, async (s) =>
      !!(await this.prisma.term.findUnique({
        where: { taxonomy_slug: { taxonomy: dto.taxonomy, slug: s } },
      })),
    );
    return this.prisma.term.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: UpdateTermDto) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException();
    if (dto.parentId === id) throw new ConflictException('Term cannot be its own parent');
    const data: Record<string, unknown> = { ...dto };
    if (dto.slug) {
      const slug = slugify(dto.slug);
      const clash = await this.prisma.term.findFirst({
        where: { taxonomy: term.taxonomy, slug, NOT: { id } },
      });
      if (clash) throw new ConflictException('Slug already in use');
      data['slug'] = slug;
    }
    return this.prisma.term.update({ where: { id }, data });
  }

  async remove(id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException();
    await this.prisma.term.updateMany({ where: { parentId: id }, data: { parentId: term.parentId } });
    await this.prisma.term.delete({ where: { id } });
  }
}
