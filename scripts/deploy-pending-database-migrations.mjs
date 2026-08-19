import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Only migrations with a durable deployment marker belong here. The legacy
// bootstrap SQL remains available in prisma/deploy, but must not be replayed on
// every production build.
const migrations = [
  '20260802233000_site_delivery_viewing_workflows',
  '20260803120000_partner_network',
  '20260804153000_studio_batch_item_leases',
  '20260804170000_studio_video_jobs',
  '20260805210000_company_settings',
  '20260805220000_authorized_pool_deed_tracking',
  '20260805223000_studio_poster_generation_limits',
  '20260818063000_studio_poster_output_recovery',
];

const prisma = new PrismaClient();

async function readAppliedMigrationNames() {
  const [{ tableName }] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('"_JasmineDeployMigration"')::text AS "tableName"`,
  );

  if (!tableName) {
    return new Set();
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT "name" FROM "_JasmineDeployMigration"`,
  );

  return new Set(rows.map((row) => row.name));
}

function executeMigration(migrationName) {
  const migrationPath = path.join(
    projectRoot,
    'prisma',
    'migrations',
    migrationName,
    'migration.sql',
  );
  const prismaSchemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    executable,
    [
      'prisma',
      'db',
      'execute',
      '--file',
      migrationPath,
      '--schema',
      prismaSchemaPath,
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(`Database migration failed: ${migrationName}`);
  }
}

try {
  const applied = await readAppliedMigrationNames();
  const pending = migrations.filter((migration) => !applied.has(migration));

  if (pending.length === 0) {
    console.log('Database schema is up to date.');
  } else {
    console.log(`Applying ${pending.length} pending database migration(s).`);
    for (const migration of pending) {
      executeMigration(migration);
    }
  }
} finally {
  await prisma.$disconnect();
}
