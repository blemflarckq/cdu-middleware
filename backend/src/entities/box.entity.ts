import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Bag } from './bag.entity';
import { DrugPickupPoint } from './drug-pickup-point.entity';

@Entity('boxes')
export class Box {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  boxNumber!: string;

  // Direct relationship to DrugPickupPoint
  @Column({ nullable: true })
  drugPickupPointId!: string;

  @ManyToOne(() => DrugPickupPoint)
  @JoinColumn({ name: 'drugPickupPointId' })
  drugPickupPoint!: DrugPickupPoint;

  // Keep for display/backup
  @Column({ nullable: true })
  destinationLocation!: string;

  @Column({ nullable: true })
  collectionDate!: string;

  @Column({ default: 'OPEN' })
  status!: string; // OPEN, CLOSED, SENT, FAILED

  // Logistics tracking fields
  @Column({ nullable: true })
  logisticsReference!: string; // GUID sent to logistics system

  @Column({ nullable: true, default: 'PENDING' })
  logisticsStatus!: string; // PENDING, PROCESSING, SENT, FAILED, RETRYING, PENDING_CONFIRMATION

  @Column({ nullable: true, default: 0 })
  logisticsAttempts!: number; // Number of retry attempts

  @Column({ nullable: true, type: 'text' })
  logisticsLastError!: string; // Last error message

  @Column({ nullable: true })
  logisticsSentAt!: Date; // When successfully sent

  @Column({ nullable: true, type: 'json' })
  logisticsResponse!: any; // Store the response from logistics system

  @OneToMany(() => Bag, (bag) => bag.box)
  bags!: Bag[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
