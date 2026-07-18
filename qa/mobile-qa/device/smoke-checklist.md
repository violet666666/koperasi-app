# Phase C — Android Physical Device Smoke Checklist

**Build target:** PRIMKOPPOL v1.1.8 / versionCode 10 (`a4802c47`)
**Mode:** READ-ONLY. Do not create, edit, approve, void, import, transfer, settle, or delete production records.
**Device:** User-owned physical Android.

## Install / update

- [ ] Download vc10 APK artifact.
- [ ] Confirm file source is `expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/...`.
- [ ] Install as upgrade over existing app (do not uninstall first; verifies migration/session behavior).
- [ ] Open app; splash completes, no crash.
- [ ] If old session is invalid, login again; expected due JWT lifecycle.
- [ ] Confirm version shown (if UI exposes it): 1.1.8 / vc10.

## Operator regression — QA remediation focus

Login: `operator@koperasi.com` (testing account from `akun-primkoppol.md`).

- [ ] Dashboard loads.
- [ ] **Piutang Gabungan**: list loads (not 404), totals visible.
- [ ] Piutang Gabungan: search member; open drill-down; member detail visible.
- [ ] Piutang Gabungan: CSV export opens Android share sheet (cancel sharing; no data mutation).
- [ ] **Arus Kas**: opens without forced logout; current month cards show opening/closing + operating/investing/financing.
- [ ] Arus Kas: change month; data reloads; no logout.
- [ ] **Faktur Potongan**: opens without forced logout; list + totals visible.
- [ ] Faktur Potongan: change month; data reloads.
- [ ] **Loan Applications**: list loads; scroll to page 2 when >15 rows; new rows append.
- [ ] **Haji/Umrah → Talangan**: stats cards are non-zero where production has active data; list loads.
- [ ] **Aset → Detail**: detail opens. Do NOT dispose/delete. Verify no immediate crash.
- [ ] **Member Detail**: open any test/non-sensitive member from list; Piutang Barang section loads.
- [ ] Member Detail: expand Riwayat Transaksi; rows or honest empty state loads; app does NOT force logout.

## Admin unit isolation — read-only

Use at least one available admin account:
- `admintoko@koperasi.com` / unit toko
- `admincafe@koperasi.com` / unit resto_cafe
- `admincafelsp@koperasi.com` / unit cafe_lsp
- `adminhajiumrah@koperasi.com` / unit haji_umrah

- [ ] Login admin toko: Toko/Unit Laporan toko opens.
- [ ] Admin toko cannot navigate to another unit’s restricted menu/data.
- [ ] Login admin resto/cafe: own unit report opens.
- [ ] Login admin Haji/Umrah: own H&U screens open; other unit restricted data absent.
- [ ] No admin session is forced-logged-out when opening a valid read screen.

## Anggota self-scope — read-only

Login NRP `86030500`.

- [ ] Dashboard summary loads own data.
- [ ] Simpanan loads own accounts only.
- [ ] Pinjaman loads own loans only.
- [ ] Transaksi loads own history only.
- [ ] Staff/operator menus are absent.

## Network / lifecycle

- [ ] Put app in background for 30 seconds; resume; same screen remains usable.
- [ ] Toggle airplane mode while on a read-only report, pull-to-refresh: clear network error appears; no crash.
- [ ] Restore network, retry/refresh succeeds.
- [ ] No spontaneous logout except on genuinely expired/invalid JWT.

## Evidence to record

For each failed row record:
- Screen name
- Account role/unit
- Exact visible error text
- Screenshot filename
- Whether app logged out
- Whether retry worked

## Mutation gate (NOT part of this smoke run)

Any transaction test requires a separate explicit approval, pre-snapshot, QA marker, manifest, known void/reversal cleanup, and post-cleanup reconciliation. Do not perform mutation tests during this checklist.