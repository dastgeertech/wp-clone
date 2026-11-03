import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators';
import { SeoService } from './seo.service';

/** Consumed by the web SSR server, which re-serves these at the site root. */
@Public()
@Controller('seo')
export class SeoController {
  constructor(private seo: SeoService) {}

  @Get('sitemap') @Header('Content-Type', 'application/xml; charset=utf-8')
  sitemap() { return this.seo.sitemap(); }

  @Get('robots') @Header('Content-Type', 'text/plain; charset=utf-8')
  robots() { return this.seo.robots(); }
}
