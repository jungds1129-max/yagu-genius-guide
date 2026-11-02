(() => {
  'use strict';
  const levels=[1620,1756,1903,2060,2223,2393,2570,2752,2940,3132,3329,3531,3737,3947,4161,4380,4601,4827,5056,5288,5524,5763,6006,6251,6500,6751,7005,7263,7523];
  const materials=[
    {name:'1성 카드',star:1,exp:50,gold:500},
    {name:'2성 카드',star:2,exp:150,gold:1000},
    {name:'3성 카드',star:3,exp:350,gold:2000},
    {name:'4성 카드',star:4,exp:750,gold:5000},
    {name:'5성 카드',star:5,exp:1500,gold:10000},
    {name:'2000 경험치권',star:0,exp:2000,gold:10000}
  ];
  const corrections=[1,.7,.45,.25,.1];
  const ceil=n=>Math.ceil(n-1e-9);
  function required(current,target,earned){
    if(!Number.isInteger(current)||current<1||current>29)throw Error('현재 레벨은 1~29의 정수로 입력해 주세요.');
    if(!Number.isInteger(target)||target<2||target>30)throw Error('목표 레벨은 2~30의 정수로 입력해 주세요.');
    if(target<=current)throw Error('목표 레벨은 현재 레벨보다 높아야 합니다.');
    if(!Number.isFinite(earned)||earned<0)throw Error('현재 쌓인 경험치는 0 이상의 숫자로 입력해 주세요.');
    if(earned>=levels[current-1])throw Error('현재 쌓인 경험치는 다음 레벨까지 필요한 경험치('+levels[current-1].toLocaleString('ko-KR')+')보다 작아야 합니다.');
    return levels.slice(current-1,target-1).reduce((a,b)=>a+b,0)-earned;
  }
  function repeated(need,actual){
    if(!Number.isFinite(actual)||actual<=0)throw Error('1회 경험치는 0보다 큰 숫자로 입력해 주세요.');
    const count=ceil(need/actual);
    return {actual,count,excess:Math.max(0,count*actual-need)};
  }
  function materialResult(need,targetStar,material){
    const factor=material.star?corrections[Math.max(0,targetStar-material.star)]:1;
    const r=repeated(need,material.exp*factor);
    return {...r,factor,gold:r.count*material.gold,unitGold:material.gold/r.actual};
  }
  function studyResult(need,exp){const r=repeated(need,exp);return {...r,days:ceil(r.count/2)};}
  function gameResult(need,base,role,bullpen,premium){
    if(!['batter','starter','bullpen'].includes(role))throw Error('포지션을 선택해 주세요.');
    if(!Number.isFinite(base)||base<=0)throw Error('1회 기본 경험치는 0보다 큰 숫자로 입력해 주세요.');
    if(role==='bullpen'&&(!Number.isInteger(bullpen)||bullpen<1))throw Error('하루 등판 횟수는 1 이상의 정수로 입력해 주세요.');
    const r=repeated(need,base*(premium?1.15:1));
    const daily=role==='batter'?9:role==='starter'?1.8:bullpen;
    const days=ceil(r.count/daily);
    return {...r,daily,days,weeks:days/5};
  }
  const root=document.getElementById('experience-panel');
  if(!root)return;
  const $=id=>root.querySelector('#xp-'+id);
  const num=(id,optional=false)=>$(id).value.trim()===''?(optional?0:NaN):Number($(id).value);
  const fmt=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:2});
  const gameBases={batter:160,starter:400,bullpen:90};
  let lastRole='batter',studyEdited=false;
  const attempt=fn=>{try{return fn()}catch(e){return {error:e.message}}};
  function render(){
    const method=$('method').value,isCard=/^[0-5]$/.test(method),isStudy=method==='study',isGame=method==='game',premium=$('premium').checked;
    $('study-inputs').hidden=!isStudy;$('game-inputs').hidden=!isGame;$('card-note').hidden=!isCard;
    $('transfers').hidden=$('star').value!=='5';$('bullpen-field').hidden=$('role').value!=='bullpen';
    $('gold-field').hidden=!isCard;$('days-field').hidden=isCard;$('weeks-field').hidden=!isGame;
    $('study-status').textContent=studyEdited?'직접 입력값 · 프리미엄 추가 보정 없음':premium?'기본 898 EXP · 프리미엄 적용 실측':'기본 816 EXP · 프리미엄 미적용 추정';
    $('game-status').textContent=premium?'프리미엄 사용 중 · 입력한 기본 EXP에 ×1.15 적용':'프리미엄 미사용 · 입력한 기본 EXP 그대로 적용';
    try{
      const need=required(num('current'),num('target'),num('earned',true)),star=num('star');
      if(![3,4,5].includes(star))throw Error('대상 선수 등급을 선택해 주세요.');
      const role=$('role').value;
      const cards=materials.map(m=>({...m,...materialResult(need,star,m)}));
      const study=attempt(()=>studyResult(need,num('study-exp')));
      const batter=attempt(()=>gameResult(need,gameBases.batter,'batter',2,premium));
      let selected,unit,detail;
      if(isCard){selected=cards[Number(method)];unit='장';
        detail=selected.star?'등급 보정 '+fmt(selected.factor*100)+'% (추정)':'2000 경험치권 · 등급 보정 없음';
        detail+=' · 프리미엄 보정 미적용 (영향 미확인)';
        if(selected.star>star)detail+=' · 상위 등급 재료의 100% 적용은 미확인';
      }else if(isStudy){selected=study;if(selected.error)throw Error(selected.error);unit='회';detail='12시간에 1회 · 하루 2회 · 골드 비용 미계산';
      }else if(isGame){selected=gameResult(need,num('game-exp'),role,num('bullpen'),premium);unit=role==='batter'?'경기':'등판';
        const schedule=role==='batter'?'하루 9경기 · 주 45경기':role==='starter'?'5인 로테이션 · 하루 평균 1.8등판 · 주 9등판':'하루 '+fmt(selected.daily)+'등판';
        detail=schedule+' · 평일 기준'+(premium?' · 프리미엄 ×1.15':' · 프리미엄 미적용');
      }else throw Error('경험치 획득 방법을 선택해 주세요.');
      $('error').hidden=true;$('outputs').hidden=false;
      $('needed').textContent=fmt(need)+' EXP';$('range').textContent=star+'성 · Lv'+num('current')+' → Lv'+num('target');
      $('result-method').textContent=isCard?selected.name:isStudy?'유학':'2군 '+({batter:'야수',starter:'선발',bullpen:'불펜'}[role]);
      $('count-label').textContent=isCard?'필요 재료':isStudy?'필요 유학 횟수':'필요 경기·등판';
      $('count').textContent=fmt(selected.count)+unit;$('actual').textContent=fmt(selected.actual)+' EXP';
      $('excess').textContent=fmt(selected.excess)+' EXP';$('gold').textContent=isCard?fmt(selected.gold)+' 골드':'-';
      $('days-label').textContent=isGame?'필요 일수 · 평일':'필요 일수';
      $('days').textContent=!isCard?fmt(selected.days)+'일':'';
      $('weeks').textContent=isGame?selected.weeks.toFixed(1)+'주':'';$('detail').textContent=detail;
      const comparison=cards.slice(2),cheapest=Math.min(...comparison.map(c=>c.gold));
      let rows=comparison.map((c,i)=>'<tr class="'+(c.gold===cheapest?'xp-cheapest':'')+'"><th scope="row">'+c.name+(method===String(i+2)?'<span class="xp-tag">선택</span>':'')+(c.gold===cheapest?'<span class="xp-tag">최저 골드</span>':'')+(c.star>star?'<small>상위 등급 보정 미확인</small>':'')+'</th><td>'+fmt(c.count)+'장</td><td>'+fmt(c.gold)+'</td><td>'+c.unitGold.toFixed(2)+'</td><td>-</td></tr>').join('');
      const otherRow=(name,result,suffix,info)=>'<tr><th scope="row">'+name+'<small>'+info+'</small></th>'+(result.error?'<td colspan="4">1회 경험치 입력 확인</td>':'<td>'+fmt(result.count)+suffix+'</td><td>-</td><td>-</td><td>'+fmt(result.days)+(name==='2군 야수'?'평일':'일')+'</td>')+'</tr>';
      rows+=otherRow('유학',study,'회',study.error?'입력 확인':fmt(study.actual)+' EXP/회');
      rows+=otherRow('2군 야수',batter,'경기',batter.error?'입력 확인':fmt(batter.actual)+' EXP/경기 · '+batter.weeks.toFixed(1)+'주');
      $('rows').innerHTML=rows;
      $('rows').querySelectorAll('tr').forEach(row=>{[...row.querySelectorAll('td')].forEach((cell,i)=>cell.dataset.label=['장수·횟수','골드','골드/EXP','일수'][i])});
      $('comparison-note').textContent='3·4·5성 카드와 2000권 중 총 골드가 가장 적은 행을 강조합니다. 골드/EXP는 장당 골드 ÷ 장당 실제 EXP입니다. 유학·2군은 골드 미계산이며, 2군은 평일 기준입니다.';
      $('game-warning').hidden=!isGame;
    }catch(e){$('error').textContent=e.message;$('error').hidden=false;$('outputs').hidden=true;}
  }
  root.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{
    if(el.id==='xp-role'&&lastRole!==el.value){lastRole=el.value;$('game-exp').value=gameBases[lastRole];}
    if(el.id==='xp-game-exp')gameBases[lastRole]=num('game-exp');
    if(el.id==='xp-study-exp')studyEdited=true;
    if(el.id==='xp-premium'){$('study-exp').value=el.checked?898:816;studyEdited=false;}
    render();
  }));
  root.querySelectorAll('[data-transfer]').forEach(b=>b.addEventListener('click',()=>{$('current').value=b.dataset.transfer;$('earned').value=0;render()}));
  render();
})();
