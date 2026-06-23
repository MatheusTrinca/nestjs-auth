import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export default function globalSetup() {
  console.log('\n[E2E] Running Prisma migrations against test database...');
  try {
    execSync('npx prisma migrate deploy --config prisma/prisma.config.ts', {
      env: { ...process.env },
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log('[E2E] Migrations applied successfully.\n');
  } catch (error) {
    console.error('[E2E] Migration failed:', error);
    throw error;
  }
}
