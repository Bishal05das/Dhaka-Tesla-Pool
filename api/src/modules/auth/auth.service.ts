import bcrypt from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
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
  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'PASSENGER',
        // New passengers start with an empty TeslaPay wallet and top up (simulated).
        wallet: { create: { balancePoisha: 0 } },
      },
      select: publicUserSelect,
    });
  } catch (err) {
    // Rely on the unique index rather than a check-then-insert, which two
    // simultaneous sign-ups with the same email could both pass.
    if (isUniqueViolation(err)) throw conflict('CONFLICT', 'That email is already registered');
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

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
