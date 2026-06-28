import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// O'zbekcha maydon nomlari (DTO property → ko'rinadigan nom).
const FIELD_LABELS: Record<string, string> = {
  login: 'Login', password: 'Parol', fullName: 'F.I.O', role: 'Rol', branchId: 'Filial',
  name: 'Nomi', symbol: 'Simvol', region: 'Hudud', amount: 'Summa', termMonths: 'Muddat',
  katmPrice: 'KATM narxi', isActive: 'Holat', decision: 'Qaror', comment: 'Izoh',
};
const label = (prop: string) => FIELD_LABELS[prop] ?? prop;

/** class-validator constraint kalitlarini o'zbekcha xabarga o'giradi. */
function translate(prop: string, key: string, raw: string): string {
  const f = label(prop);
  const n = raw.match(/(\d+)/)?.[1];
  switch (key) {
    case 'isNotEmpty': return `${f} kiritilishi shart`;
    case 'isString': return `${f} matn bo'lishi kerak`;
    case 'minLength': return `${f} kamida ${n} ta belgi bo'lishi kerak`;
    case 'maxLength': return `${f} ko'pi bilan ${n} ta belgi bo'lishi kerak`;
    case 'isEmail': return `${f} noto'g'ri formatda`;
    case 'isEnum': return `${f} qiymati noto'g'ri`;
    case 'isInt': case 'isNumber': case 'isNumberString': return `${f} raqam bo'lishi kerak`;
    case 'isBoolean': return `${f} ha/yo'q qiymat bo'lishi kerak`;
    case 'min': return `${f} kamida ${n} bo'lishi kerak`;
    case 'max': return `${f} ko'pi bilan ${n} bo'lishi kerak`;
    default: return `${f} noto'g'ri`;
  }
}

function flatten(errors: ValidationError[]): string[] {
  const out: string[] = [];
  for (const e of errors) {
    if (e.constraints) for (const [key, raw] of Object.entries(e.constraints)) out.push(translate(e.property, key, raw));
    if (e.children?.length) out.push(...flatten(e.children));
  }
  return out;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => new BadRequestException(flatten(errors as ValidationError[])),
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });

  const port = Number(process.env.BACKEND_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`✅ credit-core backend listening on http://localhost:${port}/api`);
}

bootstrap();
