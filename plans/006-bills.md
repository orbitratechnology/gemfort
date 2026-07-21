# 006 — Gem Trader Bills

Personal, owner-only tracking for amounts you owe (`payable`) and amounts owed to you (`receivable`), with optional commission %, due-date reminders **to you only**, Ongoing strip cards, and Money ledger writes when recording payment.

## Decisions

- **Privacy:** Bills are **private personal tracking**. Contact names are labels only. Reminders/push go **only** to `ownerUid`. Nothing is sent to contacts, counterparties, or other GemFort users.
- **Direction:** both — `payable` | `receivable`
- **Money:** on payment, write `gemtrack_payments` + ledger transactions. Face amount settles the bill; commission is taken from each payment — **payable** → net expense + commission income for you; **receivable** → net income + commission expense for the counterparty (on your books only).
- **Reminder:** FCM `bill_due_today` on the due date (Asia/Colombo daily job) to the bill owner only
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
| gemId | string \| null | Primary / legacy single gem |
| gemIds | string[] | Linked stones (optional) |
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

- Type: `bill_due_today` — **recipient is always the bill owner** (`recipientUid === ownerUid`)
- Pref: `pushBillAlerts` (default on)
- Deep link: `referenceType === 'bill'` → bill detail
- Daily job: open/partial/overdue bills with `dueDate` = today → notify owner only
- Contact / counterparty fields are display labels in the message — never notification recipients

## Deploy

```bash
firebase deploy --only firestore
firebase deploy --only functions:dailyGemTrackNotifications
```

Verify: rules/indexes live; sample bill; function logs for `dailyGemTrackNotifications`.
