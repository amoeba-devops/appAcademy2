// Synthetic local fixture: every HTTP request is intercepted; no live messages/data.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TalkChat } from '../src/modules/talk/components/talk-chat';
import { AdminContentLayout } from '../src/components/layout/admin-content-layout';
import { StdFormModal } from '../src/modules/std/components/std-form-modal';
import { ConfirmProvider } from '../src/components/ui/confirm-dialog';
import { ToastProvider } from '../src/components/ui/toast';
import { useAuthStore } from '../src/stores/auth.store';
import { apiClient } from '../src/lib/api-client';
import i18n from '../src/i18n';
import '../src/styles/globals.css';
void i18n.changeLanguage('ko');
const fixtureParams = new URLSearchParams(location.search);
const mode = fixtureParams.get('mode') === 'portal' ? 'portal' : 'admin';
const channel={id:'fixture-room',name:'모바일 검증방',type:'GROUP',members:[{kind:'USER',refId:'fixture-user',name:'운영자',role:'OWNER'},{kind:'TEACHER',refId:'fixture-teacher',name:'강사',role:'MEMBER'}],unreadCount:0,lastMessageAt:null,lastMessagePreview:'테스트 대화',mine:true,archived:false,canSend:true};
useAuthStore.setState({user:{id:'fixture-user',entId:'fixture-tenant',role:'ADMIN'},portal:{token:null,user:{id:'fixture-account',entId:'fixture-tenant',kind:'TEACHER',refId:'fixture-teacher',loginId:'fixture',mustChangePassword:false}}});
apiClient.defaults.adapter=async(config)=>{
 const url=config.url??'';
 let data:unknown=[];
 if(url.endsWith('/channels')) data=[channel];
 else if(url.endsWith('/channels/fixture-room')) data=channel;
 else if(url.endsWith('/messages')) data={messages:Array.from({length:30},(_,i)=>({id:`m${i}`,channelId:channel.id,type:'TEXT',content:`모바일 대화 ${i+1}: 긴 메시지도 화면 안에서 표시됩니다. https://example.test/verylongunbrokenlink12345678901234567890`,senderKind:'USER',senderRefId:'fixture-user',senderName:'운영자',mine:true,createdAt:new Date().toISOString(),filename:null,sizeBytes:null})),nextCursor:null};
 else if(url.includes('teachers')||url.includes('/schools'))data={items:[],total:0};
 return {data:{success:true,data},status:200,statusText:'OK',headers:{},config};
};
function App(){
 const [form,setForm]=useState(false);
 return <div className="admin-shell"><header className="h-14 flex items-center justify-between px-3 border-b"><span>ACM · 모바일 검증</span><button onClick={()=>setForm(true)}>학생 등록</button></header><main className="p-3"><AdminContentLayout><h1 className="mb-3 text-lg">채팅</h1><TalkChat mode={mode} /></AdminContentLayout></main><StdFormModal open={form} onClose={()=>setForm(false)}/></div>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[`${fixtureParams.has('panel') ? '/admin/std' : '/admin/chat'}?channelId=fixture-room`]}><ToastProvider><ConfirmProvider><App/></ConfirmProvider></ToastProvider></MemoryRouter></QueryClientProvider>);
