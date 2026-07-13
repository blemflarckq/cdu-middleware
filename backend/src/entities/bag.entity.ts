import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';
import { Box } from './box.entity';
import { DrugPickupPoint } from './drug-pickup-point.entity';

@Entity('bags')
export class Bag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  barcode!: string;

  @Column()
  patientName!: string;

  @Column()
  collectionLocation!: string;

  @Column({ nullable: true })
  drugPickupPointId!: string | null;

  @ManyToOne(() => DrugPickupPoint)
  @JoinColumn({ name: 'drugPickupPointId' })
  drugPickupPoint!: DrugPickupPoint;

  @Column({ default: 'PRINTED' })
  status!: string;

  @ManyToOne(() => PatientRecord)
  @JoinColumn({ name: 'patientRecordId' })
  patientRecord!: PatientRecord;

  @Column()
  patientRecordId!: string;

  @ManyToOne(() => Box, (box) => box.bags)
  @JoinColumn({ name: 'boxId' })
  box!: Box;

  @Column({ nullable: true })
  boxId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
