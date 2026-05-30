import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Offering } from '../../offerings/entities/offering.entity';
import { User } from '../../users/entities/user.entity';

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

// A parent may hold at most one active booking per offering.
// This is enforced at the database level via a partial unique index:
// UQ_bookings_offering_id_parent_id_confirmed ON bookings(offering_id, parent_id) WHERE status = 'confirmed'
@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'offering_id', type: 'uuid' })
  offeringId: string;

  @Column({ name: 'parent_id', type: 'uuid' })
  parentId: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.CONFIRMED })
  status: BookingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Offering, (offering) => offering.bookings)
  @JoinColumn({ name: 'offering_id' })
  offering: Relation<Offering>;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<User>;
}
