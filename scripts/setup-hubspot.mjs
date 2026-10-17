import fs from 'node:fs';
process.loadEnvFile('.env');
const headers={authorization:`Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,'content-type':'application/json'};
async function request(path,method='GET',body){const r=await fetch('https://api.hubapi.com'+path,{method,headers,body:body?JSON.stringify(body):undefined});const d=await r.json();return {status:r.status,data:d};}
for(const property of [{name:'aegis_patient_uuid',label:'AegisFlow Patient UUID',hasUniqueValue:true},{name:'vault_review_url',label:'AegisFlow Vault Review URL'}]){
 const existing=await request('/crm/v3/properties/deals/'+property.name);
 if(existing.status===404){const created=await request('/crm/v3/properties/deals','POST',{...property,type:'string',fieldType:'text',groupName:'dealinformation'});if(created.status>=300)throw new Error(`Property ${property.name}: ${created.status} ${created.data.category}`);}
 else if(existing.status!==200)throw new Error(`Property access failed ${existing.status}`);
}
const list=await request('/crm/v3/pipelines/deals'); if(list.status!==200)throw new Error('Pipeline permission missing');
let pipeline=list.data.results.find(p=>p.label==='AegisFlow Patient Intake');
if(!pipeline){const created=await request('/crm/v3/pipelines/deals','POST',{label:'AegisFlow Patient Intake',displayOrder:9,stages:[
 {label:'AI Triaged - Pending Review',displayOrder:0,metadata:{isClosed:'false',probability:'0.2'}},
 {label:'Approved - Onboarding Sent',displayOrder:1,metadata:{isClosed:'false',probability:'0.6'}},
 {label:'Closed Won - Appointment Booked',displayOrder:2,metadata:{isClosed:'true',probability:'1.0'}},
 {label:'Closed Lost - Emergency Referral',displayOrder:3,metadata:{isClosed:'true',probability:'0.0'}}]});
 if(created.status<300)pipeline=created.data;else{pipeline=list.data.results.find(p=>p.id==='default');console.log(JSON.stringify({dedicatedPipelineUnavailable:created.status,usingExistingSalesPipeline:!!pipeline}));}}
if(!pipeline)throw new Error('No usable pipeline');
const open=pipeline.stages.filter(s=>s.metadata?.isClosed!=='true').sort((a,b)=>a.displayOrder-b.displayOrder);
const won=pipeline.stages.find(s=>Number(s.metadata?.probability)===1);
const values={HUBSPOT_PIPELINE_ID:pipeline.id,HUBSPOT_STAGE_TRIAGED:open[0].id,HUBSPOT_STAGE_APPROVED:(open[1]||open[0]).id,HUBSPOT_STAGE_ONBOARDED:won.id,HUBSPOT_STAGE_EMERGENCY:pipeline.stages.find(s=>s.metadata?.isClosed==='true'&&Number(s.metadata?.probability)===0)?.id};
let env=fs.readFileSync('.env','utf8');for(const [key,value] of Object.entries(values)){env=env.replace(new RegExp('^'+key+'=.*\\r?\\n?','m'),'');env+=key+'='+JSON.stringify(value)+'\n';}fs.writeFileSync('.env',env);
console.log(JSON.stringify({pipeline:pipeline.label,stages:values}));
