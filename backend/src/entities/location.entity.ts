import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string; // e.g., "Domicilliary HC", "Maseru East Clinic"

  @Column({ nullable: true })
  district?: string;

  @Column({ nullable: true })
  council?: string;

  @Column({ nullable: true })
  ward?: string;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => PatientRecord, (record) => record.locationEntity)
  patientRecords?: PatientRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
