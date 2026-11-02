// 덱 관리 코치 화면: 팀 현황 → 이번 전지훈련 안내 → 선수별 훈련 안내.
// 근거: guide/22 (레벨업 1회 전 능력치 +1, 정밀 +3~4, 종합 약한 4개 +1~2, 35세+ 정산마다 -3, 개인훈련 랜덤 2개 +1).
(() => {
 'use strict';
 const M=window.DeckModel;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const f=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
 const sign=n=>(n>0?'+':'')+f(n);
 const $=id=>document.getElementById('dk-'+id);
 let data=null,choice='best',manual=[];
 const BAT_CORE=['파워','컨택','선구안'];
 const LABEL={'pitcher:종합':'투수 종합','batter:종합':'타자 종합'};
 const label=id=>LABEL[id]||((id.startsWith('batter')?'타자 ':'투수 ')+id.split(':')[1]+' 정밀');

 // 핵심 스탯: 타자 파워·컨택·선구안, 투수 보유 구종 구위·제구 + 구속.
 function core(p){
  if(p.type==='batter')return BAT_CORE.filter(k=>p.stats[k]!==undefined);
  const owned=M.pitches.filter(x=>p.stats[x+' 구위']!==undefined||p.stats[x+' 제구']!==undefined).flatMap(x=>[x+' 구위',x+' 제구']).filter(k=>p.stats[k]!==undefined);
  return [...owned,...(p.stats['구속']!==undefined?['구속']:[])];
 }
 const entered=p=>Object.keys(p.stats);
 const avg=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
 const pool=()=>data.players.filter(M.eligible);
 const cost=()=>Math.max(pool().length,data.settings.roster)*700;
 const maxSessions=()=>{const c=cost();return c?Math.min(data.settings.sessions,Math.floor(data.settings.gold/c)):data.settings.sessions;};

 // 전지훈련 시뮬레이션 (빠른 버전). 정밀: 대상 전원 해당 능력치 +3.5, 종합: 선수별 상한 미달 약한 4개 +1.5, 모두 상한에서 멈춤.
 // 순서: 정밀 → 투수 종합 → 타자 종합. 입력 안 된 능력치는 0으로 보지 않고, 종합은 입력한 능력치 4개 이상일 때만 계산.
 const BAT_BASIC=M.batting.slice(0,21);
 function campKeys(p){
  const req=p.type==='batter'?BAT_BASIC:[...M.pitching,'포심 구위','포심 제구'];
  const owned=p.type==='pitcher'?M.pitches.filter(x=>p.stats[x+' 구위']!==undefined||p.stats[x+' 제구']!==undefined).flatMap(x=>[x+' 구위',x+' 제구']):[];
  return [...new Set([...req,...owned])].filter(k=>p.stats[k]!==undefined);
 }
 function order(seq){const r=id=>id.endsWith(':종합')?(id.startsWith('pitcher')?1:2):0;return seq.map((id,i)=>[id,i]).sort((a,b)=>r(a[0])-r(b[0])||a[1]-b[1]).map(x=>x[0]);}
 function simulate(seq){
  const mode=data.settings.mode,done=new Set(data.settings.done);
  const copy=data.players.map(p=>({...p,stats:Object.fromEntries(entered(p).map(k=>[k,M.project(p,k,mode)])),target:p.level,camp:campKeys(p)}));
  const ps=copy.filter(p=>M.eligible(p)&&p.cap!==null);let invalid=0;
  for(const id of order(seq)){
   const [type,stat]=id.split(':');
   if(stat!=='종합'){if(done.has(id)){invalid++;continue;}done.add(id);for(const p of ps)if(p.type===type&&p.stats[stat]!==undefined)p.stats[stat]=Math.min(p.cap,p.stats[stat]+3.5);continue;}
   for(const p of ps){if(p.type!==type||p.camp.length<4)continue;
    p.camp.map(k=>({k,gap:p.cap-p.stats[k]})).filter(x=>x.gap>0).sort((a,b)=>b.gap-a.gap).slice(0,4).forEach(x=>p.stats[x.k]=Math.min(p.cap,p.stats[x.k]+1.5));}
  }
  return {players:copy,invalid};
 }
 // 효율 점수: 핵심 스탯 상승 ×1, 그 외 ×0.5, 유지 대상(2~3각 33~37세)의 파워·컨택·선구안 ×2 (은퇴 전까지 지명타자로 오래 쓰기).
 // 남은 사용 기간: 일반 선수는 35세(정산 -3 시작), 2~3각 타자는 38세(은퇴)까지. 5년 이상이면 1, 짧을수록 낮게 친다.
 function life(p){if(p.age===null)return 1;const end=p.type==='batter'&&p.awaken>=2?M.KEEP_UNTIL:35;return Math.max(0.2,Math.min(5,end-p.age)/5);}
 function weightOf(p,k){const w=M.keeper(p)&&p.age>=35&&BAT_CORE.includes(k)?2:core(p).includes(k)?1:0.5;return w*life(p);}
 let baseCache=null;
 function score(sim){const base=baseCache||(baseCache=simulate([]));let s=0;for(const a of sim.players){if(!M.eligible(a)||a.cap===null)continue;const b=base.players.find(q=>q.id===a.id);for(const k of Object.keys(a.stats))s+=(a.stats[k]-b.stats[k])*weightOf(a,k);}return s;}
 const PRECISION=['파워','컨택','선구안','스피드','멘탈'].map(k=>'batter:'+k);
 // 가능한 조합을 모두 계산해 효율 순으로 정렬. 효과가 같으면 횟수가 적은 쪽(골드 절약)을 먼저.
 let ranked=null;
 function rankAll(){
  if(ranked)return ranked;const n=maxSessions(),free=PRECISION.filter(id=>!data.settings.done.includes(id)),out=[],seen=new Set();
  for(let mask=0;mask<1<<free.length;mask++){
   const pre=free.filter((_,i)=>mask&1<<i);if(pre.length>n)continue;
   for(let total=pre.length;total<=n;total++)for(let pg=0;pg<=total-pre.length;pg++){
    const seq=[...pre,...Array(pg).fill('pitcher:종합'),...Array(total-pre.length-pg).fill('batter:종합')],key=seq.join();if(seen.has(key))continue;seen.add(key);
    out.push({seq,score:score(simulate(seq))});
   }
  }
  out.sort((a,b)=>b.score-a.score>0.05?1:a.score-b.score>0.05?-1:a.seq.length-b.seq.length);
  return ranked=out;
 }
 function best(){return rankAll()[0]?.seq||[];}
 function sequence(){return choice==='manual'?manual.slice(0,7):best();}
 function describe(seq){const c={};order(seq).forEach(id=>c[id]=(c[id]||0)+1);return Object.entries(c).map(([id,n])=>label(id)+(n>1?' '+n+'회':'')).join(' + ')||'안 함';}

 // 플랜 결과를 타입별로 요약.
 function effect(seq){
  const sim=simulate(seq),base=baseCache||(baseCache=simulate([])),out={};
  for(const type of ['batter','pitcher']){
   const ps=pool().filter(p=>p.type===type&&p.cap!==null);let before=[],after=[],room=[],gain=0,none=0;
   for(const p of ps){const a=sim.players.find(q=>q.id===p.id),b=base.players.find(q=>q.id===p.id),ks=core(p);let g=0;
    for(const k of entered(p))g+=a.stats[k]-b.stats[k];gain+=g;if(g<=0)none++;
    for(const k of ks){before.push(b.stats[k]);after.push(a.stats[k]);room.push(p.cap-a.stats[k]);}}
   out[type]={n:ps.length,before:avg(before),after:avg(after),room:avg(room),gain,none};
  }
  return {...out,invalid:sim.invalid,sim,score:score(sim)};
 }

 // ── ② 팀 현황 ─────────────────────────────
 function team(){
  const box=$('team');if(!box)return;const ps=pool();
  if(!data.players.length){box.innerHTML='<span class="dk-badge">우리 팀 현황</span><h3>선수를 등록하면 팀 현황이 나와요</h3><p class="dk-muted">이름·나이·각성·레벨·상한과 파워·컨택·선구안(투수는 구종 구위·제구)만 넣어도 계산돼요.</p><button class="btn dk-primary" type="button" data-coach-add>+ 첫 선수 등록</button>';return;}
  const tile=type=>{
   const g=ps.filter(p=>p.type===type),name=type==='batter'?'타자':'투수';
   if(!g.length)return '<div class="dk-tile"><h4>'+name+'</h4><p class="dk-muted">등록된 '+name+'가 없어요.</p></div>';
   const lv=avg(g.map(p=>p.target-p.level)),capd=g.filter(p=>p.cap!==null);
   const now=[],later=[];for(const p of capd)for(const k of core(p)){now.push(p.cap-p.stats[k]);later.push(p.cap-M.project(p,k,'target'));}
   const tr=g.filter(p=>p.used!==null&&p.limit!==null).map(p=>p.limit-p.used),keepers=g.filter(M.keeper),retire=g.filter(M.retireNow);
   const r=avg(later);
   const verdict=r===null?'상한·핵심 스탯을 입력하면 진단해요.':r<=1?'레벨업만으로 거의 상한이에요. 훈련보다 후계 준비 쪽을 보세요.':r<=6?'레벨업 후 조금 남아요. 전지훈련으로 채우면 돼요.':'레벨업 후에도 많이 남아요. 전지훈련·개인훈련 효과가 커요.';
   return '<div class="dk-tile"><h4>'+name+' <span>'+g.length+'명</span></h4><dl>'+
    '<div><dt>상한까지 남은 여유</dt><dd>'+(r===null?'—':f(avg(now))+' → <b>'+f(r)+'</b>')+'</dd><small>핵심 스탯 평균 · 지금 → 목표 레벨 후</small></div>'+
    '<div><dt>남은 레벨업</dt><dd><b>+'+f(lv)+'</b></dd><small>평균 · 전 능력치 +1씩</small></div>'+
    '<div><dt>남은 개인훈련</dt><dd><b>'+(tr.length?f(tr.reduce((a,b)=>a+b,0)):'—')+'</b>회</dd><small>'+(tr.length?'평균 '+f(avg(tr))+'회 · 입력 '+tr.length+'/'+g.length+'명':'완료 횟수·한도 미입력')+'</small></div></dl>'+
    '<p class="dk-verdict">'+verdict+'</p>'+
    (keepers.length?'<p class="dk-keep">유지 대상 '+keepers.length+'명 (2~3각, 33~'+(M.KEEP_UNTIL-1)+'세): '+keepers.map(p=>esc(p.name)+' '+p.age+'세').join(', ')+'<br>'+M.KEEP_UNTIL+'세 은퇴 전까지 계속 쓰는 선수예요. 파워·컨택·선구안 정밀을 우선해요.</p>':'')+
    (retire.length?'<p class="dk-keep">은퇴 시기 '+retire.length+'명 ('+M.KEEP_UNTIL+'세+ 2~3각): '+retire.map(p=>esc(p.name)).join(', ')+'<br>경험 전수로 후계자에게 넘기세요.</p>':'')+(capd.length<g.length?'<p class="dk-muted">상한 미입력 '+(g.length-capd.length)+'명은 계산에서 빠져요.</p>':'')+'</div>';
  };
  box.innerHTML='<span class="dk-badge">우리 팀 현황</span><h3>얼마나 더 클 수 있나</h3><div class="dk-tiles">'+tile('batter')+tile('pitcher')+'</div>';
 }

 // ── ③ 이번 전지훈련 ───────────────────────
 function camp(){
  const box=$('camp');if(!box)return;
  if(!pool().some(p=>p.cap!==null)){box.innerHTML='<p class="dk-empty">상한을 입력한 선수가 있어야 전지훈련 결과를 계산해요.</p>';return;}
  const all=rankAll(),top=all[0],seq=sequence(),e=effect(seq),c=cost(),total=seq.length*c,s=data.settings;
  const lines=[];
  const part=(type,name)=>{const x=e[type];if(!x.n)return;if(!seq.some(id=>id.startsWith(type))){lines.push('<b>'+name+'</b>는 이번 조합에 캠프가 없어요. 핵심 스탯 평균 '+(x.before===null?'—':f(x.before))+', 상한까지 '+(x.room===null?'—':f(x.room))+' 남아요.');return;}
   lines.push('<b>'+name+'</b> 핵심 스탯 평균 '+(x.before===null?'—':f(x.before)+' → <b>'+f(x.after)+'</b> ('+sign(x.after-x.before)+')')+', 상한까지 평균 '+(x.room===null?'—':f(x.room))+' 남아요.'+(x.none?' '+x.none+'명은 이미 상한이라 효과 없음.':''));};
  part('batter','타자');part('pitcher','투수');
  // 왜 이 조합인가
  const why=[],base=baseCache,bats=pool().filter(p=>p.type==='batter'&&p.cap!==null);
  const capped=bats.filter(p=>BAT_CORE.every(k=>p.stats[k]===undefined||base.players.find(q=>q.id===p.id).stats[k]>=p.cap)&&BAT_CORE.some(k=>p.stats[k]!==undefined));
  const keepers=pool().filter(M.keeper),pit=pool().filter(p=>p.type==='pitcher'&&p.cap!==null);
  if(capped.length)why.push('타자 '+capped.length+'명('+capped.slice(0,4).map(p=>esc(p.name)).join(', ')+(capped.length>4?' 등':'')+')은 레벨업 후 파워·컨택·선구안이 이미 상한이라 정밀을 올려도 효과가 없어요.');
  const dropping=keepers.filter(p=>p.age>=35);
  if(dropping.length)why.push('유지 대상 중 35세 이상('+dropping.map(p=>esc(p.name)+' '+p.age+'세').join(', ')+')은 정산마다 -3씩 떨어져요. '+M.KEEP_UNTIL+'세까지 지명타자로 쓸 선수라 떨어진 파워·컨택·선구안을 채우는 건 두 배로 쳐서 계산했어요.');
  if(keepers.length>dropping.length)why.push('33~34세 유지 대상('+keepers.filter(p=>p.age<35).map(p=>esc(p.name)).join(', ')+')은 아직 안 떨어져서 다른 선수와 똑같이 계산해요.');
  if(pit.length){const young=pit.filter(p=>p.age!==null&&p.age<30).length,room=effect([]).pitcher.room;why.push('투수 '+pit.length+'명 중 '+young+'명이 30세 미만이라 오른 스탯을 오래 써요. 핵심 스탯은 상한까지 평균 '+(room===null?'—':f(room))+' 남아 있어요.');}
  const runner=all.slice(1).filter(r=>r.seq.length).slice(0,2);
  const advice=[];
  if(choice==='manual'&&top&&top.score-e.score>=0.5)advice.push('추천 조합('+describe(top.seq)+')이 효율 점수로 '+f(top.score-e.score)+' 더 높아요.');
  if(choice!=='manual'&&top&&top.seq.length<maxSessions())advice.push((maxSessions()-top.seq.length)+'회는 더 돌려도 오를 게 없어서 골드를 아끼는 게 나아요.');
  if(total>s.gold)advice.unshift('<span class="dk-bad">예산 초과</span>: 1회 '+f(c)+'골드 × '+seq.length+'회 = '+f(total)+'골드.');
  const partial=pool().some(p=>p.cap!==null&&campKeys(p).length<(p.type==='batter'?21:9));

  box.innerHTML='<div class="dk-pick" role="group" aria-label="전지훈련 조합">'+
   [['best','추천 (효율 최고)'],['manual','직접 짜서 비교']].map(([id,t])=>'<button type="button" class="btn'+(choice===id?' dk-primary':'')+'" data-choice="'+id+'" aria-pressed="'+(choice===id)+'">'+t+'</button>').join('')+'</div>'+
   (choice==='manual'?'<div class="dk-grid dk-slots">'+Array.from({length:Math.max(1,s.sessions)},(_,i)=>'<label>'+(i+1)+'회차<select data-camp-slot="'+i+'"><option value="">안 함</option>'+['pitcher:종합','batter:종합',...PRECISION].map(id=>'<option value="'+id+'"'+(manual[i]===id?' selected':'')+'>'+label(id)+'</option>').join('')+'</select></label>').join('')+'</div>':'')+
   '<div class="dk-result"><p class="dk-seq">'+(choice==='manual'?'내 조합: ':'이번엔 ')+'<b>'+describe(seq)+'</b>'+(choice==='manual'?'':' 가세요')+'</p><p class="dk-muted">'+seq.length+'회 · '+f(total)+'골드 · 효율 점수 '+f(e.score)+'</p>'+
   '<ul>'+lines.map(l=>'<li>'+l+'</li>').join('')+'</ul>'+
   (advice.length?'<ul class="dk-advice">'+advice.map(a=>'<li>'+a+'</li>').join('')+'</ul>':'')+
   (choice!=='manual'&&why.length?'<h4>왜 이 조합인가요</h4><ul>'+why.map(w=>'<li>'+w+'</li>').join('')+'</ul>':'')+
   (choice!=='manual'&&runner.length?'<h4>다음으로 좋은 조합</h4><ul>'+runner.map(r=>'<li>'+describe(r.seq)+' <span class="dk-muted">(효율 '+f(r.score)+', '+f(r.score-top.score)+')</span></li>').join('')+'</ul>':'')+
   (e.invalid?'<p class="dk-warning">이미 한 정밀훈련이나 중복 정밀 '+e.invalid+'회는 효과에서 뺐어요.</p>':'')+
   (partial?'<p class="dk-muted">능력치를 다 넣지 않은 선수는 종합 캠프를 입력한 능력치 중 약한 4개로 추정했어요.</p>':'')+
   '<p class="dk-muted">'+(s.mode==='target'?'목표 레벨까지 올린 뒤':'현재 스탯')+' 기준 추정 · 정밀 +3.5, 종합 +1.5 · 효율 점수는 핵심 스탯 ×1, 나머지 ×0.5, 35~37세 유지 대상의 파워·컨택·선구안 ×2에 남은 사용 기간(35세, 2~3각 타자는 38세까지, 최대 5년)을 곱해 합산해요. 35세 이상은 정산 -3이 반영된 스탯으로 넣어 주세요.</p></div>'+
   '<details class="dk-more"><summary>선수별 전지훈련 후 예상 스탯</summary>'+table(e)+'</details>';
 }
 function table(e){
  const rows=pool().filter(p=>p.cap!==null&&core(p).length).map(p=>{const a=e.sim.players.find(q=>q.id===p.id),ks=core(p).slice(0,p.type==='batter'?3:4);
   return '<tr><th>'+esc(p.name)+(M.keeper(p)?' <em>유지</em>':'')+'</th><td>'+ks.map(k=>esc(k.replace(' ',''))+' '+f(a.stats[k])).join('<br>')+'</td><td>'+p.cap+'</td></tr>';});
  return rows.length?'<div class="dk-scroll"><table class="dk-table"><thead><tr><th>선수</th><th>캠프 후 핵심 스탯</th><th>상한</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'<p class="dk-muted">핵심 스탯을 입력한 선수가 없어요.</p>';
 }

 // ── ① 선수별 훈련 안내 ─────────────────────
 function guide(){
  const box=$('guide');if(!box)return;const ps=pool();
  if(!ps.length){box.innerHTML='<p class="dk-empty">선수를 등록하면 선수마다 “무슨 훈련을 올릴지” 알려줘요.</p>';return;}
  const e=effect(sequence());
  box.innerHTML=ps.slice().sort((a,b)=>(a.type===b.type?0:a.type==='batter'?-1:1)||(b.age??0)-(a.age??0)).map(p=>{
   const a=e.sim.players.find(q=>q.id===p.id),ks=entered(p),cs=core(p),left=p.used!==null&&p.limit!==null?p.limit-p.used:null;
   let head,body=[];
   if(p.cap===null){head='상한 입력 필요';body.push('상한(포텐셜 +15, 각성 포함)을 넣어야 안내할 수 있어요.');}
   else{
    const byLevel=ks.filter(k=>p.stats[k]<p.cap&&M.project(p,k,'target')>=p.cap);
    const short=ks.map(k=>({k,gap:p.cap-a.stats[k],core:cs.includes(k)})).filter(x=>x.gap>=1).sort((x,y)=>(y.core-x.core)||y.gap-x.gap);
    const coreShort=short.filter(x=>x.core),other=short.filter(x=>!x.core).slice(0,4);
    if(coreShort.length){head='셔플 확정: '+coreShort.slice(0,3).map(x=>x.k).join('·');body.push('<b>개인훈련 셔플에서 이 능력치가 나오면 확정</b>: '+coreShort.map(x=>esc(x.k)+' (상한까지 '+f(x.gap)+')').join(', ')+'.');}
    else if(other.length){head='핵심은 상한 · 약점 보강';body.push('핵심 스탯은 레벨업과 이번 캠프로 상한에 닿아요. 남는 건 '+other.map(x=>esc(x.k)+' '+f(x.gap)).join(', ')+'.');}
    else{head='훈련 필요 없음';body.push('레벨업과 이번 캠프로 입력한 능력치가 모두 상한에 닿아요.');}
    if(coreShort.length&&other.length)body.push('그다음 약점: '+other.map(x=>esc(x.k)+' '+f(x.gap)).join(', ')+'.');
    if(byLevel.length)body.push('<span class="dk-muted">레벨업만으로 상한 도달 → 훈련하지 마세요: '+byLevel.map(esc).join(', ')+'</span>');
    if(p.type==='pitcher'&&cs.length)body.push('<span class="dk-muted">구종은 구위·제구를 고르게 키우세요. 격차가 크면 약한 구종을 거의 안 던져요.</span>');
   }
   // 개인훈련 슬롯 사용 판단 (guide/22: 성장형에게만, 35세+ 정산 -3).
   const room=p.cap===null?null:avg(cs.map(k=>p.cap-a.stats[k]));
   let slot;
   if(M.retireNow(p))slot='<b>'+M.KEEP_UNTIL+'세, 은퇴 시기예요.</b> 훈련에 더 쓰지 말고 경험 전수로 후계자(30세 이하·Lv10 이하)에게 넘기세요.';
   else if(M.keeper(p))slot='유지 대상이에요. 개인훈련보다 <b>전지훈련 파워·컨택·선구안 정밀</b>로 '+(p.age>=35?'정산 -3을 메우세요':'타격을 유지하세요')+'. '+M.KEEP_UNTIL+'세에 은퇴하니 후계자도 같이 키우세요.';
   else if(p.age!==null&&p.age>=35)slot='35세+라 정산마다 -3이에요. 개인훈련 슬롯은 쓰지 말고 후계자를 준비하세요.';
   else if(p.age!==null&&p.age>=30)slot='30대라 슬롯은 아끼고 전지훈련으로 유지하세요.';
   else if(room!==null&&room<=2)slot='상한이 가까워서 슬롯 효율이 낮아요. 더 어린 성장형에게 쓰세요.';
   else slot='성장형이에요. 개인훈련 슬롯을 써도 좋아요'+(left!==null?' (남은 '+left+'회)':'')+'. 셔플은 무료·골드까지만 쓰세요.';
   body.push(slot);
   if(M.retireNow(p))head='은퇴 시기 · 경험 전수';
   return '<details class="dk-coach-player"><summary><span><b>'+esc(p.name)+'</b> <small>'+esc(p.position)+' · '+(p.age??'?')+'세 · '+p.awaken+'각 · Lv'+p.level+(M.keeper(p)?' · 유지':M.retireNow(p)?' · 은퇴 시기':'')+'</small></span><em>'+esc(head)+'</em></summary>'+body.map(b=>'<p>'+b+'</p>').join('')+
    (p.cap!==null&&ks.length?'<div class="dk-scroll"><table class="dk-table"><thead><tr><th>능력치</th><th>지금</th><th>레벨업 후</th><th>캠프 후</th><th>상한</th></tr></thead><tbody>'+ks.sort((x,y)=>(cs.includes(y)-cs.includes(x))).map(k=>'<tr'+(cs.includes(k)?' class="dk-core"':'')+'><th>'+esc(k)+'</th><td>'+f(p.stats[k])+'</td><td>'+f(M.project(p,k,'target'))+'</td><td>'+f(a.stats[k])+'</td><td>'+p.cap+'</td></tr>').join('')+'</tbody></table></div>':'')+'</details>';
  }).join('')+'<p class="dk-muted">캠프 후 값은 위에서 고른 전지훈련 조합 기준이에요. 개인훈련(랜덤 2개 +1)은 결과가 랜덤이라 예상치에 넣지 않았어요.</p>';
 }

 function render(){if(!data)return;team();camp();guide();}
 document.addEventListener('deck-analysis',e=>{data=e.detail;ranked=null;baseCache=null;render();});
 document.addEventListener('click',e=>{
  const c=e.target.closest('[data-choice]');if(c&&data){choice=c.dataset.choice;if(choice==='manual'&&!manual.length)manual=best();render();return;}
  if(e.target.closest('[data-coach-add]'))$('new')?.click();
 });
 document.addEventListener('change',e=>{if(!e.target.matches('[data-camp-slot]'))return;manual=[...document.querySelectorAll('[data-camp-slot]')].map(el=>el.value).filter(Boolean);render();});
})();
