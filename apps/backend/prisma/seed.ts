import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.upsert({
    where: { symbol: 'BR' },
    update: {},
    create: { name: 'Buxoro filiali', symbol: 'BR', region: 'Buxoro' },
  });

  const password = await bcrypt.hash('parol123', 10);

  const users: { login: string; fullName: string; role: Role; branchId: string | null }[] = [
    { login: 'operator', fullName: 'Operator Ishchi', role: Role.OPERATOR, branchId: branch.id },
    { login: 'moderator', fullName: 'Moderator Nazoratchi', role: Role.MODERATOR, branchId: branch.id },
    { login: 'director', fullName: 'Direktor Rahbar', role: Role.DIRECTOR, branchId: null },
    { login: 'admin', fullName: 'Administrator', role: Role.ADMIN, branchId: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, branchId: u.branchId },
      create: { ...u, passwordHash: password },
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Seed tayyor. Login: operator/moderator/director/admin — parol: parol123');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
