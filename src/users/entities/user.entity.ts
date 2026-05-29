import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum UserRole {
  TEACHER = 'teacher',
  PARENT = 'parent',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @Column({ name: 'first_name', type: 'varchar' })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar' })
  lastName: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  // IANA timezone string (e.g. 'Asia/Kolkata'). Service layer reads this for UTC ↔ local conversion.
  @Column({ type: 'varchar' })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Course, (course) => course.teacher)
  courses: Relation<Course[]>;

  @OneToMany(() => Booking, (booking) => booking.parent)
  bookings: Relation<Booking[]>;
}
