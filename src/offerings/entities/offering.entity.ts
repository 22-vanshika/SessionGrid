import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Session } from '../../sessions/entities/session.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum OfferingStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
}

@Entity('offerings')
export class Offering {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'enum', enum: OfferingStatus, default: OfferingStatus.DRAFT })
  status: OfferingStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Course, (course) => course.offerings)
  @JoinColumn({ name: 'course_id' })
  course: Relation<Course>;

  @OneToMany(() => Session, (session) => session.offering)
  sessions: Relation<Session[]>;

  @OneToMany(() => Booking, (booking) => booking.offering)
  bookings: Relation<Booking[]>;
}
