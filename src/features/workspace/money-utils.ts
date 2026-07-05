import { format, isToday, isYesterday, startOfMonth } from 'date-fns';

import type { Transaction } from '@/types';

export type TransactionSection = {
  title: string;
  data: Transaction[];
};

export function groupTransactionsByDate(transactions: Transaction[]): TransactionSection[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const date = transaction.date.toDate();
    const key = format(date, 'yyyy-MM-dd');
    const list = groups.get(key) ?? [];
    list.push(transaction);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      title: formatSectionTitle(new Date(key)),
      data,
    }));
}

function formatSectionTitle(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd MMM yyyy');
}

export function getMonthTotals(transactions: Transaction[], referenceDate = new Date()) {
  const monthStart = startOfMonth(referenceDate);

  const income = transactions
    .filter((t) => t.type === 'income' && t.date.toDate() >= monthStart)
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter((t) => t.type === 'expense' && t.date.toDate() >= monthStart)
    .reduce((sum, t) => sum + t.amount, 0);

  return { income, expense, net: income - expense };
}
