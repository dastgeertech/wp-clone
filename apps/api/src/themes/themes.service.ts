import {
  BadRequestException, Injectable, Logger, OnModuleInit,
} from '@nestjs/common';
import type { ThemeState } from '@wp-clone/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { BUILTIN_THEMES, defaultsFor } from './theme-definitions';

/**
 * Theme registry (Appearance → Themes / Customize).
 * Built-in themes are upserted on boot so a fresh DB always has them.
 */
@Injectable()
export class ThemesService implements OnModuleInit {
  private log = new Logger(ThemesService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const t of BUILTIN_THEMES) {
      const exists = await this.prisma.theme.findUnique({ where: { id: t.id } });
      if (!exists) {
        await this.prisma.theme.create({
          data: {
            id: t.id, name: t.name, version: t.version,
            author: t.author, description: t.description,
            manifest: t as never,
            settings: {
              create: Object.entries(defaultsFor(t)).map(([key, value]) => ({
                key, value: value as never,
              })),
            },
          },
        });
        this.log.log(`Registered theme "${t.name}"`);
      }
      // Exactly one active theme — first boot activates the classic one.
    }
    const active = await this.prisma.theme.findFirst({ where: { isActive: true } });
    if (!active) {
      await this.prisma.theme.update({
        where: { id: BUILTIN_THEMES[0].id }, data: { isActive: true },
      });
    }
  }

  async list(): Promise<ThemeState[]> {
    const themes = await this.prisma.theme.findMany({
      include: { settings: true }, orderBy: { name: 'asc' },
    });
    return themes.map((t) => this.toState(t));
  }

  async getActive(): Promise<ThemeState> {
    const t = await this.prisma.theme.findFirst({
      where: { isActive: true },
      include: { settings: true },
    });
    if (t) return this.toState(t);
    // Unreachable after onModuleInit, but never crash SSR.
    const fallback = await this.prisma.theme.findFirst({
      where: { id: BUILTIN_THEMES[0].id }, include: { settings: true },
    });
    if (!fallback) throw new BadRequestException('No theme installed');
    return this.toState(fallback);
  }

  async setActive(id: string): Promise<ThemeState[]> {
    const t = await this.prisma.theme.findUnique({ where: { id } });
    if (!t) throw new BadRequestException('Unknown theme');
    await this.prisma.$transaction([
      this.prisma.theme.updateMany({ data: { isActive: false } }),
      this.prisma.theme.update({ where: { id }, data: { isActive: true } }),
    ]);
    return this.list();
  }

  /** Partial settings update; keys are validated against the manifest schema. */
  async updateSettings(id: string, patch: Record<string, unknown>): Promise<ThemeState> {
    const t = await this.prisma.theme.findUnique({ where: { id } });
    if (!t) throw new BadRequestException('Unknown theme');
    const manifest = t.manifest as unknown as { settingsSchema?: { key: string }[] };
    const allowed = new Set(manifest.settingsSchema?.map((c) => c.key) ?? []);
    for (const key of Object.keys(patch)) {
      if (!allowed.has(key)) throw new BadRequestException(`Unknown setting "${key}"`);
    }
    for (const [key, value] of Object.entries(patch)) {
      await this.prisma.themeSetting.upsert({
        where: { themeId_key: { themeId: id, key } },
        update: { value: value as never },
        create: { themeId: id, key, value: value as never },
      });
    }
    const fresh = await this.prisma.theme.findUnique({
      where: { id }, include: { settings: true },
    });
    return this.toState(fresh!);
  }

  private toState(t: {
    id: string; name: string; version: string; author: string | null;
    description: string | null; isActive: boolean; manifest: unknown;
    settings: { key: string; value: unknown }[];
  }): ThemeState {
    const manifest = t.manifest as { screenshot?: string; authorUri?: string; settingsSchema: [] } | null;
    const schema = manifest?.settingsSchema ?? [];
    const settings: Record<string, unknown> = {};
    for (const c of schema) {
      const key = (c as unknown as { key: string; default: unknown }).key;
      const def = (c as unknown as { key: string; default: unknown }).default;
      settings[key] = def;
    }
    for (const s of t.settings) settings[s.key] = s.value;
    return {
      id: t.id, name: t.name, version: t.version, author: t.author,
      description: t.description, isActive: t.isActive,
      screenshot: manifest?.screenshot ?? null,
      authorUri: manifest?.authorUri ?? null,
      settingsSchema: schema as ThemeState['settingsSchema'],
      settings,
    };
  }
}
