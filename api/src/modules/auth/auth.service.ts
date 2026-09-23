import bcrypt from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { violatedUniqueIndex } from '../../lib/prismaErrors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  vehicle: { select: { id: true, name: true, plate: true, capacity: true, isOnline: true } },
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export async function register(input: RegisterInput): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password);
  const base = { name: input.name, email: input.email, passwordHash, role: input.role };
  // Nested create = one INSERT per table inside a single transaction: a driver never
  // exists without their Tesla, and a passenger never exists without a wallet.
  const data: Prisma.UserCreateInput =
    input.role === 'DRIVER'
      ? { ...base, vehicle: { create: input.vehicle } }
      : // New passengers start with an empty TeslaPay wallet and top up (simulated).
        { ...base, wallet: { create: { balancePoisha: 0 } } };

  try {
    return await prisma.user.create({ data, select: publicUserSelect });
  } catch (err) {
    // Rely on the unique indexes rather than check-then-insert, which two
    // simultaneous sign-ups with the same email or plate could both pass.
    const index = violatedUniqueIndex(err);
    if (index === 'vehicles_plate_key') throw conflict('CONFLICT', 'A Tesla with that plate is already registered');
    if (index === 'users_email_key') throw conflict('CONFLICT', 'That email is already registered');
    throw err;
  }
}

// Compared against when the email is unknown, so a login takes the same time
// whether or not the account exists (no user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export async function login(input: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    // Same message for unknown email and wrong password.
    throw new AppError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
  }
  const { passwordHash: _omit, ...publicUser } = user;
  return publicUser;
}

export async function getUser(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) throw notFound('Account not found');
  return user;
}
