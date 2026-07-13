import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { DispensingBatch } from './dispensing-batch.entity';
import { DrugPickupPoint } from './drug-pickup-point.entity';
import { Location } from './location.entity';
import { Regimen } from './regimen.entity';

@Entity('patient_records')
// Requirement: Uniqueness based on Date, Regimen, and Contact
@Index(['prescriptionDate', 'regimen', 'primaryContact'], { unique: true })
export class PatientRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Metadata from rows 2, 3, 4
  @Column({ nullable: true }) reportName!: string;
  @Column({ nullable: true }) reportDateRange!: string;
  @Column({ nullable: true }) reportGenerationDate!: string;

  // Identity (Split from "Patient Name")
  @Column() firstName!: string;
  @Column() lastName!: string;
  @Column({ nullable: true }) patientUniqueId!: string; // HIV Program ID
  @Column({ nullable: true }) gender!: string;
  @Column({ type: 'date', nullable: true }) dob!: Date;

  // Prescription Core
  @Column({ type: 'date' }) prescriptionDate!: Date;
  @Column() regimen!: string;
  @Column({ nullable: true })
  regimenId!: string;
  @ManyToOne(() => Regimen)
  @JoinColumn({ name: 'regimenId' })
  regimenEntity!: Regimen;

  @Column({ type: 'date' }) nextClinicalAppointmentDate!: Date;

  // Computed Field
  @Column({ type: 'date' }) nextDrugPickupDate!: Date;

  // Logistics
  @Column() drugPickupPoint!: string;
  @Column({ nullable: true })
  drugPickupPointId!: string;
  @ManyToOne(() => DrugPickupPoint)
  @JoinColumn({ name: 'drugPickupPointId' })
  drugPickupPointEntity!: DrugPickupPoint;

  @Column() location!: string;
  @Column({ nullable: true })
  locationId!: string;
  @ManyToOne(() => Location)
  @JoinColumn({ name: 'locationId' })
  locationEntity!: Location;

  @Column() primaryContact!: string; // Will include +266
  @Column({ nullable: true }) secondaryContact!: string;
  @Column({ nullable: true }) address!: string;

  @Column({ default: 'PENDING' })
  status!: string; // PENDING, BATCHED, PRINTED

  @ManyToOne(() => DispensingBatch, (batch) => batch.patientRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  batch!: DispensingBatch;

  @CreateDateColumn() createdAt!: Date;
}
