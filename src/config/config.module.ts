import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app.config';

// Global so AppConfig can be injected in any module without re-importing here.
@Global()
@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class ConfigurationModule {}
