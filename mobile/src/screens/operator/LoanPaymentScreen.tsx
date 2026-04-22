import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, StatusBar, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

interface Loan {
  id: number;
  loanNo: string;
  productName: string;
  principalAmount: number;
  principalOutstanding: number;
  interestOutstanding: number;
  interestRate: number;
  monthlyInstallment: number;
  tenor: number;
}

interface CashBankAccount {
  id: number;
  code: string;
  name: string;
  type: 'cash' | 'bank';
  currentBalance: number;
}

export default function LoanPaymentScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { memberId, memberName } = route.params || {};

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [isEarlySettlement, setIsEarlySettlement] = useState(false);

  useEffect(() => {
    if (!memberId) {
      Alert.alert('Error', 'Data Anggota tidak valid');
      navigation.goBack();
      return;
    }

    const fetchLoans = async () => {
      try {
        const [loansRes, accountsRes] = await Promise.all([
          api.get(`/api/mobile/loan-payment?memberId=${memberId}`),
          api.get('/api/mobile/kas-bank'),
        ]);
        const data = loansRes.data.data || [];
        setLoans(data);
        if (data.length > 0) {
          setSelectedLoan(data[0]);
          setAmount(data[0].monthlyInstallment.toString());
        }
        const accounts = accountsRes.data?.data || [];
        setCashBankAccounts(accounts);
        if (accounts.length > 0) {
          const kasAccount = accounts.find((a: CashBankAccount) => a.type === 'cash') || accounts[0];
          setSelectedAccountId(kasAccount.id);
        }
      } catch (err: any) {
        Alert.alert('Gagal', err.response?.data?.message || 'Gagal memuat pinjaman');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [memberId, navigation]);

  // ═══ Early Settlement Calculation ═══
  const settlement = useMemo(() => {
    if (!selectedLoan || !isEarlySettlement) return null;
    const principalAmount = selectedLoan.principalAmount;
    const interestRate = selectedLoan.interestRate || 1;
    const monthlyInterest = Math.round(principalAmount * (interestRate / 100));
    const penaltyMultiplier = selectedLoan.tenor <= 24 ? 1 : 2;
    const penaltyFee = monthlyInterest * penaltyMultiplier;
    const remainingPrincipal = selectedLoan.principalOutstanding;
    const total = remainingPrincipal + penaltyFee;

    return { remainingPrincipal, penaltyFee, penaltyMultiplier, monthlyInterest, total };
  }, [selectedLoan, isEarlySettlement]);

  // When toggling settlement mode, auto-fill amount
  useEffect(() => {
    if (isEarlySettlement && settlement) {
      setAmount(settlement.total.toString());
    } else if (selectedLoan) {
      setAmount(selectedLoan.monthlyInstallment.toString());
    }
  }, [isEarlySettlement, settlement, selectedLoan]);

  const selectedAccount = cashBankAccounts.find(a => a.id === selectedAccountId);

  const handleSubmit = () => {
    if (!selectedLoan) return Alert.alert('Error', 'Pilih pinjaman terlebih dahulu');
    if (!selectedAccountId) return Alert.alert('Error', 'Pilih akun Kas/Bank tujuan');
    const numAmt = parseInt(amount.replace(/\D/g, ''), 10);
    if (isNaN(numAmt) || numAmt <= 0) return Alert.alert('Error', 'Jumlah harus lebih dari 0');

    if (!isEarlySettlement) {
      const totalOut = selectedLoan.principalOutstanding + selectedLoan.interestOutstanding;
      if (numAmt > totalOut) {
        return Alert.alert('Error', `Jumlah melebihi sisa pinjaman (${formatRp(totalOut)})`);
      }
    }

    const confirmTitle = isEarlySettlement ? '⚡ Pelunasan Dipercepat' : 'Konfirmasi';
    const confirmMsg = isEarlySettlement
      ? `Lunasi pinjaman ${selectedLoan.loanNo} sebesar ${formatRp(numAmt)}?\n\n• Sisa Pokok: ${formatRp(settlement!.remainingPrincipal)}\n• Bunga/Jasa: Rp 0 (tidak dikenakan)\n• Penalti (${settlement!.penaltyMultiplier}× bunga): ${formatRp(settlement!.penaltyFee)}\n\nPinjaman akan berstatus LUNAS.`
      : `Bayar angsuran sebesar ${formatRp(numAmt)}?`;

    Alert.alert(
      confirmTitle,
      confirmMsg,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: isEarlySettlement ? '⚡ Lunasi' : 'Bayar',
          style: isEarlySettlement ? 'destructive' : 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const payload: any = {
                loanId: selectedLoan.id,
                amount: numAmt,
                notes: notes || (isEarlySettlement ? 'Pelunasan Dipercepat via mobile' : undefined),
                cashBankAccountId: selectedAccountId,
              };
              if (isEarlySettlement) {
                payload.isEarlySettlement = true;
              }
              const res = await api.post('/api/mobile/loan-payment', payload);
              Alert.alert('Sukses ✅', res.data?.message || 'Berhasil diproses', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal memproses');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bayar Angsuran</Text>
      </View>

      <ScrollView style={{ padding: 16 }}>
        <Text style={styles.label}>Anggota</Text>
        <TextInput style={[styles.input, { backgroundColor: C.muted, color: C.mutedForeground }]} value={memberName} editable={false} />

        <Text style={styles.label}>Pilih Pinjaman</Text>
        {loans.length === 0 ? (
          <Text style={{ color: C.destructive, marginBottom: 16 }}>Anggota ini tidak memiliki pinjaman aktif.</Text>
        ) : (
          <View style={styles.loanList}>
            {loans.map((loan) => {
              const totalOut = loan.principalOutstanding + loan.interestOutstanding;
              const isActive = selectedLoan?.id === loan.id;
              return (
                <TouchableOpacity
                  key={loan.id}
                  style={[styles.loanCard, isActive && styles.loanCardActive]}
                  onPress={() => {
                    setSelectedLoan(loan);
                    setIsEarlySettlement(false);
                    setAmount(loan.monthlyInstallment.toString());
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={[styles.loanName, isActive && { color: '#FFF' }]}>{loan.productName}</Text>
                    <Text style={[styles.loanNo, isActive && { color: C.accentLight }]}>{loan.loanNo}</Text>
                  </View>
                  <Text style={[styles.loanDetail, isActive && { color: C.accentBg }]}>
                    Sisa: {formatRp(totalOut)}
                  </Text>
                  <Text style={[styles.loanDetail, isActive && { color: C.accentBg }]}>
                    Cicilan/bln: {formatRp(loan.monthlyInstallment)} · Tenor: {loan.tenor} bln
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ═══ Toggle Pelunasan Dipercepat ═══ */}
        {selectedLoan && (
          <View style={styles.settlementToggle}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>⚡ Pelunasan Dipercepat</Text>
              <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>Lunasi seluruh sisa pokok + penalti sekaligus</Text>
            </View>
            <Switch
              value={isEarlySettlement}
              onValueChange={setIsEarlySettlement}
              trackColor={{ false: C.border, true: '#F59E0B' }}
              thumbColor={isEarlySettlement ? '#FFF' : '#FFF'}
            />
          </View>
        )}

        {/* ═══ Settlement Breakdown ═══ */}
        {isEarlySettlement && settlement && (
          <View style={styles.settlementCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="warning" size={16} color="#D97706" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#D97706' }}>Rincian Pelunasan</Text>
            </View>

            {/* Aturan penalti */}
            <View style={styles.ruleBox}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400E' }}>Aturan Biaya Pelunasan:</Text>
              <Text style={{ fontSize: 11, color: '#92400E' }}>• Tenor ≤ 24 bulan → Penalti 1× bunga bulanan</Text>
              <Text style={{ fontSize: 11, color: '#92400E' }}>• Tenor {'>'} 24 bulan → Penalti 2× bunga bulanan</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400E', marginTop: 4 }}>
                Pinjaman ini: Tenor {selectedLoan!.tenor} bln → Penalti {settlement.penaltyMultiplier}× bunga ({formatRp(settlement.monthlyInterest)}/bln)
              </Text>
            </View>

            {/* Breakdown */}
            <View style={{ gap: 6 }}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Sisa Pokok</Text>
                <Text style={styles.breakdownValue}>{formatRp(settlement.remainingPrincipal)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: '#059669' }]}>Bunga / Jasa</Text>
                <Text style={[styles.breakdownValue, { color: '#059669' }]}>Rp 0 (tidak dikenakan)</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: '#D97706', fontWeight: '600' }]}>
                  Penalti ({settlement.penaltyMultiplier}× bunga)
                </Text>
                <Text style={[styles.breakdownValue, { color: '#D97706', fontWeight: '700' }]}>
                  {formatRp(settlement.penaltyFee)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.breakdownRow}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.primary }}>TOTAL PELUNASAN</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.primary }}>{formatRp(settlement.total)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ═══ Jumlah Bayar ═══ */}
        {!isEarlySettlement && (
          <>
            <Text style={styles.label}>Jumlah Bayar (Rp)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              keyboardType="numeric"
              value={amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              onChangeText={(val) => {
                const num = parseInt(val.replace(/\D/g, ''), 10);
                setAmount(isNaN(num) ? '' : num.toString());
              }}
            />
          </>
        )}

        <Text style={styles.label}>Tujuan Kas / Bank *</Text>
        <TouchableOpacity
          style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => setShowAccountPicker(!showAccountPicker)}
        >
          <Text style={{ color: selectedAccount ? C.foreground : C.mutedForeground, fontSize: 16 }}>
            {selectedAccount ? `${selectedAccount.type === 'cash' ? '💵' : '🏦'} ${selectedAccount.name}` : 'Pilih Kas/Bank...'}
          </Text>
          <Ionicons name={showAccountPicker ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
        </TouchableOpacity>
        {showAccountPicker && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
            {cashBankAccounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[
                  { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                  selectedAccountId === acc.id && { backgroundColor: C.accent + '15' }
                ]}
                onPress={() => { setSelectedAccountId(acc.id); setShowAccountPicker(false); }}
              >
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>
                    {acc.type === 'cash' ? '💵' : '🏦'} {acc.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>
                    Saldo: {formatRp(acc.currentBalance)}
                  </Text>
                </View>
                {selectedAccountId === acc.id && (
                  <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Keterangan (Opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Catatan..."
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[
            isEarlySettlement ? styles.settlementBtn : styles.submitBtn,
            (!selectedLoan || submitting || !amount || !selectedAccountId) && { opacity: 0.5 }
          ]}
          onPress={handleSubmit}
          disabled={!selectedLoan || submitting || !amount || !selectedAccountId}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name={isEarlySettlement ? "flash" : "card"} size={20} color={isEarlySettlement ? "#FFF" : C.primary} />
              <Text style={[styles.submitText, isEarlySettlement && { color: '#FFF' }]}>
                {isEarlySettlement ? `⚡ Lunasi ${formatRp(settlement?.total || 0)}` : 'Proses Pembayaran'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 13, color: C.mutedForeground, marginBottom: 8, fontWeight: '600', marginTop: 12 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: C.foreground, marginBottom: 8
  },
  loanList: { gap: 8, marginBottom: 8 },
  loanCard: {
    padding: 14, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border
  },
  loanCardActive: { backgroundColor: C.primary, borderColor: C.primary },
  loanName: { fontSize: 15, fontWeight: '600', color: C.foreground },
  loanNo: { fontSize: 12, color: C.mutedForeground },
  loanDetail: { fontSize: 13, color: C.mutedForeground, marginTop: 4 },
  // Settlement toggle
  settlementToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12,
    padding: 14, marginTop: 8, marginBottom: 4,
  },
  // Settlement card
  settlementCard: {
    backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#F59E0B80', borderRadius: 12,
    padding: 16, marginTop: 8, marginBottom: 4,
  },
  ruleBox: {
    backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  breakdownLabel: { fontSize: 13, color: C.mutedForeground },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: C.foreground },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  submitBtn: {
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, marginTop: 24,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8
  },
  settlementBtn: {
    backgroundColor: '#D97706', paddingVertical: 16, borderRadius: 12, marginTop: 24,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8
  },
  submitText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
