import { Module } from '@nestjs/common';
//import { AppController } from './app.controller';
//import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportsModule } from './imports/imports.module';
//import { PatientRecord } from './entities/patient-record.entity';
//import { DispensingBatch } from './entities/dispensing-batch.entity';
//import { Bag } from './entities/bag.entity';
//import { Box } from './entities/box.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      // We use the service name 'db' from docker-compose
      host: 'db',
      port: 5432,
      username: 'dev_user',
      password: 'dev_password',
      database: 'pharmacy_mgmt',
      //entities: [PatientRecord, Bag, DispensingBatch, Box],
      autoLoadEntities: true,
      synchronize: true, // Auto-creates tables in dev; perfect for this project
    }),
    ImportsModule,
  ],
  //controllers: [AppController],
  //providers: [AppService],
})
export class AppModule {}
