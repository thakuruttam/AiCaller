import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceRoot = path.resolve(__dirname, '..');

export default async function setup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri('aicaller_test');

  process.env.DATABASE_URL = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '15m';
  // Deliberately unset so the Google OAuth strategy never registers in tests
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  const prismaBin = path.join(serviceRoot, 'node_modules', '.bin', 'prisma');
  await execFileAsync(prismaBin, ['db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: serviceRoot,
    env: { ...process.env, DATABASE_URL: uri },
  });

  return async function teardown() {
    await replSet.stop();
  };
}
