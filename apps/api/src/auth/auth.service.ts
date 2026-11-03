import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuthUser, ROLE_CAPABILITIES } from '@wp-clone/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  // Real hash so unknown users cost the same time as wrong passwords.
  private dummyHash = argon2.hash('timing-equalizer');

  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private toAuthUser(u: {
    id: string; username: string; email: string; displayName: string;
    role: AuthUser['role'];
  }): AuthUser {
    return {
      id: u.id, username: u.username, email: u.email,
      displayName: u.displayName, role: u.role,
      capabilities: [...ROLE_CAPABILITIES[u.role]],
    };
  }

  private signAccess(userId: string, role: string) {
    return this.jwt.signAsync(
      { sub: userId, role },
      {
        secret: process.env['JWT_ACCESS_SECRET'],
        expiresIn: (process.env['JWT_ACCESS_TTL'] ?? '15m') as never,
      },
    );
  }

  private async issueRefresh(userId: string, familyId: string = randomUUID()) {
    const token = randomBytes(48).toString('base64url');
    const days = Number(process.env['JWT_REFRESH_DAYS'] ?? 30);
    await this.prisma.refreshToken.create({
      data: {
        userId, familyId, tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + days * 86_400_000),
      },
    });
    return token;
  }

  async login(identifier: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
    });
    const ok = await argon2
      .verify(user?.passwordHash ?? (await this.dummyHash), password)
      .catch(() => false);
    if (!user || !user.isActive || !ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      accessToken: await this.signAccess(user.id, user.role),
      refreshToken: await this.issueRefresh(user.id),
      user: this.toAuthUser(user),
    };
  }

  /** Rotates the refresh token. Re-use of a rotated token revokes the family. */
  async refresh(rawToken?: string) {
    if (!rawToken) throw new UnauthorizedException();
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!row) throw new UnauthorizedException();
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }
    if (row.expiresAt < new Date() || !row.user.isActive) {
      throw new UnauthorizedException();
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id }, data: { revokedAt: new Date() },
    });
    return {
      accessToken: await this.signAccess(row.user.id, row.user.role),
      refreshToken: await this.issueRefresh(row.userId, row.familyId),
      user: this.toAuthUser(row.user),
    };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
