import fs from 'node:fs';
import crypto from 'node:crypto';
if (fs.existsSync('.env')) {
  console.log('.env already exists; preserved existing configuration.');
} else {
  let template = fs.readFileSync('.env.example', 'utf8');
  for (const placeholder of ['POSTGRES_PASSWORD', '64_HEX_CHARACTERS', 'WEBHOOK_SECRET', 'TOOL_SECRET', 'JWT_SECRET', 'WORKER_SECRET', 'N8N_SECRET']) {
    template = template.replaceAll(`REPLACE_${placeholder}`, crypto.randomBytes(32).toString('hex'));
  }
  fs.writeFileSync('.env', template, { mode: 0o600, flag: 'wx' });
  console.log('Created .env with random local secrets. Configure Gemini and HubSpot before live use.');
}
