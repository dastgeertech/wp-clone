import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public, RequireCapability } from '../common/decorators';
import { ThemesService } from './themes.service';

@Controller('themes')
export class ThemesController {
  constructor(private themes: ThemesService) {}

  /** The SSR frontend renders whatever theme is active. */
  @Public() @Get('active')
  active() { return this.themes.getActive(); }

  @RequireCapability('switch_themes') @Get()
  list() { return this.themes.list(); }

  @RequireCapability('switch_themes') @Post(':id/activate')
  activate(@Param('id') id: string) { return this.themes.setActive(id); }

  @RequireCapability('edit_theme_options') @Patch(':id/settings')
  updateSettings(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.themes.updateSettings(id, body);
  }
}
