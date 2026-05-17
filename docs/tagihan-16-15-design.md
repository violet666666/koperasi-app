# Tagihan Piutang 16-15 — Design Spec

**Date:** 2026-05-16
**Status:** Approved & Implemented
**Approach:** A (Billing Period + Transaction Linking)

## Overview
Billing system with cycle 16th to 15th, per-member aggregation, hybrid settlement (auto-generate + operator confirms), flexible mark-as-paid per item/member.

## Data Model
- `BillingPeriod`: periodStart (16th), periodEnd (15th), status (draft/processed), audit fields
- `BillingItem`: per-transaction item linked to member + period, isMarkedPaid toggle

## Routes
- `/tagihan` — Dashboard with generate, toggle, process, delete draft actions
- `/tagihan/[periodId]` — Rekap per member + expandable detail
- `/tagihan/riwayat` — History

## API
- `POST /api/billing/generate` — Generate draft
- `GET /api/billing/current` — Active period
- `GET /api/billing/[periodId]` — Detail + items
- `DELETE /api/billing/[periodId]` — Delete draft period (cascade deletes items) — *Added 17 Mei 2026*
- `POST /api/billing/[periodId]/process` — Settlement
- `PATCH /api/billing/[periodId]/items/[itemId]/toggle` — Manual toggle

## Settlement Logic
- Process only draft periods
- Mark isPaid=true on UnitTransaction/StoreSale where isMarkedPaid=true
- Skip items where isMarkedPaid=false
- Update period status to processed
- Plafon resets automatically (outstanding decreases)

## Draft Management
- Operator can delete draft periods (DELETE /api/billing/[periodId])
- Only drafts can be deleted — processed periods are immutable
- Deleting a draft allows regeneration for the same period
- UI shows red "Hapus Draft" button when period is in draft status

## Sidebar
New group "TAGIHAN" with roles ["operator"], permission "manage_all"
