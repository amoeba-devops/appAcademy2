#!/usr/bin/env node
// Run from deployed backend root. Payload is private, never committed.
const fs=require('node:fs');
const {createRequire}=require('node:module');
const load=createRequire(process.cwd()+'/package.json');
load('reflect-metadata');
const {DataSource}=load('typeorm');
const {IcsImportService}=load(process.cwd()+'/dist/modules/acm-cal/application/ics/ics-import.service.js');
const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const ds=new DataSource({type:'postgres',host:process.env.ACM_PG_HOST,port:Number(process.env.ACM_PG_PORT||5432),username:process.env.ACM_PG_USER,password:process.env.ACM_PG_PASSWORD,database:process.env.ACM_PG_DATABASE||'db_acm'});
(async()=>{await ds.initialize();try{console.log(JSON.stringify(await new IcsImportService(ds).import(payload.files,payload.email,payload.name,payload.batchId,process.argv.includes('--apply')),null,2));}finally{await ds.destroy();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
