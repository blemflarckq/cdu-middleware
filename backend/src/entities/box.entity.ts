import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Bag } from './bag.entity';

@Entity('boxes')
export class Box {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  boxNumber!: string;

  @Column({ nullable: true })
  logisticsReference!: string; // The GUID from logistics system

  @Column()
  destinationLocation!: string;

  @Column({ default: 'OPEN' })
  status!: string; // OPEN, CLOSED, SENT

  @OneToMany(() => Bag, (bag) => bag.box)
  bags!: Bag[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
