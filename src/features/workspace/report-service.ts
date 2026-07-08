import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { format } from 'date-fns';

import { getCategoryMeta } from '@/constants/transaction-categories';
import { BASE_CURRENCY } from '@/constants/currencies';
import { getChequeSummary } from '@/features/workspace/cheque-utils';
import {
  getCategoryBreakdown,
  getPeriodRange,
  getRangeTotals,
  type MoneyPeriod,
} from '@/features/workspace/money-utils';
import {
  effectivePayableStatus,
  effectiveReceivableStatus,
  getPayableSummary,
  getReceivableSummary,
} from '@/features/workspace/payment-utils';
import { formatCurrency } from '@/lib/utils';
import type {
  Cheque,
  FinancialReportType,
  Payable,
  Receivable,
  Transaction,
  WorkspaceGem,
} from '@/types';

export const REPORT_TYPES: {
  id: FinancialReportType;
  label: string;
  subtitle: string;
}[] = [
  { id: 'profit_loss', label: 'Profit & Loss', subtitle: 'Income vs expenses by category' },
  { id: 'cash_flow', label: 'Cash Flow', subtitle: 'Money in and out for the period' },
  { id: 'inventory_value', label: 'Inventory Value', subtitle: 'Current gem stock valuation' },
  { id: 'outstanding_payments', label: 'Outstanding Payments', subtitle: 'Receivables and payables due' },
  { id: 'cheque_maturity', label: 'Cheque Maturity', subtitle: 'Cheques clearing in the period' },
];

function reportShell(title: string, periodLabel: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0D1117; padding: 32px; font-size: 13px; }
    h1 { color: #1A3A5C; font-size: 22px; margin: 0 0 4px; }
    .meta { color: #5A6273; margin-bottom: 24px; font-size: 12px; }
    .brand { color: #C9A84C; font-weight: 700; letter-spacing: 1px; font-size: 11px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E2E6EA; }
    th { background: #F5F7FA; color: #1A3A5C; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-weight: 700; background: #E8F1FB; }
    .positive { color: #00A878; }
    .negative { color: #D94040; }
    .section { margin-top: 28px; }
    .section h2 { font-size: 14px; color: #1A3A5C; margin: 0 0 8px; }
    .summary-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
    .summary-card { flex: 1; min-width: 140px; background: #F5F7FA; padding: 14px; border-radius: 8px; }
    .summary-card .label { font-size: 10px; color: #5A6273; text-transform: uppercase; letter-spacing: 0.8px; }
    .summary-card .value { font-size: 18px; font-weight: 700; color: #1A3A5C; margin-top: 4px; }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E6EA; color: #9AA3B0; font-size: 11px; }
  </style>
</head>
<body>
  <div class="brand">GemFort Workspace</div>
  <h1>${title}</h1>
  <div class="meta">${periodLabel} · Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}</div>
  ${body}
  <footer>Confidential — for your records only. Amounts in ${BASE_CURRENCY} unless noted.</footer>
</body>
</html>`;
}

export function buildReportHtml(
  type: FinancialReportType,
  period: MoneyPeriod,
  data: {
    transactions: Transaction[];
    gems: WorkspaceGem[];
    receivables: Receivable[];
    payables: Payable[];
    cheques: Cheque[];
  },
): string {
  const range = getPeriodRange(period);
  const periodLabel = range.label;

  switch (type) {
    case 'profit_loss': {
      const totals = getRangeTotals(data.transactions, range);
      const incomeCats = getCategoryBreakdown(data.transactions, range, 'income');
      const expenseCats = getCategoryBreakdown(data.transactions, range, 'expense');
      const rows = [
        ...incomeCats.map(
          (c) =>
            `<tr><td>${getCategoryMeta(c.category).label}</td><td class="num positive">+${formatCurrency(c.amount)}</td></tr>`,
        ),
        ...expenseCats.map(
          (c) =>
            `<tr><td>${getCategoryMeta(c.category).label}</td><td class="num negative">−${formatCurrency(c.amount)}</td></tr>`,
        ),
      ].join('');
      return reportShell(
        'Profit & Loss',
        periodLabel,
        `<div class="summary-grid">
          <div class="summary-card"><div class="label">Income</div><div class="value positive">${formatCurrency(totals.income)}</div></div>
          <div class="summary-card"><div class="label">Expenses</div><div class="value negative">${formatCurrency(totals.expense)}</div></div>
          <div class="summary-card"><div class="label">Net profit</div><div class="value">${formatCurrency(totals.net)}</div></div>
        </div>
        <div class="section"><h2>Breakdown</h2>
        <table><thead><tr><th>Category</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      );
    }

    case 'cash_flow': {
      const totals = getRangeTotals(data.transactions, range);
      const txRows = data.transactions
        .filter((t) => {
          const d = t.date.toDate();
          return d >= range.start && d <= range.end;
        })
        .slice(0, 50)
        .map((t) => {
          const sign = t.type === 'income' ? '+' : '−';
          const cls = t.type === 'income' ? 'positive' : 'negative';
          return `<tr>
            <td>${format(t.date.toDate(), 'dd MMM')}</td>
            <td>${t.description || getCategoryMeta(t.category).label}</td>
            <td class="num ${cls}">${sign}${formatCurrency(t.amount, t.currency)}</td>
          </tr>`;
        })
        .join('');
      return reportShell(
        'Cash Flow',
        periodLabel,
        `<div class="summary-grid">
          <div class="summary-card"><div class="label">Total in</div><div class="value positive">${formatCurrency(totals.income)}</div></div>
          <div class="summary-card"><div class="label">Total out</div><div class="value negative">${formatCurrency(totals.expense)}</div></div>
          <div class="summary-card"><div class="label">Net</div><div class="value">${formatCurrency(totals.net)}</div></div>
        </div>
        <div class="section"><h2>Transactions</h2>
        <table><thead><tr><th>Date</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>${txRows || '<tr><td colspan="3">No transactions in period</td></tr>'}</tbody></table></div>`,
      );
    }

    case 'inventory_value': {
      const active = data.gems.filter((g) => g.status !== 'sold');
      const totalValue = active.reduce((s, g) => s + (g.totalCost ?? g.acquisitionCost ?? 0), 0);
      const rows = active
        .map(
          (g) =>
            `<tr><td>${g.sku ?? g.id.slice(0, 8)}</td><td>${g.gemType.replace(/_/g, ' ')}</td><td>${g.currentWeight}ct</td><td class="num">${formatCurrency(g.totalCost ?? g.acquisitionCost ?? 0)}</td></tr>`,
        )
        .join('');
      return reportShell(
        'Inventory Value',
        `As of ${format(new Date(), 'dd MMM yyyy')}`,
        `<div class="summary-grid">
          <div class="summary-card"><div class="label">Active gems</div><div class="value">${active.length}</div></div>
          <div class="summary-card"><div class="label">Total value</div><div class="value">${formatCurrency(totalValue)}</div></div>
        </div>
        <div class="section"><h2>Inventory</h2>
        <table><thead><tr><th>SKU</th><th>Type</th><th>Weight</th><th class="num">Value</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No gems in inventory</td></tr>'}</tbody></table></div>`,
      );
    }

    case 'outstanding_payments': {
      const recSummary = getReceivableSummary(data.receivables);
      const paySummary = getPayableSummary(data.payables);
      const recRows = data.receivables
        .filter((r) => r.amount - r.amountReceived > 0)
        .map((r) => {
          const remaining = r.amount - r.amountReceived;
          const status = effectiveReceivableStatus(r);
          return `<tr><td>${r.description}</td><td>${status}</td><td class="num">${formatCurrency(remaining, r.currency)}</td></tr>`;
        })
        .join('');
      const payRows = data.payables
        .filter((p) => p.amount - p.amountPaid > 0)
        .map((p) => {
          const remaining = p.amount - p.amountPaid;
          const status = effectivePayableStatus(p);
          return `<tr><td>${p.description}</td><td>${status}</td><td class="num">${formatCurrency(remaining, p.currency)}</td></tr>`;
        })
        .join('');
      return reportShell(
        'Outstanding Payments',
        periodLabel,
        `<div class="summary-grid">
          <div class="summary-card"><div class="label">To collect</div><div class="value positive">${formatCurrency(recSummary.totalOutstanding)}</div></div>
          <div class="summary-card"><div class="label">Overdue receivable</div><div class="value negative">${formatCurrency(recSummary.overdueAmount)}</div></div>
          <div class="summary-card"><div class="label">To pay</div><div class="value negative">${formatCurrency(paySummary.totalOutstanding)}</div></div>
          <div class="summary-card"><div class="label">Overdue payable</div><div class="value negative">${formatCurrency(paySummary.overdueAmount)}</div></div>
        </div>
        <div class="section"><h2>Receivables</h2>
        <table><thead><tr><th>Description</th><th>Status</th><th class="num">Balance</th></tr></thead><tbody>${recRows || '<tr><td colspan="3">None outstanding</td></tr>'}</tbody></table></div>
        <div class="section"><h2>Payables</h2>
        <table><thead><tr><th>Description</th><th>Status</th><th class="num">Balance</th></tr></thead><tbody>${payRows || '<tr><td colspan="3">None outstanding</td></tr>'}</tbody></table></div>`,
      );
    }

    case 'cheque_maturity': {
      const summary = getChequeSummary(data.cheques);
      const inPeriod = data.cheques.filter((c) => {
        const m = c.maturityDate.toDate();
        return m >= range.start && m <= range.end;
      });
      const rows = inPeriod
        .map(
          (c) =>
            `<tr><td>${c.chequeNumber}</td><td>${c.bankName}</td><td>${c.direction}</td><td>${format(c.maturityDate.toDate(), 'dd MMM yyyy')}</td><td class="num">${formatCurrency(c.amount, c.currency)}</td></tr>`,
        )
        .join('');
      return reportShell(
        'Cheque Maturity',
        periodLabel,
        `<div class="summary-grid">
          <div class="summary-card"><div class="label">Pending cheques</div><div class="value">${summary.pendingCount}</div></div>
          <div class="summary-card"><div class="label">Pending total</div><div class="value">${formatCurrency(summary.pendingTotal)}</div></div>
          <div class="summary-card"><div class="label">Maturing in period</div><div class="value">${inPeriod.length}</div></div>
        </div>
        <div class="section"><h2>Cheques maturing</h2>
        <table><thead><tr><th>Number</th><th>Bank</th><th>Direction</th><th>Maturity</th><th class="num">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No cheques maturing in this period</td></tr>'}</tbody></table></div>`,
      );
    }

    default:
      return reportShell('Report', periodLabel, '<p>Unknown report type.</p>');
  }
}

export async function exportReportPdf(html: string, filename: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: filename });
}
