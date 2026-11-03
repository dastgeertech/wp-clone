import { Body, Controller, Get, Put } from '@nestjs/common';
import { Public, RequireCapability } from '../common/decorators';
import { OptionsService } from './options.service';

@Controller('options')
export class OptionsController {
  constructor(private options: OptionsService) {}

  /** Public subset consumed by the SSR frontend. */
  @Public() @Get('public')
  publicOptions() { return this.options.publicOptions(); }

  @RequireCapability('manage_options') @Get()
  all() { return this.options.all(); }

  @RequireCapability('manage_options') @Put()
  set(@Body() body: Record<string, unknown>) { return this.options.set(body); }
}
