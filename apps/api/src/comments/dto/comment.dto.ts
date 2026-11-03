import {
  IsEmail, IsOptional, IsString, IsUrl, MaxLength, MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString() @MinLength(1) postId: string;
  @IsOptional() @IsString() parentId?: string;
  @IsString() @MinLength(1) @MaxLength(60) authorName: string;
  @IsEmail() @MaxLength(200) authorEmail: string;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(200) authorUrl?: string;
  @IsString() @MinLength(1) @MaxLength(5000) content: string;
  /** Honeypot — filled by bots, must stay empty. */
  @IsOptional() @IsString() website?: string;
}

export class UpdateCommentDto {
  @IsOptional() status?: 'PENDING' | 'APPROVED' | 'SPAM' | 'TRASH';
}
