// Simulated TeslaPay. The balance lives on `wallets`; every change also appends a row to
// `wallet_transactions` with the balance after it, so the history always adds up.
import { notFound } from '../../lib/errors.js';
import { prisma, type Tx } from '../../lib/prisma.js';

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw notFound('No TeslaPay wallet for this account');
  const transactions = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, type: true, amountPoisha: true, balanceAfterPoisha: true, rideRequestId: true, createdAt: true },
  });
  return { balancePoisha: wallet.balancePoisha, transactions };
}

export async function topUp(userId: string, amountPoisha: number) {
  return prisma.$transaction(async (tx) => {
    // `increment` is a single UPDATE … SET balance = balance + x, so two top-ups at the same
    // moment both land; the ledger records the balance each one produced.
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balancePoisha: { increment: amountPoisha } },
    });
    await tx.walletTransaction.create({
      data: { userId, amountPoisha, type: 'TOPUP', balanceAfterPoisha: wallet.balancePoisha },
    });
    return { balancePoisha: wallet.balancePoisha };
  });
}

// Takes a ride's fare from the wallet if it can cover it. Returns false (and changes nothing)
// if it can't, so the caller can fall back to cash. The WHERE makes check-and-debit one atomic
// statement; the CHECK (balance >= 0) on the table backs it up.
export async function tryDebitForRide(tx: Tx, userId: string, rideRequestId: string, amountPoisha: number) {
  const [row] = await tx.$queryRaw<{ balance_poisha: number }[]>`
    UPDATE wallets SET balance_poisha = balance_poisha - ${amountPoisha}, updated_at = now()
    WHERE user_id = ${userId}::uuid AND balance_poisha >= ${amountPoisha}
    RETURNING balance_poisha`;
  if (!row) return false;
  await tx.walletTransaction.create({
    data: {
      userId,
      amountPoisha: -amountPoisha,
      type: 'RIDE_PAYMENT',
      rideRequestId,
      balanceAfterPoisha: row.balance_poisha,
    },
  });
  return true;
}
