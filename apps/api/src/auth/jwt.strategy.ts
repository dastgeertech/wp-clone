import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, ROLE_CAPABILITIES, RoleName } from '@wp-clone/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env['JWT_ACCESS_SECRET'] as string,
      ignoreExpiration: false,
    });
  }

  /** Re-reads the user so role changes / deactivation apply immediately. */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!u || !u.isActive) throw new UnauthorizedException();
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      capabilities: [...ROLE_CAPABILITIES[u.role as RoleName]],
    };
  }
}
