import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const ROLES = ['ADMINISTRATOR', 'EDITOR', 'AUTHOR', 'CONTRIBUTOR', 'SUBSCRIBER'] as const;

export class CreateUserDto {
  @IsString() @Matches(/^[a-zA-Z0-9_.-]{3,40}$/) username: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
  @IsString() @MinLength(1) @MaxLength(80) displayName: string;
  @IsOptional() @IsIn(ROLES) role?: (typeof ROLES)[number];
}

export class UpdateUserDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) displayName?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
  /** admin-only */
  @IsOptional() @IsIn(ROLES) role?: (typeof ROLES)[number];
  /** admin-only */
  @IsOptional() @IsBoolean() isActive?: boolean;
}
