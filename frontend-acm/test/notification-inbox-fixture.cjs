// UI-only fixture server. Bind loopback; all users/messages are synthetic.
const http=require('node:http');
const {randomUUID}=require('node:crypto');
const user={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',entId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'ADMIN',email:'notification-test@example.invalid',name:'테스트 관리자',authSource:'local'};
const teacher={kind:'USER',refId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'김담당',role:'MEMBER'};
const channelId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let messages=[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',channelId,type:'TEXT',content:'@테스트 관리자 내일 수업 시간을 확인해 주세요.',senderKind:'USER',senderRefId:teacher.refId,senderName:teacher.name,mine:false,createdAt:new Date().toISOString()}];
let items=['CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','CHAT_MENTION'].map((type,i)=>({id:randomUUID(),type,targetId:type==='CHAT_MENTION'?messages[0].id:randomUUID(),payload:{...(type.startsWith('CSL')?{seqNo:123,...(type==='CSL_STAGE'?{fromStage:'INTAKE',toStage:'MAP_TEST'}:{})}:type.startsWith('CAL')?{title:'영어 회화 수업',count:type==='CAL_CREATED'?5:undefined}:{channelId,senderName:'김담당'})},readAt:null,createdAt:new Date(Date.now()-i*60000).toISOString()}));
const channel={id:channelId,type:'GROUP',name:'운영방 (검증용)',members:[{kind:'USER',refId:user.id,name:user.name,role:'OWNER'},teacher],unreadCount:1,lastMessageAt:messages[0].createdAt,lastMessagePreview:messages[0].content,mine:true};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:4009');const p=url.pathname.slice(4);
 if(p.endsWith('/events')){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.write('data: {"type":"heartbeat"}\n\n');const timer=setInterval(()=>res.write('data: {"type":"heartbeat"}\n\n'),25000);req.on('close',()=>clearInterval(timer));return;}
 let data={};let body={};if(['POST','PATCH'].includes(req.method)){let raw='';for await(const chunk of req)raw+=chunk;body=raw?JSON.parse(raw):{};}
 if(p==='/acm/auth/login')data={accessToken:'local-fixture-only',user};
 else if(p==='/acm/auth/me')data={user};
 else if(p==='/acm/notifications/inbox/count')data={unreadCount:items.filter(x=>!x.readAt).length,asOf:new Date().toISOString()};
 else if(p==='/acm/notifications/inbox')data={items:items.filter(x=>url.searchParams.get('unread')!=='true'||!x.readAt),nextCursor:null,unreadCount:items.filter(x=>!x.readAt).length,asOf:new Date().toISOString()};
 else if(p==='/acm/notifications/inbox/read-all'){items.forEach(x=>{if(x.createdAt<=body.asOf)x.readAt=new Date().toISOString();});data={unreadCount:items.filter(x=>!x.readAt).length};}
 else if(p.startsWith('/acm/notifications/inbox/')&&p.endsWith('/read')){const row=items.find(x=>p.includes(x.id));if(row){row.readAt=new Date().toISOString();data={href:row.type==='CHAT_MENTION'?`/admin/chat?channelId=${channelId}&messageId=${messages[0].id}`:row.type.startsWith('CSL')?`/admin/csl/${row.targetId}`:`/admin/cal/${row.targetId}`};}}
 else if(p==='/acm/talk/channels')data=[channel];
 else if(p.includes('/talk/channels/')&&p.endsWith('/messages')){if(req.method==='POST'){const msg={...messages[0],id:randomUUID(),content:body.content,mentions:body.mentions,senderName:user.name,mine:true,createdAt:new Date().toISOString()};messages.push(msg);data=msg;console.log('fixture message saved; mentions='+body.mentions?.length);}else data={messages,nextCursor:null};}
 else if(p.includes('/messages/'))data=messages[0];
 else if(p.includes('/menus'))data={hidden:[],order:[]};
 else if(p.includes('/candidates'))data=[];
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,data}));
}).listen(4009,'127.0.0.1',()=>console.log('Notification UI fixtures listening on loopback:4009'));
