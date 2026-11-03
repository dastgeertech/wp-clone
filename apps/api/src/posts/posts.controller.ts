import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '@wp-clone/shared-types';
import { CurrentUser, RequireCapability } from '../common/decorators';
import { CreatePostDto, ListPostsQuery, UpdatePostDto } from './dto/post.dto';
import { PostsService } from './posts.service';

/** Admin-facing endpoints. Public (SSR) read endpoints arrive with the web app. */
@Controller('posts')
export class PostsController {
  constructor(private posts: PostsService) {}

  // Per-type capability checks (posts vs pages) happen in the service.
  @RequireCapability('edit_posts') @Get()
  list(@Query() q: ListPostsQuery, @CurrentUser() u: AuthUser) { return this.posts.list(q, u); }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.posts.get(id, u); }

  @Post()
  create(@Body() dto: CreatePostDto, @CurrentUser() u: AuthUser) { return this.posts.create(dto, u); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto, @CurrentUser() u: AuthUser) {
    return this.posts.update(id, dto, u);
  }

  @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.posts.remove(id, u); }
}
