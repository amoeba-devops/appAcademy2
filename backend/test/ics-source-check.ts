import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitCalendar, expandSource } from '../src/modules/acm-cal/application/ics/ics-parser';
const dir=process.argv[2];
const report:{calendar:string;sources:number;occurrences:number;unbounded:number}[]=[];
const expanded:Record<string,unknown[]>={};
const failures:{file:string;uid:string;error:string}[]=[];
for(const f of readdirSync(dir).filter(f=>f.endsWith('.ics'))) {
 const sources=splitCalendar(readFileSync(join(dir,f),'utf8'),f);
 let count=0;
 for(const s of sources)try{const events=expandSource(s,new Date('2027-10-01T00:00:00Z')); count+=events.length; expanded[f+'|'+s.uid]=events;}catch(e){failures.push({file:f,uid:s.uid,error:String(e)});}
 report.push({calendar:sources[0]?.calendarName,sources:sources.length,occurrences:count,unbounded:sources.filter(s=>s.unbounded).length});
}
writeFileSync('/private/tmp/acm-ics-expansion-check.json',JSON.stringify({report,failures},null,2));
writeFileSync('/private/tmp/acm-ics-expanded.json',JSON.stringify(expanded));
console.log(JSON.stringify({report,failures:failures.length}));
if(failures.length)process.exitCode=1;
