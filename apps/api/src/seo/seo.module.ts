import { Module } from '@nestjs/common';
import { OptionsModule } from '../options/options.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [OptionsModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
