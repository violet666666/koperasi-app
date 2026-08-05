# Fase 13b — Faktur Potongan READ-ONLY Plan
# Fase 18a — Arus Kas READ-ONLY Plan  
# Fase 12b — Loan Applications VIEW Plan

## Tasks: each is 1 GET endpoint + 1 screen

### 13b Faktur Potongan
- GET `/mobile/reports/faktur-potongan?month&year`
- FakturPotonganScreen: month picker + FlatList + detail modal

### 18a Arus Kas
- GET `/mobile/reports/arus-kas?month&year` (reuse existing web SQL query pattern)
- ArusKasScreen: 3-bucket cards + drill-down

### 12b Loan Applications VIEW
- GET `/mobile/loans/applications?status`
- LoanApplicationListScreen: status tabs + FlatList
