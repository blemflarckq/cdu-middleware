/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
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
  //logisticsService: any;
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
   * Logic for Step 1: Parsing and Validation
   */
  validateImport(rows: any[]) {
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

    // STEP 4: Process data rows
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
      if (patientNameIdx === null || !rowArray[patientNameIdx])
        missing.push('Patient Name');
      if (prescriptionDateIdx === null || !rowArray[prescriptionDateIdx])
        missing.push('Prescription Date');
      if (regimenIdx === null || !rowArray[regimenIdx])
        missing.push('Regimen Prescribed');
      if (appointmentDateIdx === null || !rowArray[appointmentDateIdx])
        missing.push('Next Clinical Appointment Date');
      if (pickupPointIdx === null || !rowArray[pickupPointIdx])
        missing.push('Drug Pickup Point');
      if (primaryContactIdx === null || !rowArray[primaryContactIdx])
        missing.push('Primary Contact');
      if (locationIdx === null || !rowArray[locationIdx])
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

      const pDate = new Date(rowArray[prescriptionDateIdx!]);
      const aDate = new Date(rowArray[appointmentDateIdx!]);
      let pickupDate =
        nextPickupDateIdx !== null && rowArray[nextPickupDateIdx]
          ? new Date(rowArray[nextPickupDateIdx])
          : null;

      if (!isValid(pickupDate) && isValid(pDate) && isValid(aDate)) {
        const diff = differenceInDays(aDate, pDate);
        const roundedDiff = Math.round(diff / 30) * 30;

        if (roundedDiff === 180) pickupDate = subDays(aDate, 90);
        else if (roundedDiff === 360) pickupDate = subDays(aDate, 180);
        else pickupDate = aDate;
      }

      // Get or create Location (async but we're in sync method - we'll handle in commitRecords)
      const locationName = rowArray[locationIdx!];

      // Parse regimen
      const regimenString = rowArray[regimenIdx!];
      const parsedRegimen =
        this.regimenService.parseRegimenString(regimenString);

      // Get pickup point name
      const pickupPointName = rowArray[pickupPointIdx!];

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
        drugPickupPoint: pickupPointName,
        location: locationName,
        patientUniqueId: patientIdIdx !== null ? rowArray[patientIdIdx] : null,
        gender: genderIdx !== null ? rowArray[genderIdx] : null,
        address: addressIdx !== null ? rowArray[addressIdx] : null,
        status: 'PENDING',
        // These will be resolved during commit
        locationId: null,
        regimenId: null,
        drugPickupPointId: null,
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

      // Find best matching Pickup Point
      let pickupPointId: string | null = null;
      if (record.drugPickupPoint) {
        const pickupPoint = await this.pickupPointService.findBestMatch(
          record.drugPickupPoint,
        );
        if (pickupPoint) {
          pickupPointId = pickupPoint.id;
          console.log(
            `Matched "${record.drugPickupPoint}" to pickup point "${pickupPoint.name}"`,
          );
        } else {
          console.log(
            `No match found for pickup point "${record.drugPickupPoint}"`,
          );
        }
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

  async createBatch(targetDate: string, batchName: string) {
    const eligibleRecords = await this.patientRepo.find({
      where: {
        nextDrugPickupDate: new Date(targetDate),
        status: 'PENDING',
        batch: IsNull(),
      },
    });

    if (eligibleRecords.length === 0) {
      throw new Error('No available records found for this date.');
    }

    const newBatch = this.batchRepo.create({
      name: batchName,
      targetDate: new Date(targetDate),
      status: 'CREATED',
    });
    const savedBatch = await this.batchRepo.save(newBatch);

    await this.patientRepo.update(
      eligibleRecords.map((r) => r.id),
      { batch: savedBatch, status: 'BATCHED' },
    );

    return savedBatch;
  }

  async processAndPrint(recordId: string) {
    const record = await this.patientRepo.findOne({
      where: { id: recordId },
      relations: ['drugPickupPointEntity'],
    });

    if (!record) throw new Error('Patient record not found');

    const bagBarcode = `B${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;

    const newBag = this.bagRepo.create({
      barcode: bagBarcode,
      patientName: `${record.firstName} ${record.lastName}`,
      collectionLocation: record.location,
      status: 'PRINTED',
      patientRecord: record,
    });

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

    const pickupPointName =
      record.drugPickupPointEntity?.name ||
      record.drugPickupPoint ||
      'Not specified';

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
      console.log(
        `✅ Bag label printed for: ${record.firstName} ${record.lastName}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Failed to print bag label: ${errorMessage}`);
    }

    console.log(
      `[EPSON - PLACEHOLDER] Printing slip for Location: ${record.location}`,
    );
    console.log(
      `[EPSON] Slip would contain: Patient: ${record.firstName} ${record.lastName}, Regimen: ${record.regimen}`,
    );

    record.status = 'PRINTED';
    await this.patientRepo.save(record);

    return {
      success: true,
      bagBarcode,
      message: `Bag label printed for ${record.firstName} ${record.lastName}`,
    };
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

  async scanBagToBox(
    bagBarcode: string,
  ): Promise<{ boxNumber: string; location: string; patient: string }> {
    const bag = await this.bagRepo.findOne({
      where: { barcode: bagBarcode },
      relations: ['patientRecord'],
    });

    if (!bag) throw new Error('Bag not found');

    let box = await this.boxRepo.findOne({
      where: { destinationLocation: bag.collectionLocation, status: 'OPEN' },
      relations: ['bags'],
    });

    if (!box) {
      box = this.boxRepo.create({
        boxNumber: `BOX-${Date.now().toString().slice(-6)}`,
        destinationLocation: bag.collectionLocation,
        status: 'OPEN',
      });
      box = await this.boxRepo.save(box);
    }

    bag.box = box;
    bag.status = 'BOXED';
    await this.bagRepo.save(bag);

    return {
      boxNumber: box.boxNumber,
      location: box.destinationLocation,
      patient: bag.patientName,
    };
  }

  async getActiveBatches() {
    return await this.batchRepo.find({
      where: { status: 'CREATED' },
      order: { createdAt: 'DESC' },
    });
  }

  async getRecordsByBatch(batchId: string) {
    return await this.patientRepo.find({
      where: { batch: { id: batchId } },
      order: { location: 'ASC', lastName: 'ASC' },
      relations: ['locationEntity', 'regimenEntity', 'drugPickupPointEntity'],
    });
  }

  async closeBox(boxId: string) {
    const box = await this.boxRepo.findOne({
      where: { id: boxId },
      relations: ['bags', 'bags.patientRecord'],
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
      return { success: true, message: 'Box closed but no bags to send' };
    }

    // Build customer data for each bag
    const bagData = bags.map((bag) => {
      const record = bag.patientRecord;
      return {
        bagBarcode: bag.barcode,
        patient: {
          ContactNumber: record.primaryContact || '',
          CustomerExternalReference: record.id,
          IDNumber: record.patientUniqueId || '',
          Name: record.firstName,
          NextCollectionDate:
            record.nextDrugPickupDate?.toISOString() ||
            new Date().toISOString(),
          Surname: record.lastName,
          Title: record.gender === 'F' ? 'Ms' : 'Mr',
          DateOfBirth: null,
          GenderType: record.gender === 'F' ? 'Female' : 'Male',
          FolderNumber: null,
        },
        scheduledDeliveryDate:
          record.nextDrugPickupDate?.toISOString() || new Date().toISOString(),
      };
    });

    // Find location ID (you may need to map this based on your location entity)
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const locationId = await this.getLocationIdForBox(box.destinationLocation);

    try {
      // Send to logistics system
      const result = await this.logisticsService.sendBoxToLogistics(
        box.boxNumber,
        locationId,
        bagData,
      );

      if (result.statusCode === 200) {
        box.status = 'SENT';
        box.logisticsReference = `SENT_${new Date().toISOString()}`;
        await this.boxRepo.save(box);

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
    return await this.boxRepo.find({
      relations: ['bags', 'bags.patientRecord'],
      order: { createdAt: 'DESC' },
    });
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
