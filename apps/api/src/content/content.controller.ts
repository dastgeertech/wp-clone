import { Controller, Get, Param, Query } from '@nestjs/common';
import type { ArchiveQuery } from '@wp-clone/shared-types';
import { Public } from '../common/decorators';
import { ContentService } from './content.service';

const archiveQuery = (q: Record<string, string | undefined>): ArchiveQuery => ({
  page: Number(q['page']) || 1,
  perPage: q['perPage'] ? Number(q['perPage']) : undefined,
});

/** Public, read-only API consumed by the Angular SSR frontend. */
@Public()
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('bootstrap')
  bootstrap() { return this.content.bootstrap(); }

  @Get('home')
  home(@Query() q: Record<string, string | undefined>) {
    return this.content.home(archiveQuery(q));
  }

  @Get('posts')
  posts(@Query() q: Record<string, string | undefined>) {
    return this.content.posts(archiveQuery(q), {
      search: q['search'],
    });
  }

  @Get('pages')
  pages() { return this.content.pages(); }

  @Get('pages/:slug')
  page(@Param('slug') slug: string) { return this.content.page(slug); }

  @Get('posts/:slug')
  post(@Param('slug') slug: string) { return this.content.post(slug); }

  @Get('terms/:taxonomy/:slug')
  taxonomy(
    @Param('taxonomy') taxonomy: 'CATEGORY' | 'TAG',
    @Param('slug') slug: string,
    @Query() q: Record<string, string | undefined>,
  ) { return this.content.taxonomy(taxonomy, slug, archiveQuery(q)); }

  @Get('authors/:slug')
  author(
    @Param('slug') slug: string,
    @Query() q: Record<string, string | undefined>,
  ) { return this.content.author(slug, archiveQuery(q)); }

  @Get('search')
  search(
    @Query('q') term = '',
    @Query() q: Record<string, string | undefined>,
  ) { return this.content.search(term, archiveQuery(q)); }

  @Get('redirect')
  redirect(@Query('from') from?: string) {
    return this.content.redirect(from ?? '');
  }
}
