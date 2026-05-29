import { Injectable } from '@nestjs/common';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { EmailAlreadyTakenException } from '../common/exceptions/email-already-taken.exception';
import { InvalidCredentialsException } from '../common/exceptions/invalid-credentials.exception';
import { UserNotFoundException } from '../common/exceptions/user-not-found.exception';

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  timezone: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(data: RegisterData): Promise<User> {
    const existing = await this.usersRepository.findByEmail(data.email);
    if (existing) {
      throw new EmailAlreadyTakenException(data.email);
    }
    const passwordHash = await this.hashPassword(data.password);
    return this.usersRepository.save({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      timezone: data.timezone,
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new UserNotFoundException(id);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async validatePassword(email: string, plainPassword: string): Promise<User> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      // Intentionally identical response for missing user and wrong password
      // to prevent email enumeration.
      throw new InvalidCredentialsException();
    }
    const isValid = await this.verifyPassword(plainPassword, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsException();
    }
    return user;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES).toString('hex');
    const key = (await scryptAsync(password, salt, KEY_BYTES)) as Buffer;
    return `${salt}:${key.toString('hex')}`;
  }

  private async verifyPassword(plain: string, stored: string): Promise<boolean> {
    const separatorIndex = stored.indexOf(':');
    if (separatorIndex === -1) return false;
    const salt = stored.slice(0, separatorIndex);
    const storedKey = stored.slice(separatorIndex + 1);
    const key = (await scryptAsync(plain, salt, KEY_BYTES)) as Buffer;
    const storedKeyBuffer = Buffer.from(storedKey, 'hex');
    // timingSafeEqual prevents timing attacks; buffers must be equal length.
    if (key.length !== storedKeyBuffer.length) return false;
    return timingSafeEqual(key, storedKeyBuffer);
  }
}
