import {
  differenceInCalendarDays,
  isSameDay,
  isToday,
  startOfDay,
} from "date-fns";

import { formatCurrency, formatRelativeDue } from "@/lib/utils";
import type { Bill, BillDirection, BillStatus } from "@/types";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  open: "Open",
  partial: "Partial",
  paid: "Paid",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export const BILL_DIRECTION_LABELS: Record<BillDirection, string> = {
  payable: "To pay",
  receivable: "To receive",
};

export const OPEN_BILL_STATUSES: BillStatus[] = ["open", "partial", "overdue"];

export function toDate(
  ts: { toDate?: () => Date } | Date | null | undefined,
): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return ts.toDate?.() ?? null;
}

export function isOpenBill(b: Bill): boolean {
  return OPEN_BILL_STATUSES.includes(b.status);
}

export function daysUntilDue(b: Bill): number {
  const d = toDate(b.dueDate);
  if (!d) return 0;
  return differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
}

export function dueLabel(b: Bill): string {
  return formatRelativeDue(b.dueDate);
}

export function remainingAmount(b: Bill): number {
  return Math.max(0, b.amount - b.amountSettled);
}

export function getBillSummary(bills: Bill[]) {
  const open = bills.filter(isOpenBill);
  const payable = open.filter((b) => b.direction === "payable");
  const receivable = open.filter((b) => b.direction === "receivable");
  return {
    openCount: open.length,
    payableCount: payable.length,
    receivableCount: receivable.length,
    payableTotal: payable.reduce((s, b) => s + remainingAmount(b), 0),
    receivableTotal: receivable.reduce((s, b) => s + remainingAmount(b), 0),
  };
}

export function detectBillsDueToday(bills: Bill[]): Bill[] {
  return bills.filter((b) => {
    if (!isOpenBill(b)) return false;
    const d = toDate(b.dueDate);
    return d && isToday(d);
  });
}

export function detectBillsDueOn(
  bills: Bill[],
  date: Date,
): Bill[] {
  return bills.filter((b) => {
    if (!isOpenBill(b)) return false;
    const d = toDate(b.dueDate);
    return d && isSameDay(d, date);
  });
}

export function formatBillAmount(b: Bill): string {
  return formatCurrency(remainingAmount(b), b.currency);
}
