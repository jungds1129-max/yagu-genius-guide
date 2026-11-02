const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Vary':'Authorization','X-Content-Type-Options':'nosniff'}});
let jwks=null,keysExpire=0;
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const cookie=(r,name)=>r.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const sessionCookie=(token,age=3600)=>'__Host-deck-session='+token+'; Path=/; Max-Age='+age+'; Secure; HttpOnly; SameSite=Lax';
async function identity(request,env){
 const token=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1]||cookie(request,'__Host-deck-session');if(!token||token.length>12000)throw Error('로그인이 필요합니다.');
 const parts=token.split('.');if(parts.length!==3)throw Error('로그인을 다시 해주세요.');
 const decode=s=>JSON.parse(new TextDecoder().decode(bytes(s)));const h=decode(parts[0]),claims=decode(parts[1]),now=Math.floor(Date.now()/1000);
 if(h.alg!=='RS256'||typeof h.kid!=='string'||claims.aud!==env.GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||typeof claims.sub!=='string'||!/^[0-9]{1,64}$/.test(claims.sub))throw Error('로그인을 다시 해주세요.');
 if(!jwks||Date.now()>keysExpire){const r=await fetch('https://www.googleapis.com/oauth2/v3/certs');if(!r.ok)throw Error('구글 인증 확인을 다시 시도하세요.');jwks=(await r.json()).keys;keysExpire=Date.now()+Math.min(3600,Number(r.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300))*1000;}
 const key=jwks.find(k=>k.kid===h.kid&&k.kty==='RSA');if(!key)throw Error('로그인을 다시 해주세요.');
 const imported=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('로그인을 다시 해주세요.');
 return claims.sub;
}
function settings(raw={}){const n=(k,fallback,max)=>{const v=raw[k]??fallback;if(!Number.isInteger(v)||v<0||v>max)throw Error('훈련 설정을 확인하세요.');return v;};const done=raw.done??[];if(!Array.isArray(done)||done.length>100||done.some(v=>typeof v!=='string'||v.length>80))throw Error('완료한 훈련 형식을 확인하세요.');return {mode:raw.mode==='current'?'current':'target',sessions:n('sessions',5,7),gold:n('gold',100000,2000000000),roster:n('roster',0,500),done:[...new Set(done)]};}
async function deckApi(request,env){
 const url=new URL(request.url);if(url.pathname==='/api/deck/config'&&request.method==='GET')return json({clientId:env.GOOGLE_CLIENT_ID||''});
 if(url.pathname==='/api/deck/logout'&&request.method==='POST'){
  if(request.headers.get('Origin')!==url.origin)return json({error:'잘못된 요청입니다.'},403);
  const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie('',0));return response;
 }
 if(url.pathname==='/api/deck/login'&&request.method==='POST'){
  if(Number(request.headers.get('Content-Length')||0)>16000)return json({error:'인증 정보가 너무 큽니다.'},413);
  const body=await request.text();if(body.length>16000)return json({error:'인증 정보가 너무 큽니다.'},413);
  const form=new URLSearchParams(body),csrf=cookie(request,'g_csrf_token'),credential=form.get('credential')||'';
  if(!csrf||csrf!==form.get('g_csrf_token')||credential.length>3800)return json({error:'구글 로그인 화면에서 다시 시작해 주세요.'},403);
  try{await identity(new Request(request.url,{headers:{Authorization:'Bearer '+credential}}),env);}catch{return json({error:'구글 로그인 인증을 확인하지 못했습니다.'},401);}
  return new Response(null,{status:303,headers:{Location:'/#deck','Cache-Control':'no-store', 'Set-Cookie':sessionCookie(credential)}});
 }
 if(url.pathname!=='/api/deck')return json({error:'없는 경로입니다.'},404);
 if(!env.GOOGLE_CLIENT_ID||!env.BUCKET)return json({error:'덱 저장소 연결 준비 중입니다.'},503);
 if(url.search)return json({error:'다른 계정이나 선수 ID를 지정할 수 없습니다.'},400);
 if(!['GET','PUT'].includes(request.method))return json({error:'허용하지 않는 요청입니다.'},405);
 let sub;try{sub=await identity(request,env);}catch{return json({error:'로그인이 만료되었거나 인증되지 않았습니다. 구글로 다시 로그인하세요.'},401);}
 const key='private-decks/google-'+sub+'.json';
 if(request.method==='GET'){const object=await env.BUCKET.get(key);return json(object?{...await object.json(),revision:object.etag}:{version:1,players:[],settings:settings(),revision:''});}
 if(request.headers.get('Origin')!==url.origin)return json({error:'사이트에서 직접 저장해 주세요.'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON 형식이 필요합니다.'},415);
 const reader=request.body?.getReader();if(!reader)return json({error:'저장할 덱이 없습니다.'},400);const chunks=[];let total=0;for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1000000){await reader.cancel();return json({error:'덱은 1MB 이하로 저장하세요.'},413);}chunks.push(value);}const bodyBytes=new Uint8Array(total);let cursor=0;for(const chunk of chunks){bodyBytes.set(chunk,cursor);cursor+=chunk.length;}
 let data;try{const raw=JSON.parse(new TextDecoder().decode(bodyBytes));if(raw.version!==1||!Array.isArray(raw.players)||raw.players.length>500)throw Error('최대 500명까지 저장할 수 있습니다.');const players=raw.players.map(window.DeckModel.player);if(new Set(players.map(p=>p.id)).size!==players.length)throw Error('선수 ID가 중복됩니다.');data={version:1,players,settings:settings(raw.settings),updatedAt:new Date().toISOString()};}catch(e){return json({error:e.message||'덱 형식을 확인하세요.'},400);}
 const match=request.headers.get('If-Match');if(!match||!/^(new|[a-zA-Z0-9-]{1,100})$/.test(match))return json({error:'덱을 새로 불러온 뒤 저장해 주세요.'},409);
 const onlyIf=new Headers(match==='new'?{'If-None-Match':'*'}:{'If-Match':'"'+match+'"'});const object=await env.BUCKET.put(key,JSON.stringify(data),{onlyIf,httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
 if(!object)return json({error:'다른 탭에서 덱이 변경됐습니다. 백업 후 다시 로그인하여 최신 덱을 불러오세요.'},409);
 return json({revision:object.etag});
}
export {deckApi,identity,settings};
