import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Public, RequireCapability } from '../common/decorators';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto';
import { TermsService } from './terms.service';

@Controller('terms')
export class TermsController {
  constructor(private terms: TermsService) {}

  @Public() @Get()
  list(@Query('taxonomy') taxonomy?: 'CATEGORY' | 'TAG') {
    return this.terms.list(taxonomy);
  }

  @RequireCapability('manage_categories') @Post()
  create(@Body() dto: CreateTermDto) { return this.terms.create(dto); }

  @RequireCapability('manage_categories') @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTermDto) { return this.terms.update(id, dto); }

  @RequireCapability('manage_categories') @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string) { return this.terms.remove(id); }
}
