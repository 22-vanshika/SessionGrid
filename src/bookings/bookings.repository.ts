import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, DeepPartial, EntityManager } from 'typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Booking, BookingStatus } from './entities/booking.entity';

@Injectable()
export class BookingsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Persists a new booking within an active transaction.
  // The caller must supply the EntityManager from that transaction so this
  // insert is atomic with the conflict check and lock that precede it.
  async save(
    booking: DeepPartial<Booking>,
    manager: EntityManager,
  ): Promise<Booking> {
    return manager
      .getRepository(Booking)
      .save(booking) as Promise<Booking>;
  }

  async findById(id: string): Promise<Booking | null> {
    return this.dataSource.getRepository(Booking).findOneBy({ id });
  }

  async findByParentId(parentId: string): Promise<Booking[]> {
    return this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.offering', 'offering')
      .leftJoinAndSelect('offering.sessions', 'session')
      .where('booking.parentId = :parentId', { parentId })
      .orderBy('session.startsAt', 'ASC')
      .getMany();
  }

  async updateStatus(id: string, status: BookingStatus): Promise<void> {
    await this.dataSource
      .getRepository(Booking)
      .update({ id }, { status });
  }

  async deleteById(id: string): Promise<void> {
    await this.dataSource.getRepository(Booking).delete({ id });
  }

  // Acquires a pessimistic write lock (SELECT … FOR UPDATE) on every confirmed
  // booking row belonging to this parent. Any concurrent transaction that tries
  // to read or modify those rows will block until this transaction commits,
  // preventing double-booking via a race condition.
  //
  // An advisory lock keyed on the parent ID is acquired first. This closes the
  // gap where two concurrent first-time bookings both start with zero existing
  // rows — SELECT FOR UPDATE on zero rows acquires nothing, so without the
  // advisory lock both transactions could pass the conflict check simultaneously.
  // pg_advisory_xact_lock is automatically released when the transaction ends.
  async lockParentBookings(
    parentId: string,
    manager: EntityManager,
  ): Promise<Booking[]> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
      [parentId],
    );

    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .where('booking.parentId = :parentId', { parentId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .setLock('pessimistic_write')
      .getMany();
  }

  // Checks whether any session already booked by this parent overlaps with any
  // of the incoming session time ranges (the sessions of the new offering).
  // Overlap predicate: existing.starts_at < newEnd  AND  existing.ends_at > newStart
  // Sessions that share only an endpoint (back-to-back) do NOT satisfy the predicate.
  // Must run inside the same transaction as lockParentBookings so it reads locked rows.
  async findConflictingSessions(
    parentId: string,
    newSessionRanges: ReadonlyArray<{ startsAt: Date; endsAt: Date }>,
    manager: EntityManager,
  ): Promise<Session[]> {
    if (newSessionRanges.length === 0) {
      return [];
    }

    return manager
      .getRepository(Session)
      .createQueryBuilder('session')
      .distinct(true)
      .innerJoin('session.offering', 'offering')
      .innerJoin('offering.bookings', 'booking')
      .where('booking.parentId = :parentId', { parentId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere(
        new Brackets((qb) => {
          newSessionRanges.forEach(({ startsAt, endsAt }, idx) => {
            qb.orWhere(
              `(session.startsAt < :endsAt${idx} AND session.endsAt > :startsAt${idx})`,
              { [`startsAt${idx}`]: startsAt, [`endsAt${idx}`]: endsAt },
            );
          });
        }),
      )
      .getMany();
  }
}
