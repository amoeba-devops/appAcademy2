import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';
import ExcelJS from 'exceljs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('XLSX import preserves worksheets, values and formulas, rejects invalid input',async()=>{
 const dir=await mkdtemp(join(root,'.workbook-import-test-'));
 try{
  const source=await readFile(join(root,'src/modules/prj/workbook-import.ts'),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const entry=join(dir,'import.mjs');await writeFile(entry,output);
  const {importWorkbook}=await import(pathToFileURL(entry).href);
  const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Tuition');
  sheet.getCell('A1').value=1200;sheet.getCell('A2').value=300;
  sheet.getCell('A3').value={formula:'SUM(A1:A2)',result:1500};
  sheet.getCell('A1').font={bold:true};wb.addWorksheet('Second').getCell('B2').value='memo';
  const raw=await wb.xlsx.writeBuffer();
  const result=await importWorkbook(new Uint8Array(raw).buffer);
  assert.equal(result.sheets.length,2);
  assert.equal(result.sheets[0].celldata[0].v.v,1200);
  assert.equal(result.sheets[0].celldata[0].v.bl,1);
  assert.equal(result.sheets[0].celldata[2].v.f,'=SUM(A1:A2)');
  assert.equal(result.sheets[1].celldata[0].v.v,'memo');
  await assert.rejects(()=>importWorkbook(new ArrayBuffer(4)));
  await assert.rejects(()=>importWorkbook(new ArrayBuffer(21*1024*1024)));
 }finally{await rm(dir,{recursive:true,force:true});}
});
