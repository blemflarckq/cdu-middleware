// src/print/print.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { PrintService } from './print.service';

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('bag-label')
  async printBagLabel(@Body() data: any) {
    await this.printService.printBagLabel(data);
    return { success: true, message: 'Bag label printed' };
  }

  @Post('box-label')
  async printBoxLabel(@Body() data: any) {
    await this.printService.printBoxLabel(data);
    return { success: true, message: 'Box label printed' };
  }

  @Post('manifest')
  async printManifest(@Body() data: any) {
    await this.printService.printManifest(data);
    return { success: true, message: 'Manifest printed' };
  }
}
