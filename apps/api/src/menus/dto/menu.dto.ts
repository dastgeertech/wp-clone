import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class MenuItemDto {
  @IsString() @MaxLength(120) label: string;
  @IsOptional() @IsString() @MaxLength(500) url?: string;
  @IsOptional() @IsString() postId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  children?: MenuItemDto[];
}

export class MenuDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(60) location?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items?: MenuItemDto[];
}

export class UpdateMenuDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) location?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => MenuItemDto)
  items?: MenuItemDto[];
}
