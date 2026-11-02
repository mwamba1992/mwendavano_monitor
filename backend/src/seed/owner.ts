/**
 * Creates the first owner account and prints a one-time password.
 *   npm run seed:owner -- --phone 07XX XXX XXX --name "Full Name"
 * Refuses to run twice for the same phone: passwords are reset from Staff and access, not here.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { fullAccess } from '../access/access';
import { normalizePhone } from '../common/logic/phone';
import { dbOptions } from '../db-options';
import { Staff } from '../entities';

dotenv.config({ quiet: true } as any);

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const phone = normalizePhone(arg('phone'));
  const name = arg('name')?.trim();
  if (!phone || !name) throw new Error('Usage: npm run seed:owner -- --phone <phone> --name "<name>"');
  const ds = await new DataSource({ ...dbOptions(), migrationsRun: true }).initialize();
  try {
    const repo = ds.getRepository(Staff);
    if (await repo.exist({ where: { phone } })) throw new Error('This phone already has an account');
    const password = randomBytes(12).toString('base64url');
    await repo.save(repo.create({ name, phone, jobRole: 'Owner', isOwner: true, access: fullAccess(), passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true }));
    console.log(`Owner created: ${name}`);
    console.log(`One-time password (shown once, change it at first sign-in): ${password}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
