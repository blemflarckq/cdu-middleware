import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';

@Entity('drug_pickup_points')
export class DrugPickupPoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string; // e.g., "Maseru Mall Pickup"

  @Column({ nullable: true })
  externalId!: string; // ID from third-party system

  @Column({ nullable: true })
  address!: string;

  @Column({ nullable: true })
  contactNumber?: string;

  @Column({ default: true })
  isActive!: boolean;

  @OneToMany(() => PatientRecord, (record) => record.drugPickupPointEntity)
  patientRecords?: PatientRecord[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
