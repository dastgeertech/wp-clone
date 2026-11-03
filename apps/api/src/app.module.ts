import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CapabilitiesGuard } from './common/guards/capabilities.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CommentsModule } from './comments/comments.module';
import { ContentModule } from './content/content.module';
import { MediaModule } from './media/media.module';
import { MenusModule } from './menus/menus.module';
import { OptionsModule } from './options/options.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { SeoModule } from './seo/seo.module';
import { TermsModule } from './terms/terms.module';
import { ThemesModule } from './themes/themes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Generous global limit: the SSR server and crawlers share one IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    TermsModule,
    PostsModule,
    CommentsModule,
    MediaModule,
    MenusModule,
    OptionsModule,
    ThemesModule,
    ContentModule,
    SeoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CapabilitiesGuard },
  ],
})
export class AppModule {}
