/* eslint-disable prettier/prettier */
import { Controller, Post, Get, Param, Body, Patch, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ImportService } from './import.service';
import { PatientRecord } from '../entities/patient-record.entity';

@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * HANDLER 1: VALIDATE (Stage 1)
   * This is what ImportView.tsx calls when a file is dropped.
   * It transforms the CSV JSON into our domain logic (names, dates, phones).
   */
  @Post('validate')
  validate(@Body() body: { rows: any[] }) {
    // No 'await' because validateImport is synchronous in the service
    return this.importService.validateImport(body.rows);
  }

  /**
   * HANDLER 2: COMMIT (Stage 1 Completion)
   * This saves the validated/reviewed records to the DB.
   */
  @Post('commit')
  async commit(@Body() body: { records: any[] }) {
    return await this.importService.commitRecords(body.records);
  }

  /**
   * HANDLER 3: PENDING LIST
   * Powers the PatientTable (Stage 2)
   */
  @Get('pending')
  async getPending() {
    return await this.importService.findAllPending();
  }

  /**
   * HANDLER 4: MANUAL UPDATE
   * Powers the Pencil/Edit icon in the PatientTable
   */
  @Patch('update/:id')
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<PatientRecord>,
  ) {
    return await this.importService.updateRecord(id, updateData);
  }

  /**
   * HANDLER 5: BATCH CREATION (Stage 2 Completion)
   * Groups pending records into a named batch.
   */
  @Post('create-batch')
  async createBatch(@Body() body: { targetDate: string; batchName: string }) {
    return await this.importService.createBatch(
      body.targetDate,
      body.batchName,
    );
  }

  // --- LOGISTICS ENDPOINTS ---

  @Get('batches')
  async getBatches() {
    return await this.importService.getActiveBatches();
  }

  @Get('batch-records/:batchId')
  async getBatchRecords(@Param('batchId') batchId: string) {
    return await this.importService.getRecordsByBatch(batchId);
  }

  @Post('process-record/:id')
  async processRecord(@Param('id') id: string) {
    return await this.importService.processAndPrint(id);
  }

  // ✅ Fixed: Complete batch
  @Post('complete-batch/:batchId')
  async completeBatch(@Param('batchId') batchId: string) {
    return this.importService.completeBatch(batchId);
  }

  @Post('reprint/:recordId')
  async reprint(@Param('recordId') recordId: string) {
    return this.importService.reprintBagLabel(recordId);
  }

  @Post('scan-to-box')
  async scanToBox(@Body() body: { barcode: string }) {
    return await this.importService.scanBagToBox(body.barcode);
  }

  @Post('close/:boxId')
  async closeBox(@Param('boxId') boxId: string) {
    return await this.importService.closeBox(boxId);
  }
  @Get('boxes')
  async getAllBoxes() {
    return await this.importService.getAllBoxes();
  }

  // Get box by ID
@Get('boxes/:id')
async getBoxById(@Param('id') id: string) {
  const box = await this.importService.getBoxById(id);
  if (!box) {
    throw new NotFoundException(`Box with ID ${id} not found`);
  }
  return box;
}

// Get open box for location (or create one)
@Get('boxes/open')
  async getOpenBox(@Query('location') location: string) {
    if (!location) {
      throw new BadRequestException('Location is required');
    }
    return await this.importService.getOrCreateOpenBox(location);
  }
}
