import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DrugPickupPoint } from '../entities/drug-pickup-point.entity';
import { Location } from '../entities/location.entity';
import { Regimen } from '../entities/regimen.entity';
import { DrugPickupPointService } from './drug-pickup-point.service';
import { LocationService } from './location.service';
import { RegimenService } from './regimen.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DrugPickupPoint, Location, Regimen]),
    HttpModule,
  ],
  providers: [DrugPickupPointService, LocationService, RegimenService],
  controllers: [AdminController],
  exports: [DrugPickupPointService, LocationService, RegimenService],
})
export class AdminModule {}
