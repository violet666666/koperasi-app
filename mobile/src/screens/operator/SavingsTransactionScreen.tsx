import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

interface Account {
  id: number;
  accountNo: string;
  balance: number;
  productName: string;
  productType?: string; // pokok, wajib, sukarela
}

interface CashBankAccount {
  id: number;
  code: string;
  name: string;
  type: 'cash' | 'bank';
  currentBalance: number;
}

export default function SavingsTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { memberId, memberName } = route.params || {};

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [selectedCashBankId, setSelectedCashBankId] = useState<number | null>(null);
  const [showCashBankPicker, setShowCashBankPicker] = useState(false);

  useEffect(() => {
    if (!memberId) {
      Alert.alert('Error', 'Data Anggota tidak valid');
      navigation.goBack();
      return;
    }

    const fetchData = async () => {
      try {
        const [accRes, cashRes] = await Promise.all([
          api.get(`/api/mobile/savings-tx?memberId=${memberId}`),
          api.get('/api/mobile/kas-bank'),
        ]);
        const data = accRes.data.data || [];
        setAccounts(data);
        if (data.length > 0) setSelectedAccount(data[0]);

        const cashAccounts = cashRes.data?.data?.accounts || [];
        setCashBankAccounts(cashAccounts);
        if (cashAccounts.length > 0) {
          const kas = cashAccounts.find((a: CashBankAccount) => a.type === 'cash') || cashAccounts[0];
          setSelectedCashBankId(kas.id);
        }
      } catch (err: any) {
        Alert.alert('Gagal', err.response?.data?.message || 'Gagal memuat rekening');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [memberId, navigation]);

  // M-FEAT-018: Blokir penarikan Simpanan Wajib & Pokok (AD-ART Pasal 26)
  const isProtectedAccount = selectedAccount?.productType === 'wajib' || selectedAccount?.productType === 'pokok';
  const withdrawalBlocked = type === 'withdrawal' && isProtectedAccount;

  const selectedCashBank = cashBankAccounts.find(a => a.id === selectedCashBankId);

  const handleSubmit = () => {
    if (!selectedAccount) return Alert.alert('Error', 'Pilih rekening terlebih dahulu');
    if (!selectedCashBankId) return Alert.alert('Error', 'Pilih akun Kas/Bank tujuan');
    if (withdrawalBlocked) return Alert.alert('Ditolak', 'Penarikan Simpanan Wajib/Pokok tidak diperbolehkan (AD-ART Pasal 26)');
    const numAmt = parseInt(amount.replace(/\D/g, ''), 10);
    if (isNaN(numAmt) || numAmt <= 0) return Alert.alert('Error', 'Jumlah harus lebih dari 0');

    if (type === 'withdrawal' && numAmt > selectedAccount.balance) {
      return Alert.alert('Gagal', `Saldo tidak mencukupi. Maksimal: ${formatRp(selectedAccount.balance)}`);
    }

    Alert.alert(
      'Konfirmasi',
      `${type === 'deposit' ? 'Setoran' : 'Penarikan'} sebesar ${formatRp(numAmt)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Lanjutkan',
          onPress: async () => {
            setSubmitting(true);
            try {
              await api.post('/api/mobile/savings-tx', {
                accountId: selectedAccount.id,
                amount: numAmt,
                type,
                description: notes,
                cashBankAccountId: selectedCashBankId,
              });
              Alert.alert('Sukses', 'Transaksi berhasil disimpan', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal memproses transaksi');
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
        <Text style={styles.headerTitle}>Transaksi Simpanan</Text>
      </View>

      <ScrollView style={{ padding: 16 }}>
        <Text style={styles.label}>Anggota</Text>
        <TextInput style={[styles.input, { backgroundColor: C.muted, color: C.mutedForeground }]} value={memberName} editable={false} />

        <Text style={styles.label}>Rekening Simpanan</Text>
        {accounts.length === 0 ? (
          <Text style={{ color: C.destructive, marginBottom: 16 }}>Anggota ini tidak memiliki rekening simpanan aktif.</Text>
        ) : (
          <View style={styles.accountList}>
            {accounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.accountCard, selectedAccount?.id === acc.id && styles.accountCardActive]}
                onPress={() => setSelectedAccount(acc)}
              >
                <Text style={[styles.accName, selectedAccount?.id === acc.id && { color: '#FFF' }]}>{acc.productName}</Text>
                <Text style={[styles.accBal, selectedAccount?.id === acc.id && { color: C.accentLight }]}>
                  Saldo: {formatRp(acc.balance)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Jenis Transaksi</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'deposit' && { backgroundColor: C.success }]}
            onPress={() => setType('deposit')}
          >
            <Ionicons name="arrow-down-circle" size={20} color={type === 'deposit' ? '#FFF' : C.mutedForeground} />
            <Text style={[styles.typeText, type === 'deposit' && { color: '#FFF' }]}>Setoran</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'withdrawal' && { backgroundColor: C.destructive }, withdrawalBlocked && { opacity: 0.4 }]}
            onPress={() => {
              if (isProtectedAccount) {
                Alert.alert('Tidak Diizinkan', 'Penarikan Simpanan Wajib/Pokok tidak diperbolehkan sesuai AD-ART Pasal 26.');
                return;
              }
              setType('withdrawal');
            }}
          >
            <Ionicons name="arrow-up-circle" size={20} color={type === 'withdrawal' ? '#FFF' : C.mutedForeground} />
            <Text style={[styles.typeText, type === 'withdrawal' && { color: '#FFF' }]}>Penarikan</Text>
          </TouchableOpacity>
        </View>
        {isProtectedAccount && type === 'withdrawal' && (
          <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="warning" size={18} color={C.destructive} />
            <Text style={{ color: C.destructive, fontSize: 12, flex: 1 }}>Penarikan Simpanan Wajib/Pokok tidak diperbolehkan (AD-ART Pasal 26)</Text>
          </View>
        )}

        <Text style={styles.label}>Jumlah (Rp)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          keyboardType="numeric"
          value={amount}
          onChangeText={(val) => {
            const num = parseInt(val.replace(/\D/g, ''), 10);
            setAmount(isNaN(num) ? '' : num.toLocaleString('id-ID'));
          }}
        />

        <Text style={styles.label}>Tujuan Kas / Bank *</Text>
        <TouchableOpacity
          style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => setShowCashBankPicker(!showCashBankPicker)}
        >
          <Text style={{ color: selectedCashBank ? C.foreground : C.mutedForeground, fontSize: 16 }}>
            {selectedCashBank ? `${selectedCashBank.type === 'cash' ? '💵' : '🏦'} ${selectedCashBank.name}` : 'Pilih Kas/Bank...'}
          </Text>
          <Ionicons name={showCashBankPicker ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
        </TouchableOpacity>
        {showCashBankPicker && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
            {cashBankAccounts.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[
                  { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                  selectedCashBankId === acc.id && { backgroundColor: C.accent + '15' }
                ]}
                onPress={() => { setSelectedCashBankId(acc.id); setShowCashBankPicker(false); }}
              >
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>
                    {acc.type === 'cash' ? '💵' : '🏦'} {acc.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>
                    Saldo: {formatRp(acc.currentBalance)}
                  </Text>
                </View>
                {selectedCashBankId === acc.id && (
                  <Ionicons name="checkmark-circle" size={20} color={C.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Keterangan (Opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Setoran / Penarikan"
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[styles.submitBtn, (!selectedAccount || submitting || !amount || !selectedCashBankId || withdrawalBlocked) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={!selectedAccount || submitting || !amount || !selectedCashBankId || withdrawalBlocked}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#FFF" />
              <Text style={styles.submitText}>Simpan Transaksi</Text>
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
  accountList: { gap: 8, marginBottom: 8 },
  accountCard: {
    padding: 14, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border
  },
  accountCardActive: { backgroundColor: C.primary, borderColor: C.primary },
  accName: { fontSize: 15, fontWeight: '600', color: C.foreground },
  accBal: { fontSize: 13, color: C.mutedForeground, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.card, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border
  },
  typeText: { fontSize: 14, fontWeight: '600', color: C.mutedForeground },
  submitBtn: {
    backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, marginTop: 24,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8
  },
  submitText: { color: C.primary, fontSize: 16, fontWeight: 'bold' }
});
