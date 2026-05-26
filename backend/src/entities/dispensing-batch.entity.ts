import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';

@Entity('dispensing_batches')
export class DispensingBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string; // e.g., "Batch - 2026-04-20"

  @Column({ type: 'date' })
  targetDate!: Date;

  @Column({ default: 'CREATED' }) // CREATED, IN_PROGRESS, COMPLETED
  status!: string;

  // FIX: Define the inverse relationship here
  @OneToMany(() => PatientRecord, (record) => record.batch)
  patients!: PatientRecord[];

  @CreateDateColumn()
  createdAt!: Date;
}
