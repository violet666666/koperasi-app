# Koperasi Digital System

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748?style=for-the-badge&logo=prisma&logoColor=white)

A modern, comprehensive digital cooperative (Koperasi) management system built with Next.js 16, TypeScript, and Prisma. Designed to streamline operations for multi-branch cooperatives including member management, savings, loans, and accounting.

## 🚀 Key Features

### 👥 Member Management
- Complete member lifecycle management (Registration, Active, Inactive, Resigned)
- Detailed member profiles with savings and loan history
- Multi-branch support for member grouping

### 💰 Savings (Simpanan)
- Support for multiple savings products (Pokok, Wajib, Sukarela)
- Real-time transaction processing (Deposits & Withdrawals)
- Automatic transaction logging and balance updates

### 💸 Loans (Pinjaman)
- Flexible loan product configuration (Interest rates, Tenor, Fees)
- Full loan lifecycle: Application -> Approval -> Disbursement -> Repayment
- Automated installment schedule generation
- Late fee calculation and tracking

### 📊 Accounting & Finance
- Double-entry bookkeeping system
- Customizable Chart of Accounts (COA)
- Cash & Bank management including transfers
- Real-time financial reports:
  - Balance Sheet (Neraca)
  - Profit & Loss (Laba Rugi)
  - SHU (Sisa Hasil Usaha)

### 🛡️ Security & Access Control
- Role-Based Access Control (Admin, Manager, Teller)
- Secure authentication with NextAuth.js
- Audit trails for sensitive actions

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database:** PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Auth:** [NextAuth.js v5](https://authjs.dev/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **State Management:** [React Query](https://tanstack.com/query/latest)
- **Forms:** React Hook Form + Zod Validation

## 📦 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL Database

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/koperasi-app.git
   cd koperasi-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/koperasi_db"

   # Auth
   AUTH_SECRET="your-super-secret-key" # Generate with: npx auth secret
   NEXTAUTH_URL="http://localhost:3000"

   # App
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Database Setup**
   ```bash
   # Push schema to database
   npx prisma db push

   # Seed initial data (Admin user, Branches, COA defaults)
   npm run db:seed
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📖 Documentation

For a detailed user guide covering all workflows (Members, Loans, Savings, Accounting), please refer to the **[USER_GUIDE.md](USER_GUIDE.md)** file included in this repository.

## 🧪 Testing

```bash
# Run linting
npm run lint

# Build for production
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
