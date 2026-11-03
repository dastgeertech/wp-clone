import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@wp-clone/shared-types';
import { memoryStorage } from 'multer';
import { CurrentUser, RequireCapability } from '../common/decorators';
import { MediaService } from './media.service';

const IMAGE_TYPES = /^image\/(jpeg|png|gif|webp|avif|svg\+xml)$/;

@Controller('media')
export class MediaController {
  constructor(private media: MediaService) {}

  @RequireCapability('upload_files') @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      cb(null, IMAGE_TYPES.test(file.mimetype)),
  }))
  upload(
    @UploadedFile() file?: Express.Multer.File,
    @CurrentUser() user?: AuthUser,
  ) {
    if (!file?.buffer?.length) {
      return Promise.reject(
        new Error('No image received (send multipart field "file")'),
      );
    }
    return this.media.upload(file, user!.id);
  }

  @RequireCapability('upload_files') @Get()
  list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
  ) {
    return this.media.list(
      Number(page) || 1, Math.min(Number(perPage) || 20, 100), search,
    );
  }

  @RequireCapability('upload_files') @Get(':id')
  get(@Param('id') id: string) { return this.media.get(id); }

  @RequireCapability('upload_files') @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { altText?: string; caption?: string },
  ) {
    return this.media.update(id, body);
  }

  @RequireCapability('upload_files') @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string) { return this.media.remove(id); }
}
