import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional,
  IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

const STATUSES = ['DRAFT', 'PENDING', 'SCHEDULED', 'PUBLISHED', 'TRASH'] as const;
export type PostStatusName = (typeof STATUSES)[number];

export class CreatePostDto {
  @IsOptional() @IsIn(['POST', 'PAGE']) type?: 'POST' | 'PAGE';
  @IsString() @MinLength(1) @MaxLength(300) title: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) excerpt?: string;
  /** TipTap JSON document */
  @IsObject() content: Record<string, unknown>;
  @IsOptional() @IsIn(STATUSES) status?: PostStatusName;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsString() featuredImageId?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsIn(['OPEN', 'CLOSED']) commentStatus?: 'OPEN' | 'CLOSED';
  @IsOptional() @IsBoolean() isSticky?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) termIds?: string[];
  @IsOptional() @IsString() @MaxLength(70) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) seoDescription?: string;
  @IsOptional() @IsString() @MaxLength(500) canonicalUrl?: string;
  @IsOptional() @IsBoolean() noIndex?: boolean;
}

export class UpdatePostDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) excerpt?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsOptional() @IsIn(STATUSES) status?: PostStatusName;
  @IsOptional() @IsDateString() publishedAt?: string;
  @IsOptional() @IsString() featuredImageId?: string | null;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() template?: string;
  @IsOptional() @IsIn(['OPEN', 'CLOSED']) commentStatus?: 'OPEN' | 'CLOSED';
  @IsOptional() @IsBoolean() isSticky?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) termIds?: string[];
  @IsOptional() @IsString() @MaxLength(70) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) seoDescription?: string;
  @IsOptional() @IsString() @MaxLength(500) canonicalUrl?: string;
  @IsOptional() @IsBoolean() noIndex?: boolean;
}

export class ListPostsQuery {
  @IsOptional() @IsIn(['POST', 'PAGE']) type?: 'POST' | 'PAGE';
  @IsOptional() @IsIn(STATUSES) status?: PostStatusName;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) perPage?: number;
}
