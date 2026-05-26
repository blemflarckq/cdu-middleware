import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';

@Entity('regimens')
export class Regimen {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  alias!: string; // e.g., "1j"

  @Column({ unique: true })
  fullName!: string; // e.g., "TDF-3TC-DTG"

  @Column({ nullable: true })
  description?: string;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => PatientRecord, (record) => record.regimenEntity)
  patientRecords?: PatientRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
