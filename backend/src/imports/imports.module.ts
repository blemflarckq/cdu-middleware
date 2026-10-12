import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { PatientRecord } from '../entities/patient-record.entity';
import { DispensingBatch } from '../entities/dispensing-batch.entity';
import { Bag } from '../entities/bag.entity';
import { Box } from '../entities/box.entity';
import { Location } from '../entities/location.entity';
import { Regimen } from '../entities/regimen.entity';
import { DrugPickupPoint } from '../entities/drug-pickup-point.entity';
//import { PrintService } from '../printers/print.service';
import { LocationService } from '../admin/location.service';
import { RegimenService } from '../admin/regimen.service';
import { DrugPickupPointService } from '../admin/drug-pickup-point.service';
import { LogisticsService } from '../logistics/logistics.service';
import { PrintModule } from '../printers/print.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientRecord,
      DispensingBatch,
      Bag,
      Box,
      Location,
      Regimen,
      DrugPickupPoint,
    ]),
    HttpModule,
    PrintModule, // 🔥 Import PrintModule (it exports PrintService)
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    LocationService,
    RegimenService,
    DrugPickupPointService,
    LogisticsService,
  ],
  exports: [ImportService],
})
export class ImportModule {}
