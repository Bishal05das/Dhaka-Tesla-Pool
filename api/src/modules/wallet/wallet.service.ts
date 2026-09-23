// Simulated TeslaPay. The balance lives on `wallets`; every change also appends a row to
// `wallet_transactions` with the balance after it, so the history always adds up.
import { notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

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
