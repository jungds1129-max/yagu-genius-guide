// 덱 관리 코치 화면: 팀 현황 → 이번 전지훈련 안내 → 선수별 훈련 안내.
// 근거: guide/22 (레벨업 1회 전 능력치 +1, 정밀 +3~4, 종합 약한 4개 +1~2, 35세+ 정산마다 -3, 개인훈련 랜덤 2개 +1).
(() => {
 'use strict';
 const M=window.DeckModel;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const f=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
 const sign=n=>(n>0?'+':'')+f(n);
 const $=id=>document.getElementById('dk-'+id);
 let data=null,choice='mine',manual=[];
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

 function simulate(seq){
  const mode=data.settings.mode;
  const copy=data.players.map(p=>({...p,stats:Object.fromEntries(entered(p).map(k=>[k,M.project(p,k,mode)])),target:p.level}));
  const done=new Set(data.settings.done);let invalid=0;
  for(const id of seq){
   const row=M.candidates(copy,'current',[...done]).find(r=>r.id===id);
   if(!row){invalid++;continue;}
   if(!row.general)done.add(id);
   for(const a of row.affected){const p=copy.find(q=>q.id===a.id);for(const k of a.stats)p.stats[k]=Math.min(p.cap,p.stats[k]+(row.general?1.5:3.5));}
  }
  return {players:copy,invalid};
 }
 // 사용자 기본안: 투수 종합 6 + 타자 종합 1 (횟수가 모자라면 투수 쪽을 줄인다).
 function mine(){const n=maxSessions();if(n<=0)return [];if(n===1)return ['pitcher:종합'];return [...Array(Math.min(6,n-1)).fill('pitcher:종합'),'batter:종합'];}
 // 추천안: 상한 여유가 남은 파워·컨택·선구안 정밀 먼저 → 투수 종합 최대 4 → 타자 종합 → 투수 종합.
 function recommended(){
  const out=[],n=maxSessions(),s=data.settings;
  for(const k of ['컨택','파워','선구안']){
   if(out.length>=n)break;const id='batter:'+k;if(s.done.includes(id))continue;
   if(pool().some(p=>p.type==='batter'&&p.cap!==null&&p.stats[k]!==undefined&&M.project(p,k,s.mode)<p.cap))out.push(id);
  }
  while(out.length<n){
   const sim=simulate(out),rows=M.candidates(sim.players,'current',[...s.done,...out.filter(id=>!id.endsWith(':종합'))]);
   const pc=out.filter(id=>id==='pitcher:종합').length,ok=id=>rows.find(r=>r.id===id&&r.affected.length);
   const best=(pc<4&&ok('pitcher:종합'))||ok('batter:종합')||ok('pitcher:종합');if(!best)break;out.push(best.id);
  }
  return out;
 }
 function sequence(){return choice==='mine'?mine():choice==='rec'?recommended():manual.slice(0,7);}
 function describe(seq){const c={};seq.forEach(id=>c[id]=(c[id]||0)+1);return Object.entries(c).map(([id,n])=>label(id)+(n>1?' '+n+'회':'')).join(' + ')||'선택 없음';}

 // 플랜 결과를 타입별로 요약.
 function effect(seq){
  const sim=simulate(seq),base=simulate([]),out={};
  for(const type of ['batter','pitcher']){
   const ps=pool().filter(p=>p.type===type&&p.cap!==null);let before=[],after=[],room=[],gain=0,none=0,counted=0;
   for(const p of ps){const a=sim.players.find(q=>q.id===p.id),b=base.players.find(q=>q.id===p.id),ks=core(p);let g=0;
    for(const k of entered(p))g+=a.stats[k]-b.stats[k];gain+=g;counted++;if(g<=0)none++;
    for(const k of ks){before.push(b.stats[k]);after.push(a.stats[k]);room.push(p.cap-a.stats[k]);}}
   out[type]={n:ps.length,before:avg(before),after:avg(after),room:avg(room),gain,none,counted};
  }
  return {...out,invalid:sim.invalid,sim};
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
  const seq=sequence(),e=effect(seq),c=cost(),total=seq.length*c,s=data.settings;
  const rec=recommended(),er=effect(rec),mineSeq=mine();
  const lines=[];
  const part=(type,name)=>{const x=e[type];if(!x.n)return;
   lines.push('<b>'+name+'</b> 핵심 스탯 평균 '+(x.before===null?'—':f(x.before)+' → <b>'+f(x.after)+'</b> ('+sign(x.after-x.before)+')')+', 상한까지 평균 '+(x.room===null?'—':f(x.room))+' 남아요.'+(x.none?' '+x.none+'명은 이미 상한이라 효과가 없어요.':''));};
  part('batter','타자');part('pitcher','투수');
  const keepers=pool().filter(M.keeper),hasPrecision=seq.some(id=>BAT_CORE.some(k=>id==='batter:'+k));
  const advice=[];
  if(keepers.length&&!hasPrecision){
   const freeCore=BAT_CORE.find(k=>!s.done.includes('batter:'+k));
   const swap=seq.includes('batter:종합')?seq.map(id=>id==='batter:종합'&&freeCore?'batter:'+freeCore:id):[...seq.slice(0,-1),freeCore?'batter:'+freeCore:seq.at(-1)];
   const es=effect(swap),kg=list=>keepers.reduce((n,p)=>{const a=list.sim.players.find(q=>q.id===p.id),b=e.sim.players.find(q=>q.id===p.id);return n+BAT_CORE.reduce((m,k)=>m+((a.stats[k]??0)-(b.stats[k]??0)),0);},0);
   if(freeCore&&kg(es)>0)advice.push('유지 대상('+keepers.map(p=>esc(p.name)).join(', ')+')이 있어요. '+(seq.includes('batter:종합')?'타자 종합 1회를':'1회를')+' <b>타자 '+freeCore+' 정밀</b>로 바꾸면 이 선수들 핵심 스탯이 합계 '+sign(kg(es))+' 더 올라요.');
  }
  if(e.pitcher.n&&e.pitcher.none>=Math.ceil(e.pitcher.n/2)&&seq.filter(id=>id==='pitcher:종합').length>=3)advice.push('투수 절반 이상이 상한이라 종합 캠프 효과가 없어요. 투수 종합 횟수를 줄이고 타자 쪽에 쓰는 게 나아요.');
  if(e.batter.n&&e.batter.room!==null&&e.batter.room<=0.5&&seq.some(id=>id.startsWith('batter')))advice.push('타자 핵심 스탯은 거의 상한이에요. 타자 캠프는 스피드·멘탈 같은 미달 능력치로 돌리세요.');
  const tg=x=>x.batter.gain+x.pitcher.gain;
  if(choice!=='rec'&&tg(er)-tg(e)>=1)advice.push('추천안('+describe(rec)+')이 전체 능력치 합계로 '+sign(tg(er)-tg(e))+' 더 높아요.');
  if(!advice.length)advice.push(choice==='mine'?'이대로 돌려도 좋아요.':'이 조합 그대로 돌리면 돼요.');
  if(total>s.gold)advice.unshift('<span class="dk-bad">예산 초과</span>: 1회 '+f(c)+'골드 × '+seq.length+'회 = '+f(total)+'골드. 골드나 횟수를 확인하세요.');
  const partial=pool().some(p=>p.cap!==null&&entered(p).length<(p.type==='batter'?21:9));

  box.innerHTML='<div class="dk-pick" role="group" aria-label="전지훈련 조합">'+
   [['mine','투수 종합 '+mineSeq.filter(id=>id==='pitcher:종합').length+' + 타자 종합 '+mineSeq.filter(id=>id==='batter:종합').length],['rec','추천안'],['manual','직접 짜기']].map(([id,t])=>'<button type="button" class="btn'+(choice===id?' dk-primary':'')+'" data-choice="'+id+'" aria-pressed="'+(choice===id)+'">'+t+'</button>').join('')+'</div>'+
   (choice==='manual'?'<div class="dk-grid dk-slots">'+Array.from({length:Math.max(1,s.sessions)},(_,i)=>'<label>'+(i+1)+'회차<select data-camp-slot="'+i+'"><option value="">안 함</option>'+[['pitcher:종합'],['batter:종합'],...['파워','컨택','선구안','스피드','멘탈'].map(k=>['batter:'+k])].map(([id])=>'<option value="'+id+'"'+(manual[i]===id?' selected':'')+'>'+label(id)+'</option>').join('')+'</select></label>').join('')+'</div>':'')+
   '<div class="dk-result"><p class="dk-seq"><b>'+describe(seq)+'</b> · '+seq.length+'회 · '+f(total)+'골드</p>'+
   '<ul>'+lines.map(l=>'<li>'+l+'</li>').join('')+'</ul>'+
   '<h4>그래서 이렇게 하세요</h4><ul class="dk-advice">'+advice.map(a=>'<li>'+a+'</li>').join('')+'</ul>'+
   (e.invalid?'<p class="dk-warning">이미 한 정밀훈련이나 같은 정밀 중복 '+e.invalid+'회는 효과에서 뺐어요.</p>':'')+
   (partial?'<p class="dk-muted">일부 선수는 능력치를 다 입력하지 않아서, 종합 캠프는 입력한 능력치 중 약한 4개로 추정했어요.</p>':'')+
   '<p class="dk-muted">'+(s.mode==='target'?'목표 레벨까지 올린 뒤':'현재 스탯')+' 기준 · 정밀 +3.5, 종합 +1.5 중간값으로 계산한 추정이에요.</p></div>'+
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
 document.addEventListener('deck-analysis',e=>{data=e.detail;render();});
 document.addEventListener('click',e=>{
  const c=e.target.closest('[data-choice]');if(c&&data){choice=c.dataset.choice;if(choice==='manual'&&!manual.length)manual=mine();render();return;}
  if(e.target.closest('[data-coach-add]'))$('new')?.click();
 });
 document.addEventListener('change',e=>{if(!e.target.matches('[data-camp-slot]'))return;manual=[...document.querySelectorAll('[data-camp-slot]')].map(el=>el.value).filter(Boolean);render();});
})();
