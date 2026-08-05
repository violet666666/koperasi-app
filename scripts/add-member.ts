/**
 * Generic one-off: provision a member + NRP-login account in production.
 * Replicates `src/app/api/members/route.ts` POST exactly (member + User with
 * password = bcrypt(NRP)), so the member can log in with NRP + password = NRP
 * (auth.ts matches `{ member: { nrp } }`).
 *
 * Usage:
 *   npx tsx scripts/add-member.ts <NRP> "<Nama Lengkap>" [pangkat]
 * Example:
 *   npx tsx scripts/add-member.ts 96021078 "Muhammad Ari Nuzul A., S.Tr.K., S.I.K., M.Si" IPTU
 *
 * Idempotent: if the NRP/email already exists, it reports so and VERIFIES the
 * existing login instead of duplicating. All new writes are one $transaction.
 * Each run self-verifies via the exact auth query + bcrypt.compare.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ log: ["error"] });

const [nrpArg, nameArg, pangkatArg] = process.argv.slice(2);

async function main() {
  if (!nrpArg || !nameArg) {
    throw new Error('Usage: npx tsx scripts/add-member.ts <NRP> "<Nama>" [pangkat]');
  }

  const NRP = nrpArg.trim();
  const NAME = nameArg.trim();
  const PANGKAT = pangkatArg ? pangkatArg.trim() : null;
  const EMAIL = `${NRP}@koperasi.local`;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tidak ditemukan di environment. Coba: npx tsx --env-file=.env scripts/add-member.ts ...");
  }
  try {
    console.log("Connected DB host:", new URL(process.env.DATABASE_URL).host);
  } catch {
    console.log("Connected DB host: (unable to parse DATABASE_URL)");
  }
  console.log(`Provisioning: NRP=${NRP} | Name="${NAME}" | Pangkat=${PANGKAT ?? "-"}`);

  // Resolve branch (prefer head office) + anggota role up front.
  let branch = await prisma.branch.findFirst({ where: { isHeadOffice: true, isActive: true } });
  if (!branch) branch = await prisma.branch.findFirst({ where: { isActive: true } });
  if (!branch) throw new Error("Tidak ada cabang aktif di sistem.");
  const branchId = branch.id;

  const anggotaRole = await prisma.role.findUnique({ where: { name: "anggota" } });
  if (!anggotaRole) throw new Error("Role 'anggota' tidak ditemukan — tidak bisa membuat akun login.");
  const roleId = anggotaRole.id;

  let memberId: number;
  let userId: number;
  let mode: "created" | "exists";

  const existingMember = await prisma.member.findUnique({ where: { nrp: NRP } });
  if (existingMember) {
    mode = "exists";
    memberId = existingMember.id;
    const existingUser = await prisma.user.findFirst({ where: { memberId } });
    if (!existingUser) {
      throw new Error(`Member ${NRP} sudah ada (id=${memberId}) tetapi TANPA User — perlu penanganan manual.`);
    }
    userId = existingUser.id;
    console.log(`⏭️  Member ${NRP} sudah ada (id=${memberId}). Skip buat, lanjut verifikasi login.`);
  } else {
    mode = "created";
    const created = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          memberNo: NRP,
          nrp: NRP,
          name: NAME,
          ...(PANGKAT ? { pangkat: PANGKAT } : {}),
          branchId,
          joinDate: new Date(),
          status: "active",
        },
      });
      const user = await tx.user.create({
        data: {
          name: NAME,
          email: EMAIL,
          password: await bcrypt.hash(NRP, 10),
          roleId,
          branchId,
          memberId: member.id,
          isActive: true,
        },
      });
      return { member, user };
    });
    memberId = created.member.id;
    userId = created.user.id;
  }

  // VERIFY — exact auth query from src/lib/auth.ts + bcrypt compare.
  const u = await prisma.user.findFirst({
    where: { OR: [{ email: EMAIL }, { member: { nrp: NRP } }] },
    include: { member: true, role: true },
  });

  console.log("\n=== HASIL ===");
  console.log(`Mode         : ${mode === "created" ? "✅ DIBUAT BARU" : "ℹ️  SUDAH ADA (tidak diduplikasi)"}`);
  console.log(`Member       : id=${memberId} | memberNo=${NRP} | nrp=${NRP} | pangkat=${u?.member?.pangkat ?? PANGKAT ?? "-"} | status=${u?.member?.status}`);
  console.log(`User         : id=${userId} | email=${EMAIL} | role=${u?.role?.name} | isActive=${u?.isActive}`);
  console.log(`Auth query   : ${u ? "MATCH ✓" : "NO MATCH ✗"}`);
  console.log(`bcrypt(NRP)  : ${u ? await bcrypt.compare(NRP, u.password) : false}`);
  console.log(`\n🔑 Login → Email/NRP: ${NRP}   Password: ${NRP}`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
