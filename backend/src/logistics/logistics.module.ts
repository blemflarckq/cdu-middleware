import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LogisticsService } from './logistics.service';
import { Box } from '../entities/box.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Box]), HttpModule],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
