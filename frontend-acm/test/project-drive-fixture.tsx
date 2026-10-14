// Synthetic browser fixture: no tokens, live API, or Google requests.
import {SharedDrivePage} from '../src/modules/prj/shared-drive-page';
import type {Item} from '../src/modules/prj/types';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ProjectListPage,ProjectDetailPage,DriveConnectionPage} from '../src/modules/prj/project-page';
import {AdminContentLayout} from '../src/components/layout/admin-content-layout';
import {useAuthStore} from '../src/stores/auth.store';
import {apiClient} from '../src/lib/api-client';
import {AxiosError} from 'axios';
import '../src/i18n';
import '../src/styles/globals.css';
const id='11111111-1111-4111-a111-111111111111',query=new URLSearchParams(location.search),member=query.has('member');
const people=[{id:'22222222-2222-4222-a222-222222222222',name:'김담당'},{id:'33333333-3333-4333-a333-333333333333',name:'이참여'}];
useAuthStore.setState({token:null,user:{id:people[member?1:0].id,entId:'fixture-tenant',role:'ADMIN',authSource:'ama'},portal:{token:null,user:null},parent:{token:null,user:null}});
let projects=[{prj_id:id,prj_title:'겨울특강 준비 · 합성 데이터',prj_description:'수업 운영 준비를 위한 프로젝트입니다.',prj_status:'ACTIVE',owner_id:people[0].id,members:people,member_count:2,issue_count:1,updated_at:new Date().toISOString(),recent_issues:[{pit_title:'시간표 확정',pit_status:'TODO'}]}];
let items: Item[]=[{pit_id:'issue-1',pit_kind:'ISSUE',pit_title:'시간표 확정',pit_body:'강사별 가능한 시간을 확인합니다.',pit_status:'TODO',assignee_id:people[1].id,due_date:'2026-11-01',creator_name:'김담당',drive_file_id:null as string|null,drive_mime:null as string|null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()},{pit_id:'doc-1',pit_kind:'DOCUMENT',pit_title:'겨울특강 안내문 — 긴 문서 이름과 모바일 줄바꿈 확인',pit_body:'',pit_status:'TODO',assignee_id:null,due_date:null,creator_name:'김담당',drive_file_id:'synthetic-doc',drive_mime:'application/vnd.google-apps.document',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}];
apiClient.defaults.adapter=async config=>{const url=config.url??'',method=config.method??'get';let data:unknown=[];const body=typeof config.data==='string'?JSON.parse(config.data):config.data;
if(url.endsWith('/drive/connect')||url.endsWith('/drive/picker')||url.endsWith('/open'))throw new AxiosError('Synthetic unavailable','ERR_BAD_REQUEST',config,undefined,{data:{message:'합성 검증: Google 연결은 실제로 실행하지 않습니다.'},status:400,statusText:'Bad Request',headers:{},config});
if(url==='/acm/prj/people')data=people;
else if(url==='/acm/prj/drive')data={configured:true,connected:true,canManage:!member,email:'academy@example.invalid',rootReady:true,rootName:'ACM Projects',rootId:'synthetic-root'};
else if(url==='/acm/prj/projects'){if(method==='post'){const p={...projects[0],prj_id:crypto.randomUUID(),prj_title:body.title,prj_description:body.description,owner_id:body.ownerId};projects.push(p);data=p;}else data=projects;}
else if(url==='/acm/drive/folders')data=[{drf_id:'folder-demo',file_id:'common-folder',title:'학원 공용 자료',operator_access:'VIEW',access:member?'VIEW':'EDIT'}];
else if(url.includes('/acm/drive/folders/'))data={files:[{id:'file-demo',name:'시간표.pdf',mimeType:'application/pdf'}]};
else if(url.includes('/documents')){if(method==='post'){const i={...items[0],pit_id:crypto.randomUUID(),pit_title:body.title,pit_kind:body.documentType==='MEMO'?'NOTE' as const:'DOCUMENT' as const,pit_body:'',content:body.content,document_type:body.documentType,storage_type:body.storageType,external_url:body.url,revision:1,drive_file_id:null,drive_mime:null};items.push(i);data=i;}else{items=items.map(i=>i.pit_id===url.split('/').at(-1)?{...i,pit_title:body.title,content:body.content,external_url:body.url,revision:(i.revision??1)+1}:i);data=items.find(i=>i.pit_id===url.split('/').at(-1));}}
else if(url.endsWith('/items')){if(method==='post'){const i={...items[0],pit_id:crypto.randomUUID(),pit_title:body.title,pit_body:body.body,pit_kind:body.kind};items.push(i);data=i;}else data=items;}
else if(url.includes('/items/')&&method==='put'){items=items.map(i=>i.pit_id===url.split('/').at(-1)?{...i,pit_title:body.title,pit_body:body.body,pit_status:body.status,assignee_id:body.assigneeId,due_date:body.dueDate}:i);data=items[0];}
else if(url.endsWith('/drive'))data={files:[{id:'synthetic-file',name:'시간표.pdf',mimeType:'application/pdf',size:'5000'}]};
else if(url.includes('/projects/'))data=projects.find(p=>url.endsWith(p.prj_id))??projects[0];
return {data:{success:true,data},status:200,statusText:'OK',headers:{},config};};
const entry=query.has('list')?'/admin/projects':query.has('settings')?'/admin/drive':'/admin/projects/'+id+'?tab='+(query.get('tab')??'overview')+'&type='+(query.get('type')??'memo');
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[entry]}><div className="admin-shell"><header className="h-14 p-3 border-b">ACM · 프로젝트 합성 데이터 검증</header><main className="p-3"><AdminContentLayout><Routes><Route path="/admin/projects" element={<ProjectListPage/>}/><Route path="/admin/projects/:id" element={<ProjectDetailPage/>}/><Route path="/admin/config/drive" element={<DriveConnectionPage/>}/><Route path="/admin/drive" element={<SharedDrivePage/>}/></Routes></AdminContentLayout></main></div></MemoryRouter></QueryClientProvider>);
