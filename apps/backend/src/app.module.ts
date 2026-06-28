import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { CreditCasesModule } from './credit-cases/credit-cases.module';
import { DocumentsModule } from './documents/documents.module';
import { ImportModule } from './import/import.module';
import { OutputModule } from './output/output.module';
import { KatmModule } from './katm/katm.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env'), join(__dirname, '..', '..', '..', '.env')],
    }),
    PrismaModule,
    DocumentsModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    CreditCasesModule,
    ImportModule,
    OutputModule,
    KatmModule,
  ],
})
export class AppModule {}
