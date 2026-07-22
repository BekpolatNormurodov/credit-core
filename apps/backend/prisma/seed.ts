import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Lender master data (id 'default') — document letterhead/requisites read this.
  await prisma.organization.upsert({
    where: { id: 'default' },
    update: { tradeMark: 'PULMAKON' }, // backfill the trademark on existing deployments
    create: {
      id: 'default',
      tradeMark: 'PULMAKON',
      nameMixed: 'МЧЖ «CLEVER Mikromoliya Tashkiloti»',
      nameUpper: 'МЧЖ «CLEVER MIKROMOLIYA TASHKILOTI»',
      nameSuffix: '«CLEVER MIKROMOLIYA TASHKILOTI» МЧЖ',
      directorShort: 'Б.Исмоилов',
      directorFull: 'Исмоилов Баҳромжон Ахрор ўғли',
      address: 'Тошкент шахар, Олмазор тумани, Сагбон 30 берк кўча, 6 уй',
      bankAccount: '20216000105068380006',
      bankMfo: '01183',
      bankName: 'АЖ «ANORBANK»',
      phone: '78 113-31-33',
      inn: '306365847',
      licenseNo: '61',
      licenseDate: new Date('2019-06-22T00:00:00Z'),
    },
  });

  const branch = await prisma.branch.upsert({
    where: { symbol: 'BR' },
    update: {},
    create: { name: 'Buxoro filiali', symbol: 'BR', region: 'Buxoro' },
  });

  const plainPassword = 'parol123';
  const password = await bcrypt.hash(plainPassword, 10);

  const users: { login: string; fullName: string; role: Role; branchId: string | null }[] = [
    { login: 'operator', fullName: 'Operator Ishchi', role: Role.OPERATOR, branchId: branch.id },
    { login: 'moderator', fullName: 'Moderator Nazoratchi', role: Role.MODERATOR, branchId: branch.id },
    { login: 'director', fullName: 'Direktor Rahbar', role: Role.DIRECTOR, branchId: null },
    { login: 'admin', fullName: 'Administrator', role: Role.ADMIN, branchId: null },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, branchId: u.branchId, passwordHash: password, plainPassword },
      create: { ...u, passwordHash: password, plainPassword },
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
