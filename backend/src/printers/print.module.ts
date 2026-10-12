import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintController } from './print.controller';

@Module({
  controllers: [PrintController],
  providers: [PrintService],
  exports: [PrintService], // 🔥 Export so ImportModule can use it
})
export class PrintModule {}
