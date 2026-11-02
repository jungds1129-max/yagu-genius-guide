(() => {
  'use strict';
  const batter=[['타격·주루',['파워','컨택','선구안','스피드','멘탈','주루판단','스타트','번트','적응력','지구력']],['수비',['수비범위','반응속도','포구','어깨','송구전환','핸들링','스쿱','타구판단','점프타이밍','수비지휘','펜스처리']]];
  const pitcher=['구속','체력','순간구위','멘탈','피칭IQ','수비관여','복구력'];
  const catcher=['포구안정','리드','블로킹','도루저지','프레이밍','홈블로킹'];
  const pitches=['포심','투심','커터','슬라이더','커브','체인지업','스플리터','싱커'];
  const attack=['파워','컨택','선구안','멘탈'];
  const profiles={
    DH:{label:'지명타자 · 공격 중심',keys:attack,why:'파워·컨택·선구안·멘탈을 보는 공격 역할'},
    '1B':{label:'1루수',keys:[...attack,'핸들링','스쿱'],why:'공격 능력과 1루 포구를 함께 보는 역할'},
    '2B':{label:'2루수',keys:['수비범위','반응속도','포구','송구전환','어깨','컨택','선구안','멘탈'],why:'범위·포구·송구가 중요한 내야 역할'},
    '3B':{label:'3루수',keys:['반응속도','포구','어깨','송구전환',...attack],why:'빠른 반응·송구와 공격을 함께 보는 역할'},
    SS:{label:'유격수',keys:['수비범위','반응속도','포구','송구전환','어깨','컨택','선구안','멘탈'],why:'범위·반응·송구가 중요한 내야 역할'},
    LF:{label:'좌익수',keys:[...attack,'타구판단','스피드','어깨'],why:'공격 비중을 높이고 외야 판단·송구를 함께 보는 역할'},
    CF:{label:'중견수',keys:['수비범위','타구판단','스피드','점프타이밍','수비지휘','컨택','선구안','멘탈'],why:'넓은 수비 범위·타구 판단·스피드가 중요한 역할'},
    RF:{label:'우익수',keys:[...attack,'타구판단','스피드','어깨'],why:'공격 비중을 높이고 외야 판단·송구를 함께 보는 역할'},
    C:{label:'포수',keys:['포구안정','리드','블로킹','도루저지','프레이밍','포구','컨택','선구안','멘탈'],why:'포구 안정·리드·블로킹·도루저지·프레이밍이 중요한 역할'},
    SP:{label:'선발',keys:['체력','피칭IQ','멘탈','복구력','순간구위'],why:'긴 이닝을 위한 체력·피칭IQ와 주무기 완성도를 보는 보직'},
    RP:{label:'불펜',keys:['순간구위','멘탈','복구력'],why:'2스트라이크 결정력·멘탈·회복과 주무기 완성도를 보는 보직'},
    CP:{label:'마무리',keys:['순간구위','멘탈'],why:'2스트라이크 결정력·멘탈과 결정구 구위·제구를 보는 보직'}
  };
  function growth(current,target){
    if(!Number.isInteger(current)||current<1||current>30)throw Error('현재 레벨은 1~30의 정수로 입력해 주세요.');
    if(!Number.isInteger(target)||target<1||target>30)throw Error('목표 레벨은 1~30의 정수로 입력해 주세요.');
    if(target<current)throw Error('목표 레벨은 현재 레벨 이상으로 설정해 주세요.');
    return target-current;
  }
  function predict(raw,delta,badInput=false){
    if(badInput)throw Error('숫자를 입력해 주세요');
    if(String(raw).trim()==='')return null;
    const value=Number(raw);
    if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER-30)throw Error('0 이상의 숫자를 입력해 주세요');
    return delta===null?null:value+delta;
  }
  function rankTraining(entries,profile,main,context){
    const p=profiles[profile];
    if(!p)throw Error('포지션을 선택해 주세요.');
    const important=e=>p.keys.includes(e.name)||(profile==='SP'||profile==='RP'||profile==='CP')&&e.id.startsWith('st-pitch-'+main+'-');
    const core=entries.filter(important),outside=entries.filter(e=>!important(e));
    if(context.used!==null&&context.limit!==null&&context.used>=context.limit)return {core,items:[],outside,blocked:true,capped:[]};
    const extraTraining=context.used!==null&&context.used>=55;
    const capped=core.filter(e=>context.cap!==null&&e.projected>=context.cap&&!extraTraining);
    const eligible=core.filter(e=>!capped.includes(e)).sort((a,b)=>a.projected-b.projected||a.label.localeCompare(b.label,'ko'));
    return {core,items:core.length>=3?eligible.slice(0,3):[],outside,blocked:false,capped,extraTraining};
  }
  function campPlan(entries,isPitcher,cap){
    if(isPitcher)return '투수 종합 캠프를 우선 검토하세요. 상한 미달인 약한 능력치 4개에 각각 +1~2가 적용됩니다. 개인훈련 한도와는 별개이며, 반복 횟수는 비시즌 전체 예산에 맞춰 정하세요.';
    const names=['파워','컨택','선구안'].filter(name=>!entries.some(e=>e.name===name&&cap!==null&&e.projected>=cap));
    return names.length?'타자 정밀 우선 후보: '+names.join(' · ')+'. 각 능력치 +3~4, 같은 비시즌에 같은 능력치는 한 번만 가능합니다. 핵심 항목이 상한에 닿으면 스피드·멘탈 등 상한 미달 항목이나 야수 종합을 검토하세요.':'파워·컨택·선구안은 목표 레벨에서 상한에 닿습니다. 레벨업을 먼저 하고, 스피드·멘탈 등 상한 미달 항목의 정밀 또는 야수 종합을 검토하세요.';
  }
  const root=document.getElementById('stats-panel');
  if(!root)return;
  const $=id=>document.getElementById('st-'+id);
  let role='batter';
  const states={batter:{current:'1',target:'30',profile:'DH',cap:'',used:'',limit:'',main:'0'},pitcher:{current:'1',target:'30',profile:'SP',cap:'',used:'',limit:'',main:'0'}};
  const meta={};const fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:10});
  function field(id,name,label=name){meta[id]={id,name,label};return `<div class="st-field"><label for="${id}">${name}</label><div class="st-pair"><input id="${id}" type="number" min="0" step="any" inputmode="decimal" placeholder="현재" aria-label="${label} 현재 스탯" data-stat aria-describedby="st-rule ${id}-error"><span aria-hidden="true">→</span><output for="${id}" data-result="${id}" aria-label="${label} 목표 레벨 스탯">—</output></div><span class="st-error" id="${id}-error" hidden></span></div>`;}
  $('batter').innerHTML=batter.map(([name,items],g)=>`<section class="st-group"><div class="st-group-head"><h3>${name}</h3><span data-st-target></span></div><div class="st-grid">${items.map((name,i)=>field('st-b-'+g+'-'+i,name)).join('')}</div></section>`).join('')+`<section class="st-group" id="st-catcher" hidden><div class="st-group-head"><h3>포수 전용 능력치</h3><span data-st-target></span></div><div class="st-grid">${catcher.map((name,i)=>field('st-c-'+i,name)).join('')}</div></section>`;
  $('pitcher').innerHTML=`<section class="st-group"><div class="st-group-head"><h3>특수 능력치</h3><span data-st-target></span></div><div class="st-grid">${pitcher.map((name,i)=>field('st-p-'+i,name)).join('')}</div></section><section class="st-group"><div class="st-group-head"><h3>구종별 능력치</h3><span data-st-target></span></div><p class="st-hint">보유 구종만 입력하세요. 주무기는 위에서 선택한 구종으로 추천합니다.</p><div class="st-pitches">${pitches.map((name,i)=>`<section class="st-pitch"><h4>${name}</h4><div class="st-grid">${field('st-pitch-'+i+'-power','구위',name+' 구위')}${field('st-pitch-'+i+'-control','제구',name+' 제구')}</div></section>`).join('')}</div></section><details class="st-speed"><summary>구종 최대구속 참고 입력 <span>km · 레벨 가산 제외</span></summary><p class="st-hint">‘구속’ 능력치 점수와 구분합니다. km는 참고용으로만 기록합니다.</p><div class="st-grid">${pitches.map((name,i)=>`<label class="st-velocity" for="st-speed-${i}">${name}<span><input id="st-speed-${i}" type="number" min="0" step="any" inputmode="decimal" placeholder="미입력" aria-label="${name} 최대구속 km"><span>km</span></span></label>`).join('')}</div></details>`;
  $('main').innerHTML=pitches.map((name,i)=>`<option value="${i}">${name}</option>`).join('');
  function parse(id,optional=false){const raw=$(id).value.trim();return raw===''?(optional?null:NaN):Number(raw);}
  function loadState(){const s=states[role];['current','target','cap','used','limit','main'].forEach(id=>$(id).value=s[id]);const choices=role==='batter'?['DH','1B','2B','3B','SS','LF','CF','RF','C']:['SP','RP','CP'];$('profile').innerHTML=choices.map(key=>`<option value="${key}">${profiles[key].label}</option>`).join('');$('profile').value=s.profile;}
  function saveState(){const s=states[role];['current','target','profile','cap','used','limit','main'].forEach(id=>s[id]=$(id).value);}
  function recommendation(entries,delta){
    const list=$('recommendations');list.replaceChildren();
    const rawCap=parse('cap',true),campCap=Number.isFinite(rawCap)&&rawCap>0?rawCap:null;
    $('camp-plan').textContent=delta===null?'레벨 입력을 확인하면 전지훈련 방향을 표시합니다.':campPlan(entries,role==='pitcher',campCap);
    $('reco-error').hidden=true;$('reco-note').textContent='';$('reco-lower').textContent='';
    if(delta===null){$('reco-status').textContent='레벨 입력을 확인하면 추천을 표시합니다.';return;}
    try{
      const context={cap:parse('cap',true),used:parse('used',true),limit:parse('limit',true)};
      if(context.cap!==null&&(!Number.isFinite(context.cap)||context.cap<=0))throw Error('추천용 기본 상한은 0보다 큰 숫자로 입력해 주세요.');
      for(const key of ['used','limit'])if(context[key]!==null&&(!Number.isInteger(context[key])||context[key]<0))throw Error('훈련 회차·한도는 0 이상의 정수로 입력해 주세요.');
      const profile=$('profile').value,r=rankTraining(entries,profile,$('main').value,context);
      $('reco-error').hidden=true;
      const notes=[];
      if(context.cap===null)notes.push('기본 상한 미입력');
      if(context.used===null||context.limit===null)notes.push('남은 훈련 횟수 미확인');
      else notes.push('남은 훈련 '+Math.max(0,context.limit-context.used)+'회');
      if(r.extraTraining)notes.push('56회차 이후 추가 성장 후보 · 기본 상한과 별도');
      $('reco-note').textContent=notes.join(' · ');
      $('reco-lower').textContent=r.capped.length?'후순위 · 목표 레벨에서 상한에 닿는 항목: '+r.capped.map(e=>e.label).join(', '):r.outside.length?'낮음 · 선택한 역할의 핵심 항목 밖: '+r.outside.slice(0,4).map(e=>e.label).join(', '):'';
      if(r.blocked){$('reco-status').textContent='남은 훈련 횟수가 없습니다. 한도 확장 가능 여부부터 확인하세요.';return;}
      if(r.core.length<3){$('reco-status').textContent='선택한 역할의 핵심 능력치를 3개 이상 입력하면 추천합니다.';return;}
      if(!r.items.length){$('reco-status').textContent='입력한 핵심 능력치가 목표 레벨에서 기본 상한에 닿습니다. 레벨업을 먼저 검토하세요.';return;}
      $('reco-status').textContent=profiles[profile].label+' · 핵심 항목 중 목표 스탯이 낮은 순서';
      r.items.forEach((item,i)=>{
        const row=document.createElement('li');row.className='st-reco-item';
        const heading=document.createElement('div');heading.className='st-reco-heading';
        const name=document.createElement('strong');name.textContent=(i===0?'최우선':'좋음')+' · '+item.label;
        const value=document.createElement('span');value.textContent=fmt(item.current)+' → '+fmt(item.projected);
        heading.append(name,value);
        const why=document.createElement('p');why.textContent=profiles[profile].why+'입니다. 상한·횟수 조건을 확인한 후보 중 '+(i+1)+'번째로 낮습니다. 개인훈련 셔플 결과를 고를 때 참고하세요.';
        row.append(heading,why);list.append(row);
      });
    }catch(e){$('reco-error').textContent=e.message;$('reco-error').hidden=false;$('reco-status').textContent='추천용 선택 입력을 확인해 주세요.';$('reco-note').textContent='';$('reco-lower').textContent='';}
  }
  function render(){
    let delta=null;
    try{delta=growth(parse('current'),parse('target'));$('level-error').hidden=true;$('rule-title').textContent='Lv'+parse('current')+' → Lv'+parse('target');$('rule-gain').textContent='각 능력치 +'+delta;}
    catch(e){$('level-error').textContent=e.message;$('level-error').hidden=false;$('rule-title').textContent='레벨 입력 확인';$('rule-gain').textContent='—';}
    $('main-field').hidden=role!=='pitcher';$('catcher').hidden=role!=='batter'||$('profile').value!=='C';
    root.querySelectorAll('[data-st-target]').forEach(el=>el.textContent=delta===null?'현재 → 목표':'현재 → Lv'+parse('target'));
    const panel=$(''+role),entries=[];
    let total=0;
    panel.querySelectorAll('[data-stat]').forEach(input=>{
      if(input.closest('#st-catcher')&&$('catcher').hidden)return;
      total++;
      const output=root.querySelector('[data-result="'+input.id+'"]'),error=document.getElementById(input.id+'-error');
      try{const value=predict(input.value,delta,input.validity.badInput);output.textContent=value===null?'—':fmt(value);output.classList.toggle('st-filled',value!==null);input.removeAttribute('aria-invalid');error.hidden=true;error.textContent='';if(value!==null)entries.push({...meta[input.id],current:Number(input.value),projected:value});}
      catch(e){output.textContent='—';output.classList.remove('st-filled');input.setAttribute('aria-invalid','true');error.textContent=e.message;error.hidden=false;}
    });
    $('progress').textContent=entries.length+' / '+total+'개 입력';recommendation(entries,delta);
  }
  root.addEventListener('input',e=>{if(e.target.matches('input,select')){saveState();render();}});
  root.querySelectorAll('[data-st-role]').forEach(button=>button.addEventListener('click',()=>{saveState();role=button.dataset.stRole;root.querySelectorAll('[data-st-role]').forEach(b=>b.setAttribute('aria-pressed',b===button));['batter','pitcher'].forEach(name=>$(''+name).hidden=name!==role);loadState();render();}));
  $('clear').addEventListener('click',()=>{$(''+role).querySelectorAll('input').forEach(input=>input.value='');render();});
  loadState();render();
})();
