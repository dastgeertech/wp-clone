import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability, roleCan } from '@wp-clone/shared-types';
import { CAPABILITIES } from '../decorators';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(
      CAPABILITIES,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !required.every((c) => roleCan(user.role, c))) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
