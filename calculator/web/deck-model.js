(function(scope){
  'use strict';
  const batting=['파워','컨택','선구안','스피드','멘탈','주루판단','스타트','번트','적응력','지구력','수비범위','반응속도','포구','어깨','송구전환','핸들링','스쿱','타구판단','점프타이밍','수비지휘','펜스처리','포구안정','리드','블로킹','도루저지','프레이밍','홈블로킹'];
  const pitching=['구속','체력','순간구위','멘탈','피칭IQ','수비관여','복구력'];
  const pitches=['포심','투심','커터','슬라이더','커브','체인지업','스플리터','싱커'];
  const pitchStats=pitches.flatMap(p=>[p+' 구위',p+' 제구']);
  const keys={batter:batting,pitcher:[...pitching,...pitchStats]};
  const positions={batter:['DH','1B','2B','3B','SS','LF','CF','RF','C'],pitcher:['SP','RP','CP']};
  const location=['1군','2군','유학','부상','보관함'];
  const weight={'주전':3,'후계 후보':2,'육성':2,'후보':1};
  function number(v,min,max,label,optional=false){if(v===''||v===null||v===undefined){if(optional)return null;throw Error(label+'을 입력하세요.');}const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' 범위를 확인하세요.');return n;}
  function player(raw){
    if(!raw||typeof raw!=='object')throw Error('선수 형식을 확인하세요.');
    const type=raw.type;if(!keys[type])throw Error('타자/투수 구분을 확인하세요.');
    const p={id:String(raw.id||'').slice(0,100),type,name:String(raw.name||'').trim().slice(0,60),position:raw.position,status:raw.status,priority:raw.priority,stats:{}};
    if(!p.id||!p.name)throw Error('선수 이름과 ID가 필요합니다.');
    if(!positions[type].includes(p.position)||!location.includes(p.status)||!weight[p.priority])throw Error('포지션·소속·육성 구분을 확인하세요.');
    p.age=number(raw.age,19,60,'나이',true);p.star=number(raw.star,3,5,'등급');p.awaken=number(raw.awaken,0,3,'각성');p.level=number(raw.level,1,30,'현재 레벨');p.target=number(raw.target,p.level,30,'목표 레벨');
    for(const k of ['age','star','awaken','level','target'])if(p[k]!==null&&!Number.isInteger(p[k]))throw Error('나이·등급·각성·레벨은 정수로 입력하세요.');
    p.cap=number(raw.cap,1,300,'기본 상한',true);p.ovr=number(raw.ovr,0,300,'현재 OVR',true);p.used=number(raw.used,0,70,'훈련 횟수',true);p.limit=number(raw.limit,0,70,'훈련 한도',true);
    for(const k of ['used','limit'])if(p[k]!==null&&!Number.isInteger(p[k]))throw Error('훈련 횟수는 정수로 입력하세요.');
    if(p.used!==null&&p.limit!==null&&p.used>p.limit)throw Error('완료 횟수가 훈련 한도보다 큽니다.');
    p.successorId=String(raw.successorId||'').slice(0,100);
    if(p.successorId===p.id)throw Error('자기 자신을 후계자로 지정할 수 없습니다.');
    p.traits=String(raw.traits||'').slice(0,500);p.memo=String(raw.memo||'').slice(0,1000);
    for(const k of keys[type]){const n=number(raw.stats?.[k],0,500,k,true);if(n!==null)p.stats[k]=n;}
    return p;
  }
  function project(p,k,mode='target'){if(p.stats[k]===undefined)return null;const value=p.stats[k]+(mode==='target'?p.target-p.level:0);return p.cap===null?value:Math.min(p.cap,value);}
  function eligible(p){return p.status!=='보관함';}
  function candidates(players,mode='target',done=[]){
    const out=[];
    for(const type of ['batter','pitcher']){
      const group=players.filter(p=>eligible(p)&&p.type===type);
      for(const stat of [...keys[type],'종합']){
        const id=type+':'+stat;if(done.includes(id))continue;
        const general=stat==='종합',affected=[];let low=0,high=0,score=0,unknown=0;
        for(const p of group){
          if(p.cap===null){unknown++;continue;}
          if(!general&&p.stats[stat]===undefined){unknown++;continue;}
          // A general camp needs the entire group recorded: an unentered low stat could change the chosen four.
          const required=type==='batter'?batting.slice(0,21):pitching;
          const owned=type==='pitcher'?pitches.filter(pitch=>p.stats[pitch+' 구위']!==undefined||p.stats[pitch+' 제구']!==undefined).flatMap(pitch=>[pitch+' 구위',pitch+' 제구']):[];
          const campKeys=[...required,...owned];
          if(general&&campKeys.some(k=>p.stats[k]===undefined)){unknown++;continue;}
          const gaps=(general?campKeys:[stat]).map(k=>({k,gap:Math.max(0,p.cap-project(p,k,mode))})).filter(x=>x.gap>0).sort((a,b)=>b.gap-a.gap).slice(0,general?4:1);
          if(!gaps.length)continue;
          const a=gaps.reduce((n,x)=>n+Math.min(x.gap,general?1:3),0),b=gaps.reduce((n,x)=>n+Math.min(x.gap,general?2:4),0);
          low+=a;high+=b;score+=(a+b)/2*weight[p.priority];affected.push({id:p.id,name:p.name,priority:p.priority,low:a,high:b,stats:gaps.map(x=>x.k)});
        }
        out.push({id,type,stat,general,label:(type==='batter'?'야수':'투수')+' '+(general?'종합':stat+' 정밀'),low,high,score,unknown,affected});
      }
    }
    return out.sort((a,b)=>b.score-a.score||b.low-a.low||a.label.localeCompare(b.label,'ko'));
  }
  function plan(players,settings){
    const copy=JSON.parse(JSON.stringify(players));const done=[...settings.done],steps=[];let left=settings.gold;
    const roster=players.filter(eligible).length,cost=Math.max(roster,settings.roster)*700;
    if(!cost)return {steps,cost,left};
    // Materialize the selected level scenario once before simulating camp effects.
    copy.forEach(p=>{Object.keys(p.stats).forEach(k=>p.stats[k]=project(p,k,settings.mode));p.target=p.level;});
    for(let i=0;i<settings.sessions&&left>=cost;i++){
      const best=candidates(copy,'current',done).find(c=>c.score>0);if(!best)break;
      steps.push(best);left-=cost;if(!best.general)done.push(best.id);
      for(const a of best.affected){const p=copy.find(p=>p.id===a.id);for(const k of a.stats)p.stats[k]=Math.min(p.cap,p.stats[k]+(best.general?1.5:3.5));}
    }
    return {steps,cost,left};
  }
  function core(p){
    if(p.type==='pitcher')return ['순간구위','멘탈','피칭IQ',...(p.position==='SP'?['체력']:['복구력'])];
    if(p.position==='SS'||p.position==='2B')return ['수비범위','반응속도','포구','어깨','컨택','선구안'];
    if(p.position==='C')return ['포구안정','리드','블로킹','도루저지','컨택','선구안'];
    if(p.position==='CF')return ['수비범위','타구판단','스피드','컨택','선구안'];
    return ['파워','컨택','선구안','멘탈'];
  }
  function succession(players){
    return players.filter(p=>p.priority==='주전'&&p.status!=='보관함'&&((p.age!==null&&p.age>=30)||p.successorId)).map(p=>{
      const pool=players.filter(q=>q.id!==p.id&&q.type===p.type&&q.position===p.position&&(p.successorId?q.id===p.successorId:q.age!==null&&q.age<p.age&&q.age<35));
      const compare=q=>{const common=core(p).filter(k=>p.stats[k]!==undefined&&q.stats[k]!==undefined);if(common.length<3)return null;const avg=f=>common.reduce((n,k)=>n+f(k),0)/common.length;return {p:q,now:avg(k=>project(q,k,'current')-project(p,k,'current')),future:avg(k=>project(q,k)-project(p,k)),count:common.length};};
      const ranked=pool.map(compare).filter(Boolean).sort((a,b)=>b.now-a.now||b.future-a.future);
      const top=ranked[0];let state=!pool.length?'후계자 준비 필요':!top?'후보 스탯 입력 필요':top.now>=0?'교체 검토':'후계자 육성 중';
      if(p.age<35&&top)state=p.age>=33&&top.now<0?'후계자 우선 육성':p.age===32?'후계자 육성 점검':'미리 준비';
      const warning=p.age===null?'나이 미입력 · 지정 후계자 비교':p.age>=35?'35세 이상 · 시즌 정산마다 전 능력치 -3에 대비':p.age>=33?'33~34세 · 후계자 준비 상태 우선 점검':p.age===32?'32세 · 후계자 육성 시작·성장 비교':'30세부터 후계 후보 확보 · 즉시 교체할 필요는 없습니다.';
      return {player:p,state,candidate:top||null,selected:pool[0]||null,pool:pool.length,warning};
    }).sort((a,b)=>b.player.age-a.player.age);
  }
  scope.DeckModel={batting,pitching,pitches,pitchStats,keys,positions,location,weight,player,project,eligible,candidates,plan,succession};
})(typeof module==='object'?module.exports:window);
