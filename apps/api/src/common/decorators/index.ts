import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AuthUser, Capability } from '@wp-clone/shared-types';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const CAPABILITIES = 'capabilities';
/** User must have ALL listed capabilities. */
export const RequireCapability = (...caps: Capability[]) =>
  SetMetadata(CAPABILITIES, caps);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
