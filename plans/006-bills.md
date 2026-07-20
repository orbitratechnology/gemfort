# 006 — Gem Trader Bills

Bidirectional bills for traders: amounts you owe (`payable`) and amounts owed to you (`receivable`), with optional commission %, due-date reminders, Ongoing strip cards, and Money ledger writes when recording payment.

## Decisions

- **Direction:** both — `payable` | `receivable`
- **Money:** on payment, write `gemtrack_payments` + `gemtrack_transactions` (expense/income), applying stored `commissionPercent`
- **Reminder:** FCM `bill_due_today` on the due date (Asia/Colombo daily job), not “tomorrow”
- **Roles:** `bills` module — trader + admin
- **Firebase:** project `gemfort`, region `asia-south1`

## Schema (`gemtrack_bills`)

| Field | Type | Notes |
| --- | --- | --- |
| ownerUid | string | |
| direction | `payable` \| `receivable` | |
| amount | number | |
| currency | string | default LKR |
| amountBase | number | |
| amountSettled | number | paid/received so far |
| commissionPercent | number \| null | 0–100 |
| counterpartyContactId | string | |
| dueDate | Timestamp | |
| status | `open` \| `partial` \| `paid` \| `cancelled` \| `overdue` | |
| gemId | string \| null | |
| notes | string \| null | |
| createdAt / updatedAt | Timestamp | |

`Payment.billId` links settlement rows. Index: `ownerUid` + `dueDate`.

## Routes

| Path | Purpose |
| --- | --- |
| `workspace/bills` | List open / settled |
| `workspace/bills/add` | Create |
| `workspace/bills/[billId]` | Detail, record payment, cancel |

## Client services

- CRUD: `fetchBills`, `fetchBill`, `createBill`, `updateBill`, `updateBillStatus`
- `recordBillPayment` — settle + transaction + payment (mirrors receivable/payable)
- Utils: `bill-utils.ts` (`isOpenBill`, `detectBillsDueToday`, …)
- Form: `addBillSchema`

## Notifications

- Type: `bill_due_today` (client + Cloud Functions)
- Pref: `pushBillAlerts` (default on)
- Deep link: `referenceType === 'bill'` → bill detail
- Daily job loads `gemtrack_bills`; open/partial/overdue with `dueDate` = today → candidate

## Deploy

```bash
firebase deploy --only firestore
firebase deploy --only functions:dailyGemTrackNotifications
```

Verify: rules/indexes live; sample bill; function logs for `dailyGemTrackNotifications`.
