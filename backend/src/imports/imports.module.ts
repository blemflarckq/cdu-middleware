import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { PatientRecord } from '../entities/patient-record.entity';
import { DispensingBatch } from '../entities/dispensing-batch.entity';
import { Bag } from '../entities/bag.entity';
import { Box } from '../entities/box.entity';
import { PrintService } from '../printers/print.service';
import { PrintController } from '../printers/print.controller';
import { LocationService } from '../admin/location.service';
import { RegimenService } from '../admin/regimen.service';
import { DrugPickupPointService } from '../admin/drug-pickup-point.service';
import { Location } from '../entities/location.entity';
import { Regimen } from '../entities/regimen.entity';
import { DrugPickupPoint } from '../entities/drug-pickup-point.entity';
import { HttpModule } from '@nestjs/axios';
import { AdminModule } from '../admin/admin.module';
import { LogisticsService } from '../logistics/logistics.service';
import { LogisticsModule } from '../logistics/logistics.module';

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
    AdminModule,
    LogisticsModule,
  ],
  controllers: [ImportController, PrintController],
  providers: [
    ImportService,
    PrintService,
    LocationService,
    RegimenService,
    DrugPickupPointService,
    LogisticsService,
  ],
})
export class ImportsModule {}
