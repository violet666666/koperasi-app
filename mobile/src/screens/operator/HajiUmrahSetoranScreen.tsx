import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

/**
 * HajiUmrahSetoranScreen (Fase 9a.1 T6)
 *
 * Deposit form. Submits to POST /api/mobile/haji-umrah/savings/[accountId]/transactions.
 *
 * Field contract — matches the route + processHajiUmrahDeposit helper verbatim:
 *   Request body: { amount: number>0, paymentMethod: 'cash'|'qris'|'lainnya',
 *                   cashBankAccountId?: number, referenceNo?: string,
 *                   notes?: string, transactionDate?: 'YYYY-MM-DD' }
 *   Response: { data: <SavingsTransaction>, meta: { adminFee, balanceAfter,
 *              target, progress, isTargetReached } }
 *
 * cashBankAccountId is OPTIONAL: if omitted the deposit posts to savings balance
 * but no CashBankTransaction is created (warn the user). If provided, the helper
 * posts an "in" CB row (category 'savings') + a separate admin-fee CB row when
 * the product has an admin fee.
 *
 * Cash-account picker: reuses EXISTING GET /api/mobile/kas-bank → data.accounts[]:
 *   { id, code, name, type: 'cash'|'bank', bankName?, accountNumber?, currentBalance }
 *
 * Error surfacing mirrors PayrollImportScreen: error.response?.data?.message
 * (400/404/409 from HajiUmrahSavingsError carry exact helper messages).
 */

type PaymentMethod = 'cash' | 'qris' | 'lainnya';

type CashAccount = {
  id: number;
  code: string;
  name: string;
  type: string; // 'cash' | 'bank'
  bankName?: string | null;
  accountNumber?: string | null;
  currentBalance: number;
};

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'cash', label: 'Tunai', icon: 'cash-outline' },
  { value: 'qris', label: 'QRIS', icon: 'qr-code-outline' },
  { value: 'lainnya', label: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' },
];

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

/** Today as YYYY-MM-DD (local), for the transactionDate default. */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Validate YYYY-MM-DD. */
function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T12:00:00').getTime());
}

export default function HajiUmrahSetoranScreen({ route, navigation }: any) {
  const accountId: number = route?.params?.accountId;

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashAccountId, setCashAccountId] = useState<number | null>(null);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);

  // Fetch cash-bank accounts for the picker (optional but encouraged).
  const loadCashAccounts = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/kas-bank');
      const list: CashAccount[] = res.data?.data?.accounts ?? [];
      setCashAccounts(list);
    } catch (err) {
      // Non-fatal — picker just shows empty; deposit can still proceed without a CB account.
      log.warn('Setoran: failed to load cash accounts, picker will be empty:', err);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => { loadCashAccounts(); }, [loadCashAccounts]);

  const numericAmount = Number(amount.replace(/[^\d]/g, ''));

  const canSubmit =
    !submitting &&
    numericAmount > 0 &&
    isValidISODate(transactionDate);

  const selectedAccount = cashAccounts.find((a) => a.id === cashAccountId) || null;

  const onSubmit = async () => {
    if (numericAmount <= 0) {
      Alert.alert('Validasi', 'Jumlah setoran harus lebih dari 0.');
      return;
    }
    if (!isValidISODate(transactionDate)) {
      Alert.alert('Validasi', 'Tanggal tidak valid (format YYYY-MM-DD).');
      return;
    }

    // If no cash account selected, confirm the user understands no CB posting happens.
    if (!cashAccountId) {
      Alert.alert(
        'Setoran tanpa Akun Kas',
        'Setoran tanpa akun kas tidak tercatat di kas/bank. Saldo tabungan tetap bertambah, namun tidak ada mutasi Kas/Bank. Lanjutkan?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Lanjutkan', onPress: () => doSubmit() },
        ],
      );
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      // Build body — omit cashBankAccountId when no account is selected so the
      // helper skips the CashBank posting entirely (helper: `if (cashBankAccountId)`).
      const body: Record<string, unknown> = {
        amount: numericAmount,
        paymentMethod,
        transactionDate,
      };
      if (cashAccountId) body.cashBankAccountId = cashAccountId;
      const ref = referenceNo.trim();
      if (ref) body.referenceNo = ref;
      const nt = notes.trim();
      if (nt) body.notes = nt;

      const res = await api.post(
        `/api/mobile/haji-umrah/savings/${accountId}/transactions`,
        body,
      );
      const meta = res.data?.meta;
      const balanceAfter = Number(meta?.balanceAfter ?? 0);
      const progress = Number(meta?.progress ?? 0);

      const reached = Boolean(meta?.isTargetReached);
      const title = reached ? '🎉 Target Tercapai!' : 'Setoran Berhasil';
      const lines = [
        `Saldo: ${formatRp(balanceAfter)}`,
        `Progress: ${progress.toFixed(progress % 1 === 0 ? 0 : 1)}%`,
      ];
      if (Number(meta?.adminFee) > 0) {
        lines.push(`Admin Fee: ${formatRp(Number(meta.adminFee))}`);
      }
      if (reached) {
        lines.push('Selamat! Target tabungan telah tercapai. 🕋');
      }

      Alert.alert(title, lines.join('\n'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      // Surface 400/404/409 helper messages verbatim.
      const msg = err?.response?.data?.message || err?.message || 'Gagal membuat setoran.';
      log.error('Setoran submit failed:', err);
      Alert.alert('Gagal Setoran', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Render a cash-account option row inside the picker.
  const renderAccountOption = (acc: CashAccount) => {
    const selected = acc.id === cashAccountId;
    return (
      <TouchableOpacity
        key={acc.id}
        style={[styles.optionRow, selected && styles.optionRowActive]}
        onPress={() => { setCashAccountId(acc.id); setPickerOpen(false); }}
      >
        <Ionicons
          name={acc.type === 'bank' ? 'business-outline' : 'wallet-outline'}
          size={20}
          color={selected ? C.accent : C.mutedForeground}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.optionName} numberOfLines={1}>
            {acc.code} • {acc.name}
          </Text>
          <Text style={styles.optionSub} numberOfLines={1}>
            {acc.type === 'bank' && acc.bankName ? `${acc.bankName}` : acc.type === 'bank' ? 'Bank' : 'Kas'}
            {acc.accountNumber ? ` • ${acc.accountNumber}` : ''}
            {'  •  Saldo '}{formatRp(acc.currentBalance)}
          </Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={C.accent} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Setoran Haji / Umrah</Text>
          <Text style={styles.headerSub}>Rekening #{accountId}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount */}
        <Text style={styles.label}>Jumlah Setoran *</Text>
        <View style={styles.amountInput}>
          <Text style={styles.currencyPrefix}>Rp</Text>
          <TextInput
            style={styles.amountField}
            placeholder="0"
            placeholderTextColor={C.mutedForeground}
            keyboardType="numeric"
            value={amount ? Number(numericAmount).toLocaleString('id-ID') : ''}
            onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
          />
        </View>
        {numericAmount > 0 ? (
          <Text style={styles.helperText}>{formatRp(numericAmount)}</Text>
        ) : null}

        {/* Payment method */}
        <Text style={styles.label}>Metode Pembayaran</Text>
        <View style={styles.pmRow}>
          {PAYMENT_OPTIONS.map((opt) => {
            const active = paymentMethod === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pmBtn, active && styles.pmBtnActive]}
                onPress={() => setPaymentMethod(opt.value)}
              >
                <Ionicons name={opt.icon} size={18} color={active ? '#FFF' : C.mutedForeground} />
                <Text style={[styles.pmBtnText, active && styles.pmBtnTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cash/Bank account picker (OPTIONAL) */}
        <Text style={styles.label}>Akun Kas / Bank (Opsional)</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setPickerOpen((v) => !v)}
        >
          <Ionicons
            name={selectedAccount
              ? (selectedAccount.type === 'bank' ? 'business' : 'wallet')
              : 'wallet-outline'}
            size={20}
            color={C.primary}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            {selectedAccount ? (
              <>
                <Text style={styles.pickerName} numberOfLines={1}>
                  {selectedAccount.code} • {selectedAccount.name}
                </Text>
                <Text style={styles.pickerSub} numberOfLines={1}>
                  {selectedAccount.type === 'bank' && selectedAccount.bankName
                    ? selectedAccount.bankName
                    : selectedAccount.type === 'bank' ? 'Bank' : 'Kas'}
                  {selectedAccount.accountNumber ? ` • ${selectedAccount.accountNumber}` : ''}
                  {'  •  Saldo '}{formatRp(selectedAccount.currentBalance)}
                </Text>
              </>
            ) : (
              <Text style={styles.pickerPlaceholder}>
                {accountsLoading ? 'Memuat akun...' : 'Pilih akun (opsional)'}
              </Text>
            )}
          </View>
          <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
        </TouchableOpacity>

        {pickerOpen ? (
          <View style={styles.pickerList}>
            {/* Explicit "no account" option */}
            <TouchableOpacity
              style={[styles.optionRow, cashAccountId === null && styles.optionRowActive]}
              onPress={() => { setCashAccountId(null); setPickerOpen(false); }}
            >
              <Ionicons name="close-circle-outline" size={20} color={C.mutedForeground} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.optionName}>Tanpa akun kas</Text>
                <Text style={styles.optionSub}>Tidak tercatat di kas/bank</Text>
              </View>
              {cashAccountId === null ? <Ionicons name="checkmark-circle" size={20} color={C.accent} /> : null}
            </TouchableOpacity>
            {cashAccounts.length === 0 && !accountsLoading ? (
              <Text style={styles.pickerEmpty}>Tidak ada akun kas/bank aktif.</Text>
            ) : (
              cashAccounts.map(renderAccountOption)
            )}
          </View>
        ) : null}

        {/* Warning when no account selected */}
        {!cashAccountId ? (
          <View style={styles.warnBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.warning} />
            <Text style={styles.warnText}>
              Setoran tanpa akun kas tidak tercatat di kas/bank.
            </Text>
          </View>
        ) : null}

        {/* Reference No */}
        <Text style={styles.label}>No. Referensi (Opsional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Contoh: bukti transfer / kwitansi"
          placeholderTextColor={C.mutedForeground}
          value={referenceNo}
          onChangeText={setReferenceNo}
          maxLength={100}
        />

        {/* Notes */}
        <Text style={styles.label}>Catatan (Opsional)</Text>
        <TextInput
          style={[styles.textInput, { minHeight: 70 }]}
          placeholder="Catatan tambahan..."
          placeholderTextColor={C.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />

        {/* Transaction date */}
        <Text style={styles.label}>Tanggal Transaksi</Text>
        <TextInput
          style={styles.textInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.mutedForeground}
          value={transactionDate}
          onChangeText={setTransactionDate}
          maxLength={10}
        />
        {!isValidISODate(transactionDate) ? (
          <Text style={styles.errorText}>Format tanggal harus YYYY-MM-DD.</Text>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Proses Setoran</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.8, marginTop: 2 },

  label: { fontSize: 13, fontWeight: 'bold', color: C.primary, marginBottom: 8, marginLeft: 2, marginTop: 16 },

  // Amount input
  amountInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.muted, paddingHorizontal: 14,
  },
  currencyPrefix: { fontSize: 18, fontWeight: 'bold', color: C.mutedForeground, marginRight: 8 },
  amountField: { flex: 1, paddingVertical: 14, fontSize: 20, fontWeight: 'bold', color: C.foreground },
  helperText: { fontSize: 11, color: C.mutedForeground, marginTop: 4, marginLeft: 2 },

  // Payment method
  pmRow: { flexDirection: 'row', gap: 8 },
  pmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.muted, backgroundColor: C.card,
  },
  pmBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  pmBtnText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  pmBtnTextActive: { color: '#FFF', fontWeight: 'bold' },

  // Cash account picker
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.muted, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  pickerSub: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  pickerPlaceholder: { fontSize: 14, color: C.mutedForeground },
  pickerList: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.muted,
    marginTop: 8, padding: 6, overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8,
  },
  optionRowActive: { backgroundColor: C.accentBg },
  optionName: { fontSize: 13, fontWeight: '600', color: C.foreground },
  optionSub: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  pickerEmpty: { fontSize: 12, color: C.mutedForeground, padding: 12, textAlign: 'center' },

  // Warning
  warnBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
  },
  warnText: { flex: 1, fontSize: 12, color: C.warning, fontWeight: '600' },

  // Text inputs
  textInput: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.muted,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.foreground,
  },
  errorText: { fontSize: 11, color: C.destructive, marginTop: 4, marginLeft: 2 },

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, paddingVertical: 15, borderRadius: 12, marginTop: 28,
  },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 6 },
});
