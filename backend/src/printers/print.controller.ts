// src/print/print.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
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

  @Get('test/:printer')
  async testPrinter(@Param('printer') printer: 'tsc' | 'hp') {
    const result = await this.printService.testPrinterConnection(printer);
    return { printer, connected: result };
  }

  @Post('test-label')
  async testLabel() {
    const testData = {
      type: 'bag' as const,
      barcode: 'TEST001',
      patientName: 'John',
      patientSurname: 'Doe',
      collectionDate: '10/26/2026',
      pickupPoint: 'Maseru Regional Hospital Collect&Go',
    };
    return await this.printService.printBagLabel(testData);
  }

  @Post('reprint-box-label/:boxId')
  async reprintBoxLabel(@Param('boxId') boxId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.printService.reprintBoxLabel(boxId);
  }
}
