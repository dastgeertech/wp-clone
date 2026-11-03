import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@wp-clone/shared-types';
import { CurrentUser, RequireCapability } from '../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @RequireCapability('list_users') @Get()
  list(@Query('page') page?: string, @Query('perPage') perPage?: string, @Query('role') role?: string) {
    return this.users.list(Number(page) || 1, Math.min(Number(perPage) || 20, 100), role);
  }

  @RequireCapability('list_users') @Get(':id')
  get(@Param('id') id: string) { return this.users.get(id); }

  @RequireCapability('edit_users') @Post()
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); }

  /** Self-edit allowed for any logged-in user; role/status need edit_users (enforced in service). */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor);
  }

  @RequireCapability('delete_users') @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) { return this.users.remove(id, actor); }
}
