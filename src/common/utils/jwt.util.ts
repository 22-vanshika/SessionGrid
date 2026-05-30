import { createHmac } from 'crypto';

export interface JwtPayload {
  sub: string;
  role: string;
  timezone: string;
  iat: number;
  exp: number;
}

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 3600;
  const value = parseInt(match[1], 10);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[match[2]!];
}

function hmac(header: string, body: string, secret: string): string {
  return createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
}

export function signJwt(
  claims: Pick<JwtPayload, 'sub' | 'role' | 'timezone'>,
  secret: string,
  expiresIn: string,
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ ...claims, iat: now, exp: now + parseExpiresIn(expiresIn) }),
  ).toString('base64url');
  return `${header}.${payload}.${hmac(header, payload, secret)}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  if (hmac(header, payload, secret) !== signature) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtPayload;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
