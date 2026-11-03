import { Module } from '@nestjs/common';
import { MenusModule } from '../menus/menus.module';
import { OptionsModule } from '../options/options.module';
import { ThemesModule } from '../themes/themes.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [OptionsModule, ThemesModule, MenusModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
