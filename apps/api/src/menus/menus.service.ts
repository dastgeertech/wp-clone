import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MenuDto as MenuDtoOut, MenuItemDto as MenuItemOut } from '@wp-clone/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { MenuDto, MenuItemDto, UpdateMenuDto } from './dto/menu.dto';

type ItemRow = {
  id: string; label: string; url: string | null; order: number;
  parentId: string | null; children: ItemRow[];
};

/** Nav menus (Appearance → Menus). Items support one level of nesting. */
@Injectable()
export class MenusService {
  constructor(private prisma: PrismaService) {}

  async list(location?: string): Promise<MenuDtoOut[]> {
    const menus = await this.prisma.menu.findMany({
      where: location ? { location } : {},
      include: { items: { include: { children: true } } },
      orderBy: { name: 'asc' },
    });
    return menus.map((m) => ({
      id: m.id,
      name: m.name,
      location: m.location,
      items: this.tree(
        m.items as unknown as (ItemRow & { parentId: string | null })[],
      ),
    }));
  }

  async get(id: string) {
    const m = await this.prisma.menu.findUnique({
      where: { id }, include: { items: true },
    });
    if (!m) throw new NotFoundException();
    return {
      id: m.id, name: m.name, location: m.location,
      items: this.tree(m.items as unknown as (ItemRow & { parentId: string | null })[]),
    };
  }

  async create(dto: MenuDto) {
    await this.assertLocationFree(dto.location);
    const menu = await this.prisma.menu.create({
      data: { name: dto.name, location: dto.location || null },
    });
    await this.writeItems(menu.id, dto.items ?? []);
    return this.get(menu.id);
  }

  async update(id: string, dto: UpdateMenuDto) {
    const menu = await this.prisma.menu.findUnique({ where: { id } });
    if (!menu) throw new NotFoundException();
    if (dto.location !== undefined) await this.assertLocationFree(dto.location, id);
    await this.prisma.menu.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.location !== undefined ? { location: dto.location || null } : {}),
      },
    });
    if (dto.items) {
      await this.prisma.menuItem.deleteMany({ where: { menuId: id } });
      await this.writeItems(id, dto.items);
    }
    return this.get(id);
  }

  async remove(id: string) {
    await this.prisma.menu.delete({ where: { id } }).catch(() => {
      throw new NotFoundException();
    });
  }

  private async assertLocationFree(location?: string | null, exceptId?: string) {
    if (!location) return;
    const clash = await this.prisma.menu.findFirst({
      where: { location, NOT: exceptId ? { id: exceptId } : undefined },
    });
    if (clash) throw new ConflictException(`Location "${location}" already assigned`);
  }

  private async writeItems(menuId: string, items: MenuItemDto[], parentId?: string) {
    for (const [i, item] of items.entries()) {
      const row = await this.prisma.menuItem.create({
        data: {
          menuId,
          parentId,
          label: item.label,
          url: item.url ?? null,
          postId: item.postId ?? null,
          order: item.order ?? i,
        },
      });
      if (item.children?.length) await this.writeItems(menuId, item.children, row.id);
    }
  }

  private tree(rows: (ItemRow & { parentId: string | null })[]): MenuItemOut[] {
    const roots = rows.filter((r) => !r.parentId).sort((a, b) => a.order - b.order);
    return roots.map((r) => ({
      id: r.id,
      label: r.label,
      url: r.url,
      order: r.order,
      children: rows
        .filter((c) => c.parentId === r.id)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ id: c.id, label: c.label, url: c.url, order: c.order, children: [] })),
    }));
  }
}
