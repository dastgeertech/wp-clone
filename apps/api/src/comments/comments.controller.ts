import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '@wp-clone/shared-types';
import { CurrentUser, Public, RequireCapability } from '../common/decorators';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

/** Public endpoints consumed by the SSR frontend. */
@Controller('comments')
export class CommentsController {
  constructor(private comments: CommentsService) {}

  @Public() @Get('post/:postId')
  forPost(@Param('postId') postId: string) {
    return this.comments.approvedForPost(postId);
  }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post()
  create(
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.comments.create(dto, req.ip ?? '0.0.0.0', user?.id);
  }

  /* ------------------------------ admin ------------------------------ */

  @RequireCapability('moderate_comments') @Get()
  list(
    @Query('status') status?: string,
    @Query('postId') postId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.comments.list({
      status: status as never, postId, search,
      page: Number(page) || 1, perPage: Math.min(Number(perPage) || 20, 100),
    });
  }

  @RequireCapability('moderate_comments') @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    if (!dto.status) return;
    return this.comments.setStatus(id, dto.status);
  }

  @RequireCapability('moderate_comments') @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string) { return this.comments.remove(id); }
}
