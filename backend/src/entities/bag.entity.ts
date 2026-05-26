import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { PatientRecord } from './patient-record.entity';
import { Box } from './box.entity';

@Entity('bags')
export class Bag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  barcode!: string; // "BAG-" + unique serial

  @Column()
  patientName!: string;

  @Column()
  collectionLocation!: string;

  @Column({ default: 'PRINTED' }) // PRINTED, BOXED, DISPATCHED
  status!: string;

  @OneToOne(() => PatientRecord)
  @JoinColumn()
  patientRecord!: PatientRecord;

  @ManyToOne(() => Box, (box) => box.bags)
  box!: Box;

  @CreateDateColumn()
  createdAt!: Date;
}
