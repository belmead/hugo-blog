import fs from 'node:fs';
import path from 'node:path';
import { productionAuthConfig } from '../lib/production-auth.mjs';
import { validatePasswordRecord } from '../lib/password.mjs';
try {
  const config=productionAuthConfig();
  const file=path.resolve(process.argv[2] || '.shiro/admin.json');
  const record=validatePasswordRecord(JSON.parse(fs.readFileSync(file,'utf8')));
  await config.store.initialize(record);
  console.log('Admin credential provisioned. The existing password is unchanged.');
} catch {
  console.error('Provisioning was not confirmed. Check the private credential file, connection settings, and whether this admin was already provisioned before retrying.');
  process.exitCode=1;
}
