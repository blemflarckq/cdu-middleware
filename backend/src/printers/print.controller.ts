/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Post, Param, Get, Body } from '@nestjs/common';
import { PrintService } from './print.service';

@Controller('print')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Get('test/:printer')
  async testPrinter(@Param('printer') printer: 'tsc' | 'hp' | 'zebra') {
    const result = await this.printService.testPrinterConnection(printer);
    return { printer, connected: result };
  }

  @Post('bag-label')
  async printBagLabel(@Body() data: any) {
    const result = await this.printService.printBagLabel(data);
    return {
      success: result,
      message: result ? 'Bag label printed' : 'Print failed',
    };
  }

  @Post('box-label')
  async printBoxLabel(@Body() data: any) {
    const result = await this.printService.printBoxLabel(data);
    return {
      success: result,
      message: result ? 'Box label printed' : 'Print failed',
    };
  }

  @Post('manifest')
  async printManifest(@Body() data: any) {
    const result = await this.printService.printManifest(data);
    return {
      success: result,
      message: result ? 'Manifest printed' : 'Print failed',
    };
  }

  @Post('dispensing-slip')
  async printDispensingSlip(@Body() data: any) {
    const result = await this.printService.printDispensingSlip(data);
    return {
      success: result,
      message: result ? 'Dispensing slip printed' : 'Print failed',
    };
  }
}
