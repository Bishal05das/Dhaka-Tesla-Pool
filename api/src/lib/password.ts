import bcrypt from 'bcryptjs';

// Cost 10 is ~50-100 ms per hash: slow enough to resist brute force, fast enough for login.
const COST = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
