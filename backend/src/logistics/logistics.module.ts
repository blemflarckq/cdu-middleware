import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogisticsService } from './logistics.service';

@Module({
  imports: [HttpModule],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
