import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Public, RequireCapability } from '../common/decorators';
import { MenuDto, UpdateMenuDto } from './dto/menu.dto';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
  constructor(private menus: MenusService) {}

  /** The public site consumes menus by location (`primary`, `footer`, ...). */
  @Public() @Get()
  list(@Query('location') location?: string) { return this.menus.list(location); }

  @RequireCapability('edit_theme_options') @Get(':id')
  get(@Param('id') id: string) { return this.menus.get(id); }

  @RequireCapability('edit_theme_options') @Post()
  create(@Body() dto: MenuDto) { return this.menus.create(dto); }

  @RequireCapability('edit_theme_options') @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) { return this.menus.update(id, dto); }

  @RequireCapability('edit_theme_options') @Delete(':id') @HttpCode(204)
  remove(@Param('id') id: string) { return this.menus.remove(id); }
}
