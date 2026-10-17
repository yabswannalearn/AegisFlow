import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env');
const url=new URL(process.env.DATABASE_URL); url.pathname='/aegis_test';
const create=spawnSync('docker',['exec','aegisflow-postgres','psql','-U','aegis','-d','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='aegis_test'"],{encoding:'utf8'});
if(create.status!==0)throw new Error('Start the isolated PostgreSQL service with docker compose up -d postgres');
if(create.stdout.trim()!=='1'){const result=spawnSync('docker',['exec','aegisflow-postgres','createdb','-U','aegis','aegis_test'],{stdio:'inherit'});if(result.status)process.exit(result.status);}
const env={...process.env,DATABASE_URL:url.toString()};
for(const args of [['node_modules/prisma/build/index.js','migrate','deploy'],['node_modules/vitest/vitest.mjs','run','--config','vitest.integration.config.ts']]){const r=spawnSync(process.execPath,args,{env,stdio:'inherit'});if(r.status)process.exit(r.status);}
