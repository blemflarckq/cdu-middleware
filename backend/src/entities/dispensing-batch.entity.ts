import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';

@Entity('dispensing_batches')
export class DispensingBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name!: string;

  @Column()
  startDate!: Date; // Renamed from targetDate

  @Column()
  endDate!: Date; // New field for range end

  @Column({ default: 'CREATED' })
  status!: string; // CREATED, COMPLETED

  // New fields for repeats
  @Column({ default: 1 })
  numberOfRepeats!: number; // Number of bottles to dispense

  @Column({ nullable: true, type: 'text' })
  dosageInstructions!: string; // Instructions for the patient

  @OneToMany(() => PatientRecord, (patientRecord) => patientRecord.batch)
  patientRecords!: PatientRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
