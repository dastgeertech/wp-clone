import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** username or email */
  @IsString() @MinLength(2) @MaxLength(254)
  identifier: string;

  @IsString() @MinLength(8) @MaxLength(128)
  password: string;
}
