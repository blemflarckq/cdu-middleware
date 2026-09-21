/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between } from 'typeorm';
import { PatientRecord } from '../entities/patient-record.entity';
import { DispensingBatch } from '../entities/dispensing-batch.entity';
import { Bag } from '../entities/bag.entity';
import { Box } from '../entities/box.entity';
import { differenceInDays, subDays, isValid } from 'date-fns';
import { PrintService } from '../printers/print.service';
import { LocationService } from '../admin/location.service';
import { RegimenService } from '../admin/regimen.service';
import { DrugPickupPointService } from '../admin/drug-pickup-point.service';
import { LogisticsService } from '../logistics/logistics.service';

export interface ImportError {
  line: number;
  name: string;
  missing: string[];
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private logisticsService: LogisticsService,

    @InjectRepository(PatientRecord)
    private patientRepo: Repository<PatientRecord>,

    @InjectRepository(DispensingBatch)
    private batchRepo: Repository<DispensingBatch>,

    @InjectRepository(Bag)
    private bagRepo: Repository<Bag>,

    @InjectRepository(Box)
    private boxRepo: Repository<Box>,

    private printService: PrintService,
    private locationService: LocationService,
    private regimenService: RegimenService,
    private pickupPointService: DrugPickupPointService,
  ) {}

  /**
   * Parse Excel date values (serial numbers) or string dates
   */
  private parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // If it's already a Date object
    if (value instanceof Date) {
      return isValid(value) ? value : null;
    }

    // If it's a number (Excel serial date)
    if (typeof value === 'number') {
      // Excel dates start from 1900-01-01 (serial 1)
      // But Excel incorrectly treats 1900 as leap year, so we need to adjust
      const excelEpoch = new Date(1899, 11, 30); // 1899-12-30
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return isValid(date) ? date : null;
    }

    // If it's a string, try to parse it
    if (typeof value === 'string') {
      // Try standard date parsing
      const date = new Date(value);
      if (isValid(date)) return date;

      // Try DD/MM/YYYY format
      // eslint-disable-next-line no-useless-escape
      const parts = value.split(/[\/\-.]/);
      if (parts.length === 3) {
        // Try DD/MM/YYYY
        let d = new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0]),
        );
        if (isValid(d)) return d;
        // Try MM/DD/YYYY
        d = new Date(
          parseInt(parts[2]),
          parseInt(parts[0]) - 1,
          parseInt(parts[1]),
        );
        if (isValid(d)) return d;
        // Try YYYY/MM/DD
        d = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
        if (isValid(d)) return d;
      }
    }

    return null;
  }

  /**
   * Logic for Step 1: Parsing and Validation
   */
  async validateImport(rows: any[]) {
    console.log('========== FULL DATA DUMP ==========');
    console.log(`Total rows received: ${rows.length}`);
    console.log('=====================================');

    // STEP 1: Find the header row
    let headerRowIndex = -1;
    let dataStartIndex = -1;

    const mandatoryFields = [
      'Patient Name',
      'Prescription Date',
      'Regimen Prescribed',
      'Next Clinical Appointment Date',
      'Drug Pickup Point',
      'Primary Contact',
      'Location',
    ];

    // Find headers
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row)) continue;

      const matches = mandatoryFields.filter((field) =>
        row.some(
          (cell) =>
            cell &&
            typeof cell === 'string' &&
            cell.toLowerCase().includes(field.toLowerCase()),
        ),
      );

      if (matches.length >= 3) {
        headerRowIndex = i;
        dataStartIndex = i + 1;
        console.log(`✓ Found headers at row ${i}:`, row);
        break;
      }
    }

    // Fallback header detection
    if (headerRowIndex === -1) {
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (row && Array.isArray(row)) {
          const nonEmptyCount = row.filter(
            (cell) => cell && cell.toString().trim(),
          ).length;
          if (nonEmptyCount >= 5) {
            headerRowIndex = i;
            dataStartIndex = i + 1;
            console.log(`⚠ Found potential headers at row ${i}:`, row);
            break;
          }
        }
      }
    }

    // Final fallback
    if (headerRowIndex === -1) {
      headerRowIndex = 5;
      dataStartIndex = 6;
      console.log(
        `⚠ No headers detected, using fallback: headers at row ${headerRowIndex}, data at row ${dataStartIndex}`,
      );
    }

    // STEP 2: Extract metadata
    const metadata: any = {
      reportName: 'Unknown Report',
      reportDateRange: 'Unknown Range',
      reportGenerationDate: 'Unknown Date',
    };

    for (let i = 0; i < headerRowIndex; i++) {
      const value = rows[i]?.[1]?.toString();
      if (!value) continue;

      if (value.includes('Prescriptions') || value.includes('List')) {
        metadata.reportName = value;
      } else if (value.includes('From') && value.includes('to')) {
        metadata.reportDateRange = value;
      } else if (value.includes('Generated On')) {
        metadata.reportGenerationDate = value;
      }
    }

    console.log('Metadata detected:', metadata);

    // STEP 3: Extract headers
    const headers = rows[headerRowIndex];
    const columnMap: { [key: string]: number } = {};

    headers.forEach((header: string, idx: number) => {
      if (header && typeof header === 'string') {
        const normalized = header.trim().toLowerCase();
        columnMap[header.trim()] = idx;
        columnMap[normalized] = idx;
      }
    });

    const findColumn = (possibleNames: string[]): number | null => {
      for (const name of possibleNames) {
        if (columnMap[name] !== undefined) return columnMap[name];
        if (columnMap[name.toLowerCase()] !== undefined)
          return columnMap[name.toLowerCase()];
        for (const key of Object.keys(columnMap)) {
          if (
            key.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(key.toLowerCase())
          ) {
            return columnMap[key];
          }
        }
      }
      return null;
    };

    const staged: any[] = [];
    const errors: ImportError[] = [];

    // 🔧 STEP 4: Pre-load all pickup points for matching
    const allPickupPoints = await this.pickupPointService.getAllPickupPoints();
    console.log(
      `📦 Loaded ${allPickupPoints.length} pickup points for matching`,
    );

    // STEP 5: Process data rows
    for (let i = dataStartIndex; i < rows.length; i++) {
      const rowArray = rows[i];
      if (!rowArray || !Array.isArray(rowArray)) continue;

      const hasData = rowArray.some((cell) => cell && cell.toString().trim());
      if (!hasData) continue;

      // Find column indices
      const patientNameIdx = findColumn([
        'Patient Name',
        'Patient',
        'Name',
        'Full Name',
      ]);
      const prescriptionDateIdx = findColumn([
        'Prescription Date',
        'Prescription',
        'Rx Date',
      ]);
      const regimenIdx = findColumn([
        'Regimen Prescribed',
        'Regimen',
        'Prescribed Regimen',
      ]);
      const appointmentDateIdx = findColumn([
        'Next Clinical Appointment Date',
        'Appointment Date',
        'Next Appointment',
        'Clinical Appointment',
      ]);
      const pickupPointIdx = findColumn([
        'Drug Pickup Point',
        'Pickup Point',
        'Drug Pickup',
        'Pickup Location',
      ]);
      const primaryContactIdx = findColumn([
        'Primary Contact',
        'Contact',
        'Phone',
        'Mobile',
        'Primary Phone',
      ]);
      const locationIdx = findColumn([
        'Location',
        'Facility',
        'Site',
        'Clinic',
      ]);
      const patientIdIdx = findColumn([
        'HIV Program ID',
        'Program ID',
        'HIV ID',
        'Patient ID',
        'ID',
      ]);
      const genderIdx = findColumn(['Gender', 'Sex']);
      const addressIdx = findColumn([
        'Address',
        'Physical Address',
        'Home Address',
      ]);
      const nextPickupDateIdx = findColumn([
        'Next Drug Pickup Date',
        'Next Pickup Date',
        'Pickup Date',
        'Drug Pickup Date',
      ]);

      // Check mandatory fields
      const missing: string[] = [];
      if (
        patientNameIdx === null ||
        !rowArray[patientNameIdx] ||
        rowArray[patientNameIdx].toString().trim() === ''
      )
        missing.push('Patient Name');
      if (prescriptionDateIdx === null || !rowArray[prescriptionDateIdx])
        missing.push('Prescription Date');
      else {
        const dateValue = this.parseExcelDate(rowArray[prescriptionDateIdx]);
        if (!dateValue) missing.push('Prescription Date (invalid format)');
      }
      if (
        regimenIdx === null ||
        !rowArray[regimenIdx] ||
        rowArray[regimenIdx].toString().trim() === ''
      )
        missing.push('Regimen Prescribed');
      if (appointmentDateIdx === null || !rowArray[appointmentDateIdx])
        missing.push('Next Clinical Appointment Date');
      else {
        const dateValue = this.parseExcelDate(rowArray[appointmentDateIdx]);
        if (!dateValue)
          missing.push('Next Clinical Appointment Date (invalid format)');
      }

      // Drug Pickup Point - store the name for later matching in commitRecords
      const pickupPointName =
        pickupPointIdx !== null && rowArray[pickupPointIdx] !== undefined
          ? rowArray[pickupPointIdx].toString().trim()
          : null;

      if (!pickupPointName || pickupPointName === '') {
        missing.push('Drug Pickup Point');
      }
      // We'll do the actual matching in commitRecords where we can use async/await

      if (
        primaryContactIdx === null ||
        !rowArray[primaryContactIdx] ||
        rowArray[primaryContactIdx].toString().trim() === ''
      )
        missing.push('Primary Contact');
      if (
        locationIdx === null ||
        !rowArray[locationIdx] ||
        rowArray[locationIdx].toString().trim() === ''
      )
        missing.push('Location');

      if (missing.length > 0) {
        errors.push({
          line: i + 1,
          name:
            patientNameIdx !== null
              ? rowArray[patientNameIdx].toString()
              : 'Unknown',
          missing,
        });
        continue;
      }

      // Extract values
      const fullName = rowArray[patientNameIdx!].toString().trim();
      const nameParts = fullName.split(' ');
      const lastName = nameParts.length > 1 ? nameParts.pop() : 'Unknown';
      const firstName = nameParts.join(' ');

      const phoneRaw = rowArray[primaryContactIdx!]?.toString() || '';
      const cleanPhone = phoneRaw.replace(/\D/g, '');
      const primaryContact = cleanPhone ? `+266${cleanPhone}` : '';

      const pDate = this.parseExcelDate(rowArray[prescriptionDateIdx!]);
      const aDate = this.parseExcelDate(rowArray[appointmentDateIdx!]);
      let pickupDate =
        nextPickupDateIdx !== null && rowArray[nextPickupDateIdx]
          ? this.parseExcelDate(rowArray[nextPickupDateIdx])
          : null;

      if (!pDate || !aDate) {
        errors.push({
          line: i + 1,
          name: fullName || 'Unknown',
          missing: ['Invalid date format'],
        });
        continue;
      }

      if (!pickupDate || !isValid(pickupDate)) {
        const diff = differenceInDays(aDate, pDate);
        const roundedDiff = Math.round(diff / 30) * 30;

        if (roundedDiff === 180) pickupDate = subDays(aDate, 90);
        else if (roundedDiff === 360) pickupDate = subDays(aDate, 180);
        else pickupDate = aDate;
      }

      const locationName = rowArray[locationIdx!];
      const regimenString = rowArray[regimenIdx!];
      const parsedRegimen =
        this.regimenService.parseRegimenString(regimenString);

      // 🔧 STEP 6: Match pickup point DURING validation
      const pickupPointNameFromFile =
        pickupPointIdx !== null && rowArray[pickupPointIdx]
          ? rowArray[pickupPointIdx].toString().trim()
          : null;

      let matchedPickupPoint: ReturnType<
        DrugPickupPointService['findBestMatchSync']
      > = null;
      let pickupPointMatchStatus = 'unmatched';

      if (pickupPointNameFromFile) {
        matchedPickupPoint = this.pickupPointService.findBestMatchSync(
          pickupPointNameFromFile,
          allPickupPoints,
        );

        if (matchedPickupPoint) {
          pickupPointMatchStatus = 'matched';
          console.log(
            `✅ Matched "${pickupPointNameFromFile}" → "${matchedPickupPoint.name}"`,
          );
        } else {
          pickupPointMatchStatus = 'unmatched';
          console.log(`❌ No match for "${pickupPointNameFromFile}"`);
        }
      }

      // Store the pickup point name for matching in commitRecords
      staged.push({
        ...metadata,
        firstName,
        lastName,
        primaryContact,
        prescriptionDate: pDate,
        regimen: regimenString,
        regimenAlias: parsedRegimen?.alias || null,
        regimenFullName: parsedRegimen?.fullName || null,
        nextClinicalAppointmentDate: aDate,
        nextDrugPickupDate: pickupDate,
        // Original string from file
        drugPickupPoint: pickupPointNameFromFile,
        // ✅ New: matched pickup point from backend
        drugPickupPointId: matchedPickupPoint?.id || null,
        // ✅ New: match status for frontend
        pickupPointMatchStatus: pickupPointMatchStatus,
        // ✅ New: matched name for display
        matchedPickupPointName: matchedPickupPoint?.name || null,
        location: locationName,
        patientUniqueId: patientIdIdx !== null ? rowArray[patientIdIdx] : null,
        gender: genderIdx !== null ? rowArray[genderIdx] : null,
        address: addressIdx !== null ? rowArray[addressIdx] : null,
        status: 'PENDING',
        locationId: null,
        regimenId: null,
      });
    }

    console.log(`Processed: ${staged.length} valid, ${errors.length} errors`);
    return { staged, errors };
  }

  /**
   * Commits staged records with relationship resolution
   */
  async commitRecords(records: any[]) {
    const resolvedRecords: Array<any> = [];

    for (const record of records) {
      // Resolve or create Location
      let locationId: string | null = null;
      if (record.location) {
        const location = await this.locationService.findOrCreate(
          record.location,
        );
        locationId = location?.id || null;
      }

      // Resolve or create Regimen
      let regimenId: string | null = null;
      if (record.regimen) {
        const regimen = await this.regimenService.findOrCreate(record.regimen);
        regimenId = regimen?.id || null;
      }

      // 🔧 Pickup point ID comes directly from the frontend
      // (which received it from validation and the user may have overridden it)
      const pickupPointId = record.drugPickupPointId || null;

      if (!pickupPointId) {
        throw new Error(
          `Drug Pickup Point "${record.drugPickupPoint || 'unknown'}" has not been assigned. Please select a pickup point before committing.`,
        );
      }

      resolvedRecords.push({
        ...record,
        locationId,
        regimenId,
        drugPickupPointId: pickupPointId,
      });
    }

    return await this.patientRepo.upsert(resolvedRecords, [
      'prescriptionDate',
      'regimen',
      'primaryContact',
    ]);
  }

  async findAllPending() {
    return await this.patientRepo.find({
      where: { status: 'PENDING' },
      order: { createdAt: 'DESC' },
      relations: ['locationEntity', 'regimenEntity', 'drugPickupPointEntity'],
    });
  }

  async updateRecord(id: string, updateData: Partial<PatientRecord>) {
    return await this.patientRepo.update(id, updateData);
  }

  async createBatch(
    startDate: string,
    endDate: string,
    batchName: string,
    numberOfRepeats: number = 1,
    dosageInstructions: string = '',
  ) {
    // Validate date range (max 7 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 0) {
      throw new Error('End date must be after start date.');
    }

    if (diffDays > 7) {
      throw new Error('Date range cannot exceed 7 days.');
    }

    // Find records with pickup dates between start and end (inclusive)
    const eligibleRecords = await this.patientRepo.find({
      where: {
        nextDrugPickupDate: Between(start, end),
        status: 'PENDING',
        batch: IsNull(),
      },
    });

    if (eligibleRecords.length === 0) {
      throw new Error('No available records found for this date range.');
    }

    const newBatch = this.batchRepo.create({
      name: batchName,
      startDate: start,
      endDate: end,
      status: 'CREATED',
      numberOfRepeats: numberOfRepeats,
      dosageInstructions: dosageInstructions,
    });
    const savedBatch = await this.batchRepo.save(newBatch);

    await this.patientRepo.update(
      eligibleRecords.map((r) => r.id),
      { batch: savedBatch, status: 'BATCHED' },
    );

    return savedBatch;
  }

  /**
   * Get all batches (both active and completed)
   */
  async getAllBatches(): Promise<DispensingBatch[]> {
    const batches = await this.batchRepo.find({
      relations: ['patientRecords'],
      order: { createdAt: 'DESC' },
    });
    return batches || [];
  }

  /**
   * Get active batches (CREATED status only)
   */
  async getActiveBatches(): Promise<DispensingBatch[]> {
    const batches = await this.batchRepo.find({
      where: { status: 'CREATED' },
      relations: ['patientRecords'],
      order: { createdAt: 'DESC' },
    });
    return batches || [];
  }

  /**
   * Get completed batches
   */
  async getCompletedBatches(): Promise<DispensingBatch[]> {
    const batches = await this.batchRepo.find({
      where: { status: 'COMPLETED' },
      relations: ['patientRecords'],
      order: { createdAt: 'DESC' },
    });
    return batches || [];
  }

  async processAndPrint(recordId: string) {
    const record = await this.patientRepo.findOne({
      where: { id: recordId },
      relations: ['drugPickupPointEntity', 'batch'],
    });

    if (!record) throw new Error('Patient record not found');

    const batch = record.batch;
    const numberOfRepeats = batch?.numberOfRepeats || 1;
    const dosageInstructions =
      batch?.dosageInstructions || 'Take as prescribed';

    const bagBarcode = `B${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;

    const pickupPointName =
      record.drugPickupPointEntity?.name ||
      record.drugPickupPoint ||
      'Not specified';
    const pickupPointId = record.drugPickupPointEntity?.id || null;

    // Create bag with proper property names
    const newBag = new Bag();
    newBag.barcode = bagBarcode;
    newBag.patientName = `${record.firstName} ${record.lastName}`;
    newBag.collectionLocation = pickupPointName;
    newBag.drugPickupPointId = pickupPointId;
    newBag.patientRecord = record;
    newBag.patientRecordId = record.id;
    newBag.status = 'PRINTED';

    await this.bagRepo.save(newBag);

    let collectionDateString = new Date().toLocaleDateString();
    if (record.nextDrugPickupDate) {
      if (record.nextDrugPickupDate instanceof Date) {
        collectionDateString = record.nextDrugPickupDate.toLocaleDateString();
      } else if (typeof record.nextDrugPickupDate === 'string') {
        collectionDateString = new Date(
          record.nextDrugPickupDate,
        ).toLocaleDateString();
      }
    }

    // Print Bag Label
    const bagLabelData = {
      type: 'bag' as const,
      barcode: bagBarcode,
      patientName: record.firstName,
      patientSurname: record.lastName,
      collectionDate: collectionDateString,
      pickupPoint: pickupPointName,
    };

    try {
      await this.printService.printBagLabel(bagLabelData);
      this.logger.log(
        `✅ Bag label printed for: ${record.firstName} ${record.lastName}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`❌ Failed to print bag label: ${errorMessage}`);
    }

    // Print Product Labels for each repeat (bottle)
    for (let i = 1; i <= numberOfRepeats; i++) {
      const productLabelData = {
        patientName: `${record.firstName} ${record.lastName}`,
        regimen: record.regimen,
        dosageInstructions: dosageInstructions,
        bottleNumber: i,
        totalBottles: numberOfRepeats,
      };

      try {
        await this.printService.printProductLabel(productLabelData);
        this.logger.log(
          `✅ Product label ${i}/${numberOfRepeats} printed for: ${record.firstName} ${record.lastName}`,
        );
        // Small delay between labels to prevent printer jamming
        await this.delay(500);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        this.logger.error(
          `❌ Failed to print product label ${i}: ${errorMessage}`,
        );
      }
    }

    record.status = 'PRINTED';
    await this.patientRepo.save(record);

    return {
      success: true,
      bagBarcode,
      message: `Bag label and ${numberOfRepeats} product label(s) printed for ${record.firstName} ${record.lastName}`,
      numberOfRepeats: numberOfRepeats,
    };
  }

  // Add delay helper
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async reprintBagLabel(recordId: string) {
    const bag = await this.bagRepo.findOne({
      where: { patientRecord: { id: recordId } },
      relations: ['patientRecord', 'patientRecord.drugPickupPointEntity'],
    });

    if (!bag) {
      throw new Error('Bag not found for this record');
    }

    const record = bag.patientRecord;

    let collectionDateString = 'Not specified';
    if (record.nextDrugPickupDate) {
      if (record.nextDrugPickupDate instanceof Date) {
        collectionDateString = record.nextDrugPickupDate.toLocaleDateString();
      } else if (typeof record.nextDrugPickupDate === 'string') {
        collectionDateString = new Date(
          record.nextDrugPickupDate,
        ).toLocaleDateString();
      } else {
        collectionDateString = String(record.nextDrugPickupDate);
      }
    }

    const pickupPointName =
      record.drugPickupPointEntity?.name ||
      record.drugPickupPoint ||
      'Not specified';

    const bagLabelData = {
      type: 'bag' as const,
      barcode: bag.barcode,
      patientName: record.firstName,
      patientSurname: record.lastName,
      collectionDate: collectionDateString,
      pickupPoint: pickupPointName,
    };

    try {
      await this.printService.printBagLabel(bagLabelData);
      console.log(
        `✅ Bag label reprinted for: ${record.firstName} ${record.lastName}`,
      );
      return { success: true, message: 'Label reprinted successfully' };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to reprint label: ${errorMessage}`);
    }
  }

  async completeBatch(batchId: string) {
    const batch = await this.batchRepo.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    batch.status = 'COMPLETED';
    await this.batchRepo.save(batch);

    return { success: true, message: 'Batch completed successfully' };
  }

  async scanBagToBox(bagBarcode: string): Promise<{
    boxNumber: string;
    location: string;
    patient: string;
    isNewBox: boolean;
  }> {
    // Find the bag with its drug pickup point relation
    const bag = await this.bagRepo.findOne({
      where: { barcode: bagBarcode },
      relations: ['patientRecord', 'drugPickupPoint', 'box'],
    });

    if (!bag) throw new Error('Bag not found');

    if (bag.status === 'BOXED') {
      throw new Error(`Bag ${bagBarcode} is already boxed`);
    }

    // Get the Drug Pickup Point
    const pickupPoint = bag.drugPickupPoint;
    const pickupPointId = bag.drugPickupPointId || 'null';
    const pickupPointName =
      pickupPoint?.name || bag.collectionLocation || 'Unknown Location';

    const collectionDate = bag.patientRecord?.nextDrugPickupDate
      ? new Date(bag.patientRecord.nextDrugPickupDate).toLocaleDateString()
      : new Date().toLocaleDateString();

    // Check if there's an OPEN box for this exact drug pickup point
    let openBox = await this.boxRepo.findOne({
      where: {
        drugPickupPointId: pickupPointId,
        status: 'OPEN',
      },
      relations: ['bags', 'drugPickupPoint'],
    });

    let isNewBox = false;

    if (!openBox) {
      await this.closeAllOpenBoxes();

      openBox = this.boxRepo.create({
        boxNumber: `BOX-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`,
        drugPickupPointId: pickupPointId,
        destinationLocation: pickupPointName,
        collectionDate: collectionDate,
        status: 'OPEN',
      });
      openBox = await this.boxRepo.save(openBox);
      isNewBox = true;
      this.logger.log(
        `Created new box ${openBox.boxNumber} for pickup point: ${pickupPointName}`,
      );
    }

    // Add bag to the box
    bag.box = openBox;
    bag.boxId = openBox.id;
    bag.status = 'BOXED';
    await this.bagRepo.save(bag);

    this.logger.log(
      `Bag ${bagBarcode} added to box ${openBox.boxNumber} for ${pickupPointName}`,
    );

    return {
      boxNumber: openBox.boxNumber,
      location: pickupPointName,
      patient: bag.patientName,
      isNewBox: isNewBox,
    };
  }

  /**
   * Get open box for a specific pickup point ID
   */
  async getOpenBoxForPickupPoint(pickupPointId: string): Promise<Box | null> {
    return await this.boxRepo.findOne({
      where: {
        drugPickupPointId: pickupPointId,
        status: 'OPEN',
      },
      relations: ['bags', 'bags.patientRecord', 'drugPickupPoint'],
    });
  }

  /**
   * Close all open boxes (called when creating a new box for a different pickup point)
   */
  async closeAllOpenBoxes(): Promise<void> {
    const openBoxes = await this.boxRepo.find({
      where: { status: 'OPEN' },
      relations: ['bags'],
    });

    for (const box of openBoxes) {
      if (box.bags && box.bags.length > 0) {
        box.status = 'CLOSED';
        await this.boxRepo.save(box);
        this.logger.log(
          `Auto-closed box ${box.boxNumber} with ${box.bags.length} bags for ${box.destinationLocation}`,
        );
      }
    }
  }

  async getRecordsByBatch(batchId: string) {
    return await this.patientRepo.find({
      where: { batch: { id: batchId } },
      order: { location: 'ASC', lastName: 'ASC' },
      relations: ['locationEntity', 'regimenEntity', 'drugPickupPointEntity'],
    });
  }

  /**
   * Close a box and send to logistics system
   */
  async closeBox(boxId: string) {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
      relations: ['bags', 'bags.patientRecord', 'drugPickupPoint'],
    });

    if (!box) {
      throw new Error('Box not found');
    }

    // Update status to CLOSED
    box.status = 'CLOSED';
    await this.boxRepo.save(box);

    // Prepare bags for logistics
    const bags = box.bags || [];

    if (bags.length === 0) {
      this.logger.warn(`Box ${box.boxNumber} has no bags, skipping logistics`);
      return {
        success: true,
        message: 'Box closed but no bags to send',
        boxNumber: box.boxNumber,
        bagsCount: 0,
      };
    }

    // 🔥 PRINT BOX LABEL
    try {
      const boxLabelData = {
        type: 'box' as const,
        barcode: box.boxNumber,
        collectionDate: box.collectionDate || new Date().toLocaleDateString(),
        pickupPoint: box.destinationLocation || 'Unknown',
      };

      await this.printService.printBoxLabel(boxLabelData);
      this.logger.log(`✅ Box label printed for: ${box.boxNumber}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`❌ Failed to print box label: ${errorMessage}`);
      // Continue with logistics even if printing fails
    }

    try {
      // Send to logistics system using the updated service (now expects boxId)
      const result = await this.logisticsService.sendBoxToLogistics(box.id);

      if (result.statusCode === 200) {
        // Box status will be updated by the logistics service to SENT
        this.logger.log(`Box ${box.boxNumber} successfully sent to logistics`);
        return {
          success: true,
          message: 'Box closed and sent to logistics system',
          boxNumber: box.boxNumber,
          bagsCount: bags.length,
        };
      } else {
        throw new Error('Logistics API returned non-200 status');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Failed to send box to logistics: ${errorMessage}`);

      // Box remains CLOSED but not SENT - can retry later
      return {
        success: false,
        message: `Box closed but failed to send to logistics: ${errorMessage}`,
        boxNumber: box.boxNumber,
        bagsCount: bags.length,
      };
    }
  }

  /**
   * Retry sending a failed box to logistics
   */
  async retrySendBox(boxId: string): Promise<unknown> {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
    });

    if (!box) {
      throw new Error('Box not found');
    }

    this.logger.log(`Retrying failed box ${box.boxNumber}`);

    const retryResult: unknown =
      await this.logisticsService.retryFailedBox(boxId);
    return retryResult;
  }

  /**
   * Get box logistics status
   */
  async getBoxLogisticsStatus(boxId: string): Promise<unknown> {
    const status: unknown =
      await this.logisticsService.getBoxLogisticsStatus(boxId);
    return status;
  }

  /**
   * Get the current open box (first OPEN box found)
   * In a real scenario, there should only be one open box at a time
   */
  async getCurrentOpenBox(): Promise<Box | null> {
    return await this.boxRepo.findOne({
      where: { status: 'OPEN' },
      relations: ['bags', 'bags.patientRecord', 'drugPickupPoint'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Helper to get location ID from destination location name
   * You may need to map this based on your Location entity and the logistics system's LocationIDs
   */
  private getLocationIdForBox(destinationLocation: string): string {
    // This mapping should be configured based on your logistics system
    const locationMapping: { [key: string]: string } = {
      'Domicilliary HC': '611',
      'Maseru Regional Hospital': '611',
      'Baylor Paediatric': '499',
      'Maseru Mall': '501',
      // Add more mappings as needed
    };

    return locationMapping[destinationLocation] || '611'; // Default to Maseru Regional
  }

  // Get all boxes
  async getAllBoxes(): Promise<Box[]> {
    const boxes = await this.boxRepo.find({
      relations: ['bags', 'bags.patientRecord', 'drugPickupPoint'],
      order: { createdAt: 'DESC' },
    });

    // Ensure logisticsStatus is included
    return boxes.map((box) => ({
      ...box,
      logisticsStatus: box.logisticsStatus || 'PENDING',
    }));
  }

  // Get box by ID - returns Box or null
  async getBoxById(id: string): Promise<Box | null> {
    return await this.boxRepo.findOne({
      where: { id },
      relations: ['bags', 'bags.patientRecord'],
    });
  }

  // Get or create open box for a location
  async getOrCreateOpenBox(location: string): Promise<Box> {
    let box = await this.boxRepo.findOne({
      where: { destinationLocation: location, status: 'OPEN' },
      relations: ['bags', 'bags.patientRecord'],
    });

    if (!box) {
      box = this.boxRepo.create({
        boxNumber: `BOX-${Date.now().toString().slice(-6)}`,
        destinationLocation: location,
        status: 'OPEN',
      });
      box = await this.boxRepo.save(box);
    }

    return box;
  }
}
