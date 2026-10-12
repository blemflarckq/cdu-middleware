/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Controller, Post, Get, Patch, Body, Param } from '@nestjs/common';
import { ImportService } from './import.service';

@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('validate')
  async validate(@Body() body: { rows: any[] }) {
    return await this.importService.validateImport(body.rows);
  }

  @Post('commit')
  async commit(@Body() body: { records: any[] }) {
    return await this.importService.commitRecords(body.records);
  }

  @Get('pending')
  async getPending() {
    return await this.importService.findAllPending();
  }

  @Patch('update/:id')
  async updateRecord(@Param('id') id: string, @Body() updateData: any) {
    return await this.importService.updateRecord(id, updateData);
  }

  @Post('create-batch')
  async createBatch(
    @Body()
    body: {
      startDate: string;
      endDate: string;
      batchName: string;
      numberOfRepeats?: number;
      dosageInstructions?: string;
    },
  ) {
    return await this.importService.createBatch(
      body.startDate,
      body.endDate,
      body.batchName,
      body.numberOfRepeats || 1,
      body.dosageInstructions || '',
    );
  }

  @Get('batches')
  async getActiveBatches() {
    return await this.importService.getActiveBatches();
  }

  @Get('batches/completed')
  async getCompletedBatches() {
    return await this.importService.getCompletedBatches();
  }

  @Get('batches/all')
  async getAllBatches() {
    return await this.importService.getAllBatches();
  }

  @Get('batch-records/:batchId')
  async getBatchRecords(@Param('batchId') batchId: string) {
    return await this.importService.getRecordsByBatch(batchId);
  }

  @Post('process-record/:recordId')
  async processRecord(@Param('recordId') recordId: string) {
    return await this.importService.processAndPrint(recordId);
  }

  @Post('complete-batch/:batchId')
  async completeBatch(@Param('batchId') batchId: string) {
    return await this.importService.completeBatch(batchId);
  }

  @Post('reprint/:recordId')
  async reprint(@Param('recordId') recordId: string) {
    return await this.importService.reprintBagLabel(recordId);
  }

  // ==================== BOX ENDPOINTS ====================

  @Get('boxes')
  async getAllBoxes() {
    return await this.importService.getAllBoxes();
  }

  @Get('boxes/open/current')
  async getCurrentOpenBox() {
    return await this.importService.getCurrentOpenBox();
  }

  @Get('boxes/open/:pickupPointId')
  async getOpenBoxForPickupPoint(
    @Param('pickupPointId') pickupPointId: string,
  ) {
    return await this.importService.getOpenBoxForPickupPoint(pickupPointId);
  }

  @Get('boxes/:id')
  async getBoxById(@Param('id') id: string) {
    return await this.importService.getBoxById(id);
  }

  @Post('scan-to-box')
  async scanBagToBox(@Body() body: { bagBarcode: string }) {
    return await this.importService.scanBagToBox(body.bagBarcode);
  }

  @Post('close-box/:boxId')
  async closeBox(@Param('boxId') boxId: string) {
    return await this.importService.closeBox(boxId);
  }

  @Post('retry-send-box/:boxId')
  async retrySendBox(@Param('boxId') boxId: string) {
    return await this.importService.retrySendBox(boxId);
  }

  // 🔥 NEW: Print manifest endpoint
  @Post('print-manifest/:boxId')
  async printManifest(@Param('boxId') boxId: string) {
    return await this.importService.printBoxManifest(boxId);
  }

  // 🔥 NEW: Print dispensing slip endpoint (for reprint)
  @Post('print-dispensing-slip/:recordId')
  async printDispensingSlip(
    @Param('recordId') recordId: string,
    @Body() body: { bagBarcode: string },
  ) {
    return await this.importService.printDispensingSlip(
      recordId,
      body.bagBarcode,
    );
  }
  @Post('reprint-box-label/:boxId')
  async reprintBoxLabel(@Param('boxId') boxId: string) {
    return await this.importService.reprintBoxLabel(boxId);
  }

  // Reprint a manifest
  @Post('reprint-manifest/:boxId')
  async reprintManifest(@Param('boxId') boxId: string) {
    return await this.importService.printBoxManifest(boxId);
  }
}
