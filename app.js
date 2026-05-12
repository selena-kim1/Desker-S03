// DSSDAY 컨테이너 입고 모니터링 - App Logic
const ITEMS=['DSSDAY0909','DSSDAY1809','DSSDAY1709','DSSDAY0904'];
var ctrs=[],outs=[],initSt={},defDet=14;

function showAdmin(){
  var pw=prompt('관리자 비밀번호:');
  if(pw!=='desker2024'){alert('비밀번호가 틀렸습니다.');return;}
  document.getElementById('admin-panel').style.display='block';
  renderAdminInit();
}
function hideAdmin(){
  document.getElementById('admin-panel').style.display='none';
}
function renderAdminInit(){
  var h='';
  ITEMS.forEach(function(it){
    h+='<div style="display:flex;align-items:center;gap:6px;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #ddd">';
    h+='<label style="margin:0;font-size:11px;color:#185FA5;white-space:nowrap">'+it.replace('DSSDAY','')+'</label>';
    h+='<input type="number" id="ainit_'+it+'" value="'+(initSt[it]||0)+'" min="0" style="width:70px;font-size:12px;padding:4px 6px;border:1px solid #ddd;border-radius:4px">개</div>';
  });
  document.getElementById('admin-init-grid').innerHTML=h;
  document.getElementById('admin-det').value=defDet;
}
function adminSaveInit(){
  ITEMS.forEach(function(it){
    var el=document.getElementById('ainit_'+it);
    if(el) initSt[it]=parseInt(el.value||0);
  });
  defDet=parseInt(document.getElementById('admin-det').value)||14;
  setAdminStatus('재고 초기값 설정됨. [구글 시트에 저장] 을 누르세요.','warn');
  renderDash();
}
function setAdminStatus(msg,type){
  var cls=type==='ok'?'al-ok':type==='warn'?'al-w':'al-d';
  var el=document.getElementById('admin-status');
  if(el) el.innerHTML='<div class="al '+cls+'">'+msg+'</div>';
}
function parseCSVRFC(text){
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  var records=[],i=0,n=text.length;
  function parseRecord(){
    var fields=[];
    while(i<n){
      var field='';
      if(text[i]==='"'){
        i++;
        while(i<n){
          if(text[i]==='"'){
            if(i+1<n&&text[i+1]==='"'){field+='"';i+=2;}
            else{i++;break;}
          } else {
            field+=text[i++];
          }
        }
      } else {
        while(i<n&&text[i]!==','&&text[i]!=='\r'&&text[i]!=='\n'){
          field+=text[i++];
        }
      }
      fields.push(field.replace(/\n/g,' ').trim());
      if(i<n&&text[i]===',') i++;
      else break;
    }
    if(i<n&&text[i]==='\r') i++;
    if(i<n&&text[i]==='\n') i++;
    return fields;
  }
  var headers=null;
  while(i<n){
    var rec=parseRecord();
    if(!rec.length||(rec.length===1&&!rec[0])) continue;
    if(!headers){ headers=rec; }
    else{ var row={}; headers.forEach(function(h,j){row[h]=rec[j]||'';}); records.push(row); }
  }
  return records;
}
function normCode(c){
  var m=String(c).toUpperCase().trim().match(/^(DSSDAY\d{4})/);
  return m?m[1]:'';
}
function pDate(s){
  if(!s) return '';
  s=String(s).trim();
  var m;
  if((m=s.match(/^(\d{2})\/(\d{2})\/(\d{2})/))) return '20'+m[1]+'-'+m[2]+'-'+m[3];
  if((m=s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/))) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  return '';
}
function adminHandleCSV(file){
  if(!file) return;
  var rb=new FileReader();
  rb.onload=function(e){
    var buf=new Uint8Array(e.target.result),isUtf8=true;
    for(var i=0;i<buf.length;i++){
      var b=buf[i],extra=0;
      if(b<=0x7F) continue;
      else if(b>=0xC2&&b<=0xDF) extra=1;
      else if(b>=0xE0&&b<=0xEF) extra=2;
      else if(b>=0xF0&&b<=0xF4) extra=3;
      else{isUtf8=false;break;}
      for(var j=1;j<=extra;j++){
        if(i+j>=buf.length||buf[i+j]<0x80||buf[i+j]>0xBF){isUtf8=false;break;}
      }
      if(!isUtf8) break;
      i+=extra;
    }
    var rt=new FileReader();
    rt.onload=function(e2){
      var text=e2.target.result;
      var rows=parseCSVRFC(text);
      if(!rows.length){setAdminStatus('CSV 데이터가 없습니다.','danger');return;}
      var hkeys=Object.keys(rows[0]);
      function nH(h){return h.replace(/\n/g,' ').replace(/ +/g,' ').trim();}
      function eCol(k,nm){return k.find(function(h){return nH(h)===nm;})||null;}
      function pCol(k,ts,ex){
        return k.find(function(h){
          var nm=nH(h);
          return ts.some(function(t){return nm.includes(t);})&&
                 (!ex||!ex.some(function(ev){return nm.includes(ev);}));
        });
      }
      var colCtr=pCol(hkeys,['CNTR No']);
      var colEta=pCol(hkeys,['수식) ETA','(수식) ETA']);
      var colFt=pCol(hkeys,['터미널','FT: 10일'],['통관','컨테이너']);
      var colCode=eCol(hkeys,'단품코드')||pCol(hkeys,['단품코드'],['색상','-색상']);
      var colQty=eCol(hkeys,'수량')||pCol(hkeys,['수량'],['BX']);
      var colPlan=eCol(hkeys,'입고일')||pCol(hkeys,['입고일'],['ODCY','수입']);
      var colStatus=eCol(hkeys,'진행상태')||pCol(hkeys,['진행상태']);
      var colOdcy=pCol(hkeys,['ODCY 입고일','ODCY입고일']);
      var colOdcyYn=pCol(hkeys,['ODCY 반입여부','반입여부']);
      if(!colCode){setAdminStatus('단품코드 컬럼을 찾을 수 없습니다.','danger');return;}
      var ITEMS_L=['DSSDAY0909','DSSDAY1809','DSSDAY1709','DSSDAY0904'];
      var added=0,skipped=0;
      rows.filter(function(r){return ITEMS_L.includes(normCode(r[colCode]||''));}).forEach(function(r){
        var no=String(r[colCtr]||'').trim();
        var code=normCode(r[colCode]||'');
        var qty=parseInt(r[colQty]||0);
        if(!no||!code||!qty){skipped++;return;}
        var existing=ctrs.find(function(c){return c.no===no&&c.item===code;});
        if(existing){
          var pd=pDate(r[colPlan]||'');
          var fd=pDate(r[colFt]||'');
          if(pd&&!existing.planDate) existing.planDate=pd;
          if(fd&&!existing.ftDeadline) existing.ftDeadline=fd;
          var st=String(r[colStatus]||'').trim();
          if(st) existing.csvStatus=st;
          skipped++;return;
        }
        var status=String(r[colStatus]||'').trim();
        var planDate=pDate(r[colPlan]||'');
        var actualDate='';
        if(status==='입고완료') actualDate=planDate||today();
        ctrs.push({
          id:Date.now()+Math.random(),
          no:no,eta:pDate(r[colEta]||''),ftDeadline:pDate(r[colFt]||''),
          detDays:defDet,item:code,qty:qty,planDate:planDate,
          odcyInDate:pDate(r[colOdcy]||''),
          odcyYn:colOdcyYn?String(r[colOdcyYn]||'').trim():'',
          actualDate:actualDate,csvStatus:status,src:'csv'
        });
        added++;
      });
      setAdminStatus('CSV 완료 — 신규 '+added+'개 / 건너뜀 '+skipped+'개. [구글 시트에 저장] 누르세요.','ok');
      renderDash();
    };
    rt.readAsText(file,isUtf8?'UTF-8':'EUC-KR');
  };
  rb.readAsArrayBuffer(file);
}
function adminHandleXLS(files){
  if(!files||!files.length) return;
  var added=0,errors=[],fileArr=Array.from(files),idx=0;
  function next(){
    if(idx>=fileArr.length){
      var msg=(errors.length?errors.join('\n')+'\n':'')+'XLS '+added+'건 완료. [구글 시트에 저장] 누르세요.';
      setAdminStatus(msg,'ok');
      renderDash();
      return;
    }
    var file=fileArr[idx++];
    var ITEMS_L=['DSSDAY0909','DSSDAY1809','DSSDAY1709','DSSDAY0904'];
    var item=ITEMS_L.find(function(it){return file.name.toUpperCase().includes(it);});
    if(!item){errors.push('['+file.name+'] 품목코드 없음');next();return;}
    var reader=new FileReader();
    reader.onload=function(e){
      var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false});
      if(!rows.length){next();return;}
      var hkeys=Object.keys(rows[0]);
      function nH(h){return String(h).replace(/\n/g,' ').trim();}
      var colDate=hkeys.find(function(h){return nH(h).includes('확정납기');});
      var colQty=hkeys.find(function(h){return nH(h)==='주문잔량';})||
                 hkeys.find(function(h){return nH(h).includes('주문잔량');});
      var colName=hkeys.find(function(h){return nH(h).includes('건명');});
      if(!colDate||!colQty){errors.push('['+file.name+'] 컬럼 없음');next();return;}
      outs=outs.filter(function(o){return!(o.item===item&&o.src==='xls');});
      rows.forEach(function(r){
        var name=nH(String(r[colName]||''));
        if(name==='Sub Total'||name==='합계'||!name) return;
        var dateRaw=nH(String(r[colDate]||''));
        if(!dateRaw) return;
        var d=dateRaw.replace(/[./]/g,'-')
                     .replace(/^(\d{4})-(\d{1,2})-(\d{1,2}).*/,'$1-$2-$3')
                     .replace(/-(\d)(?=-|$)/g,'-0$1');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        var qty=parseInt(String(r[colQty]).replace(/,/g,'')||0)||0;
        if(qty<=0) return;
        outs.push({id:Date.now()+Math.random(),date:d,item:item,qty:qty,src:'xls'});
        added++;
      });
      next();
    };
    reader.readAsArrayBuffer(file);
  }
  next();
}
function adminHandleJson(file){
  if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(data.ctrs) ctrs=data.ctrs;
      if(data.outs) outs=data.outs;
      if(data.initSt) initSt=data.initSt;
      if(data.defDet) defDet=parseInt(data.defDet)||14;
      renderAdminInit();
      setAdminStatus('JSON 복원 완료 — 컨테이너 '+ctrs.length+'개 / 출고 '+outs.length+'건. [구글 시트에 저장] 누르세요.','ok');
      renderDash();
    }catch(err){
      setAdminStatus('JSON 오류: '+err.message,'danger');
    }
  };
  reader.readAsText(file,'UTF-8');
}
function saveToSheet(){
  ITEMS.forEach(function(it){
    var el=document.getElementById('ainit_'+it);
    if(el) initSt[it]=parseInt(el.value||0);
  });
  defDet=parseInt(document.getElementById('admin-det').value)||14;
  var data=JSON.stringify({ctrs:ctrs,outs:outs,initSt:initSt,defDet:defDet});
  setAdminStatus('저장 중...','warn');
  google.script.run
    .withSuccessHandler(function(res){
      var r=JSON.parse(res);
      if(r.success){
        setAdminStatus('구글 시트 저장 완료! ('+r.time+') — 팀원 새로고침 시 반영됩니다.','ok');
        renderDash();
      } else {
        setAdminStatus('저장 실패: '+r.error,'danger');
      }
    })
    .withFailureHandler(function(err){
      setAdminStatus('오류: '+err.message,'danger');
    })
    .saveData(data);
}
function loadDataFromServer(){
  document.getElementById('sync-badge').textContent='데이터 로딩 중...';
  google.script.run
    .withSuccessHandler(function(data){
      ctrs=data.ctrs||[];
      outs=data.outs||[];
      initSt=data.initSt||{};
      defDet=data.defDet||14;
      document.getElementById('sync-badge').textContent='업데이트: '+data.lastUpdated;
      var _td=today();
      var ce=document.getElementById('c-eta');if(ce) ce.value=_td;
      var od=document.getElementById('o-date');if(od) od.value=_td;
      var dd=document.getElementById('def-det');if(dd) dd.value=defDet;
      var df=document.getElementById('d-from');if(df) df.value=addDays(_td,-7);
      var dt=document.getElementById('d-to');if(dt) dt.value=addDays(_td,30);
      fixOdcyPlanMix();
      renderDash();
    })
    .withFailureHandler(function(err){
      document.getElementById('sync-badge').textContent='로드 실패';
      console.error(err);
    })
    .getData();
}



function save(){}
function load(){}

function today(){
  let d=new Date();
  // KST (UTC+9) 기준 날짜 반환
  let kst=new Date(d.getTime()+9*60*60*1000);
  return kst.toISOString().slice(0,10);
}
function addDays(s,n){let d=new Date(s);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function diffDays(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}
function fmtD(s){if(!s)return'—';try{let d=new Date(s);if(isNaN(d))return s;return(d.getMonth()+1)+'월'+(d.getDate())+'일';}catch(e){return s;}}
function parseDate(s){
  if(!s)return'';s=String(s).trim();
  let m;
  if((m=s.match(/^(\d{2})\/(\d{2})\/(\d{2})/)))return'20'+m[1]+'-'+m[2]+'-'+m[3];
  if((m=s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)))return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  return'';
}
function normalizeCode(code){
  code=String(code).toUpperCase().trim();
  let m=code.match(/^(DSSDAY\d{4})/);
  return m?m[1]:'';
}

// ODCY 이고 권장일: FT마감 기준, 토→금, 일→금
function odcyRecommend(ftDeadline){
  if(!ftDeadline)return'';
  let d=new Date(ftDeadline);
  let wd=d.getDay(); // 0=일,6=토
  if(wd===6)d.setDate(d.getDate()-1);       // 토→금
  else if(wd===0)d.setDate(d.getDate()-2);  // 일→금
  return d.toISOString().slice(0,10);
}

// ETA + 60일 = ODCY 디텐션 마감
function det60Deadline(eta){
  if(!eta)return'';
  let d=new Date(eta);
  d.setDate(d.getDate()+60);
  return d.toISOString().slice(0,10);
}
function buildCtrMap(list){
  let m={};
  list.forEach(c=>{
    if(!m[c.no])m[c.no]={no:c.no,bl:c.bl,eta:c.eta,ftDeadline:c.ftDeadline,planDate:c.planDate,actualDate:c.actualDate,csvStatus:c.csvStatus,src:c.src,items:[],id:c.id};
    m[c.no].items.push({item:c.item,qty:c.qty,id:c.id});
    if(!m[c.no].ftDeadline&&c.ftDeadline)m[c.no].ftDeadline=c.ftDeadline;
    if(!m[c.no].planDate&&c.planDate)m[c.no].planDate=c.planDate;
    if(c.actualDate)m[c.no].actualDate=c.actualDate;
  });
  return m;
}

// 기존 저장 데이터 중 planDate가 odcyInDate와 같은 경우 자동 정정
function fixOdcyPlanMix(){
  let fixed=0;
  ctrs.forEach(c=>{
    if(c.planDate && c.odcyInDate && c.planDate===c.odcyInDate && !c.actualDate){
      c.planDate='';
      fixed++;
    }
  });
  if(fixed>0){save();console.log('planDate/odcyInDate 혼용 정정: '+fixed+'건');}
}

// 기존 저장 데이터 중 planDate가 odcyInDate와 같은 경우 자동 정정
function fixOdcyPlanMix(){
  let fixed=0;
  ctrs.forEach(c=>{
    if(c.planDate&&c.odcyInDate&&c.planDate===c.odcyInDate&&!c.actualDate){
      c.planDate='';fixed++;
    }
  });
  if(fixed>0){save();console.log('planDate/odcyInDate 혼용 정정: '+fixed+'건');}
}

function sw(t){
  document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('active',['dashboard','priority','import','containers','daily','outbound','settings'][i]===t));
  document.querySelectorAll('.sec').forEach(el=>el.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  if(t==='dashboard')renderDash();
  if(t==='priority')renderPriority();
  if(t==='containers')renderCtrTable();
  if(t==='daily')renderDaily();
  if(t==='outbound')renderOutTable();
  if(t==='settings')renderSettings();
}

function getStock(){
  const td=today();

  // 오늘 이후 날짜 수집 (오늘 포함)
  let allDates=new Set([td]);
  outs.filter(o=>o.date>=td).forEach(o=>allDates.add(o.date));
  ctrs.filter(c=>!c.actualDate&&c.planDate&&c.planDate>=td).forEach(c=>allDates.add(c.planDate));

  // initSt = 오늘 기준 현재고 (시작점)
  let cur={};ITEMS.forEach(it=>cur[it]=parseInt(initSt[it]||0));
  let daily={};

  [...allDates].sort().forEach(date=>{
    ITEMS.forEach(it=>{
      let inbPlan=ctrs.filter(c=>!c.actualDate&&c.planDate===date&&c.item===it)
        .reduce((s,c)=>s+parseInt(c.qty||0),0);
      let out=outs.filter(o=>o.date===date&&o.item===it)
        .reduce((s,o)=>s+parseInt(o.qty||0),0);

      // 오늘 행: 출고/입고 반영 전 initSt를 먼저 기록
      let initStock=date===td?parseInt(initSt[it]||0):null;

      cur[it]+=inbPlan-out;
      if(!daily[date])daily[date]={};
      daily[date][it]={inb:inbPlan,inbPlan,out,stock:cur[it],initStock};
    });
  });

  return{cur,daily,dates:[...allDates].sort()};
}

function renderDash(){
  const{cur}=getStock();
  const td=today();
  let alertsHtml='';
  ITEMS.forEach(it=>{
    let st=cur[it];
    let arr=outs.filter(o=>o.item===it);
    let ud=new Set(arr.map(o=>o.date)).size;
    let tot=arr.reduce((s,o)=>s+parseInt(o.qty||0),0);
    let avg=ud>0?Math.round(tot/ud):0;
    if(avg>0){let d=Math.floor(st/avg);if(d<=5)alertsHtml+=`<div class="al al-d">⚠ [${it}] 재고 ${st}개 — 약 <strong>${d}일</strong> 후 소진. 즉시 확인</div>`;else if(d<=10)alertsHtml+=`<div class="al al-w">! [${it}] 재고 ${st}개 — 약 <strong>${d}일</strong> 후 소진 예상</div>`;}
  });
  let seen=new Set();
  ctrs.filter(c=>!c.actualDate&&c.ftDeadline).forEach(c=>{
    if(seen.has(c.no))return;seen.add(c.no);
    let diff=diffDays(td,c.ftDeadline);
    if(diff<0)alertsHtml+=`<div class="al al-d">⚠ [${c.no}] FT <strong>${Math.abs(diff)}일 초과</strong> — 디텐션 발생중</div>`;
    else if(diff<=3)alertsHtml+=`<div class="al al-w">! [${c.no}] FT마감 <strong>${diff===0?'오늘':diff+'일 후'}</strong> (${fmtD(c.ftDeadline)})</div>`;
  });
  // ODCY 60일 마감 경고
  let seenOdcy=new Set();
  ctrs.filter(c=>!c.actualDate&&(c.odcyYn==='O'||c.odcyInDate)).forEach(c=>{
    if(seenOdcy.has(c.no))return; seenOdcy.add(c.no);
    let dl60=det60Deadline(c.eta);
    if(!dl60)return;
    let rem=diffDays(td,dl60);
    if(rem<0)alertsHtml+=`<div class="al al-d">⚠ [${c.no}] ODCY 60일 초과 ${Math.abs(rem)}일 — 창고 입고 즉시 필요</div>`;
    else if(rem<=7)alertsHtml+=`<div class="al al-w">! [${c.no}] ODCY 60일 마감 ${rem}일 전 (${fmtD(dl60)}) — 입고 서두르세요</div>`;
  });
  if(!alertsHtml)alertsHtml='<div class="al al-ok">✓ 현재 특이사항 없음</div>';
  document.getElementById('alerts').innerHTML=alertsHtml;

  let total=ITEMS.reduce((s,it)=>s+cur[it],0);
  let ctrNos=new Set(ctrs.filter(c=>!c.actualDate).map(c=>c.no));
  let pending=ctrNos.size;
  let overdue=new Set(ctrs.filter(c=>!c.actualDate&&c.ftDeadline&&diffDays(td,c.ftDeadline)<0).map(c=>c.no)).size;
  let todayCnt=new Set(ctrs.filter(c=>c.planDate===td||c.actualDate===td).map(c=>c.no)).size;
  document.getElementById('summary').innerHTML=`
    <div class="mc"><div class="mc-l">전체 보유재고</div><div class="mc-v">${total}<span>개</span></div></div>
    <div class="mc"><div class="mc-l">미입고 컨테이너</div><div class="mc-v">${pending}<span>개</span></div></div>
    <div class="mc"><div class="mc-l">FT 초과</div><div class="mc-v" style="color:${overdue>0?'#A32D2D':'inherit'}">${overdue}<span>개</span></div></div>
    <div class="mc"><div class="mc-l">금일 입고예정</div><div class="mc-v" style="color:${todayCnt>2?'#A32D2D':'inherit'}">${todayCnt}<span>/2개</span></div></div>`;

  let sb=document.querySelector('#tbl-stock tbody');sb.innerHTML='';
  ITEMS.forEach(it=>{
    let st=cur[it];
    let arr=outs.filter(o=>o.item===it);
    let ud=new Set(arr.map(o=>o.date)).size;
    let tot=arr.reduce((s,o)=>s+parseInt(o.qty||0),0);
    let avg=ud>0?Math.round(tot/ud):0;
    let sj=avg>0?Math.floor(st/avg):null;
    let nc=ctrs.filter(c=>!c.actualDate&&c.item===it&&c.ftDeadline).sort((a,b)=>a.ftDeadline<b.ftDeadline?-1:1)[0];
    let ns=nc?fmtD(nc.planDate||nc.ftDeadline):'없음';
    let bdg=sj===null?'<span class="bdg b-gray">출고미입력</span>':sj<=5?'<span class="bdg b-danger">위험</span>':sj<=10?'<span class="bdg b-warn">주의</span>':'<span class="bdg b-ok">정상</span>';
    sb.innerHTML+=`<tr><td>${it}</td><td><strong>${st}</strong>개</td><td>${avg?avg+'개/일':'—'}</td><td>${sj!==null?'약 '+sj+'일':'—'}</td><td style="color:#185FA5;font-weight:600">${ns}</td><td>${bdg}</td></tr>`;
  });

  let ctrMap=buildCtrMap(ctrs.filter(c=>!c.actualDate));
  let upcoming=Object.values(ctrMap).sort((a,b)=>{let fa=a.ftDeadline||'9999',fb=b.ftDeadline||'9999';return fa<fb?-1:1;});
  let ub=document.querySelector('#tbl-upcoming tbody');ub.innerHTML='';
  if(!upcoming.length){ub.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px;color:#888">미입고 컨테이너 없음</td></tr>';}
  else upcoming.forEach(c=>{
    let fl=c.ftDeadline;let det=fl?addDays(fl,defDet):'';
    let diff=fl?diffDays(td,fl):null;
    let diffBdg=diff===null?'<span class="bdg b-gray">미설정</span>':diff<0?`<span class="bdg b-danger">+${Math.abs(diff)}일</span>`:diff<=3?`<span class="bdg b-warn">${diff}일</span>`:`<span class="bdg b-ok">${diff}일</span>`;
    let itemTags=c.items.map(i=>`<span class="tag" style="font-size:10px">${i.item.replace('DSSDAY','')}×${i.qty}</span>`).join('');
    let rec=c.planDate||fl||'';
    let odcyRec2=odcyRecommend(c.ftDeadline);
    let det60_2=det60Deadline(c.eta);
    let det60Rem2=det60_2?diffDays(td,det60_2):null;
    let det60Bdg2=det60Rem2===null?'—':det60Rem2<0?`<span class="bdg b-danger">+${Math.abs(det60Rem2)}일</span>`:det60Rem2<=10?`<span class="bdg b-warn">${det60Rem2}일</span>`:`${det60Rem2}일`;
    let isOdcy2=c.odcyYn==='O'||!!c.odcyInDate;
    ub.innerHTML+=`<tr><td>${fmtD(c.eta)}</td><td><strong>${c.no}</strong>${isOdcy2?'<span class="bdg b-purple" style="font-size:9px;margin-left:3px">ODCY</span>':''}</td><td>${itemTags}</td><td><strong>${fmtD(fl)}</strong></td><td>${diffBdg}</td><td style="color:#854F0B;font-weight:600">${odcyRec2?fmtD(odcyRec2):'—'}</td><td style="color:#3C3489;font-weight:600">${c.odcyInDate?fmtD(c.odcyInDate):'—'}</td><td>${fmtD(det)}</td><td style="color:#185FA5;font-weight:700">${fmtD(rec)}</td><td><span class="bdg ${c.csvStatus==='입고일확정'?'b-confirm':'b-gray'}">${c.csvStatus||'대기중'}</span></td></tr>`;
  });

  let planMap={};
  ctrs.filter(c=>!c.actualDate&&c.planDate).forEach(c=>{if(!planMap[c.planDate])planMap[c.planDate]=new Set();planMap[c.planDate].add(c.no);});
  let futureDates=Object.keys(planMap).filter(d=>d>=td).sort().slice(0,30);
  let pb=document.querySelector('#tbl-plan tbody');pb.innerHTML='';
  if(!futureDates.length){pb.innerHTML='<tr><td colspan="4" style="text-align:center;padding:12px;color:#888">계획입고일 설정된 컨테이너 없음</td></tr>';}
  else futureDates.forEach(d=>{
    let nos=[...planMap[d]];let cnt=nos.length;let over=cnt>2;
    let qSum=ctrs.filter(c=>c.planDate===d&&!c.actualDate).reduce((s,c)=>s+parseInt(c.qty||0),0);
    pb.innerHTML+=`<tr style="background:${over?'#fff5f5':''}"><td><strong>${fmtD(d)}</strong></td><td>${nos.map(n=>`<span class="tag">${n}</span>`).join('')}</td><td>${qSum}개</td><td><span class="bdg ${over?'b-danger':'b-ok'}">${cnt}/2</span></td></tr>`;
  });
}

let priorityWeekOffset=0;
function moveWeek(d){priorityWeekOffset+=d;renderPriority();}
function goToday(){priorityWeekOffset=0;renderPriority();}

function renderPriority(){
  const td=today();const tdDate=new Date(td);const DET=defDet;
  const SAFETY=40;
  const{cur}=getStock();
  let avgDaily={};
  ITEMS.forEach(it=>{
    let arr=outs.filter(o=>o.item===it);
    let ud=new Set(arr.map(o=>o.date)).size;
    let tot=arr.reduce((s,o)=>s+parseInt(o.qty||0),0);
    avgDaily[it]=ud>0?Math.round(tot/ud):0;
  });
  function daysToSafety(item){
    let stock=cur[item]||0;let avg=avgDaily[item]||0;
    if(avg<=0)return stock>SAFETY?9999:0;
    if(stock<=SAFETY)return 0;
    return Math.floor((stock-SAFETY)/avg);
  }

  let pending=ctrs.filter(c=>!c.actualDate);
  let ctrMap=buildCtrMap(pending);
  let ranked=Object.values(ctrMap).map(c=>{
    let ft=c.ftDeadline?new Date(c.ftDeadline):null;
    let det=ft?new Date(ft.getTime()+DET*86400000):null;
    let ftRem=ft?Math.round((ft-tdDate)/86400000):null;
    let detRem=det?Math.round((det-tdDate)/86400000):null;
    // FT/DET 점수
    let ftScore;
    if(ftRem!==null&&detRem!==null&&detRem<0)ftScore=-1000+detRem;
    else if(ftRem!==null&&ftRem<0)ftScore=-500+ftRem;
    else if(ftRem!==null)ftScore=ftRem*2;
    else ftScore=200;
    // 재고 소진 위험 점수
    let stockScore=0,stockRisk='—';
    c.items.forEach(i=>{
      let stock=cur[i.item]||0;let avg=avgDaily[i.item]||0;
      let ds=daysToSafety(i.item);
      let risk,label;
      if(stock<=0){risk=-300;label=i.item.replace('DSSDAY','')+'재고소진!';}
      else if(stock<SAFETY){risk=-200-(SAFETY-stock);label=i.item.replace('DSSDAY','')+'안전재고이하('+stock+'개)';}
      else if(ds<=5){risk=-100+ds*5;label=i.item.replace('DSSDAY','')+'안전재고임박('+ds+'일)';}
      else if(ds<=14){risk=ds*3;label=i.item.replace('DSSDAY','')+'주의('+ds+'일)';}
      else{risk=ds;label=i.item.replace('DSSDAY','')+'여유('+ds+'일)';}
      if(risk<stockScore||stockScore===0){stockScore=risk;stockRisk=label;}
    });
    // 통합 점수: FT 70% + 재고 30%
    let totalScore=ftScore*0.7+stockScore*0.3;
    return{...c,ft,det,ftRem,detRem,ftScore,stockScore,stockRisk,totalScore};
  }).sort((a,b)=>a.totalScore-b.totalScore);

  // 권장 입고일 배정
  let schedMap={};let assigned={};
  ranked.forEach(c=>{
    let eta=c.eta?new Date(c.eta):null;
    let earliest=eta&&eta>tdDate?new Date(eta):new Date(tdDate);
    let deadline=c.ft||new Date(tdDate.getTime()+30*86400000);
    let cand=c.planDate&&new Date(c.planDate)>=earliest?new Date(c.planDate):new Date(earliest);
    if(cand>deadline)cand=new Date(earliest);
    for(let i=0;i<90;i++){
      let ds=cand.toISOString().slice(0,10);
      if((schedMap[ds]||[]).length<2){(schedMap[ds]=schedMap[ds]||[]).push(c);assigned[c.no]=ds;break;}
      cand=new Date(cand.getTime()+86400000);
    }
  });

  // 주간 캘린더
  const DAYS=['월','화','수','목','금','토','일'];
  let ws=new Date();ws.setHours(0,0,0,0);
  let day=ws.getDay();ws.setDate(ws.getDate()-(day===0?6:day-1)+priorityWeekOffset*7);
  let weekDates=[];for(let i=0;i<7;i++){let d=new Date(ws);d.setDate(ws.getDate()+i);weekDates.push(d);}
  let wLabel=`${ws.getMonth()+1}/${ws.getDate()} ~ ${weekDates[6].getMonth()+1}/${weekDates[6].getDate()}`;
  let cal=`<div style="font-size:12px;font-weight:700;color:#185FA5;margin-bottom:8px;text-align:center">${wLabel}</div>`;
  cal+=`<table style="table-layout:fixed;width:100%;border-collapse:collapse"><thead><tr>`;
  weekDates.forEach((d,i)=>{
    let ds=d.toISOString().slice(0,10);let isToday=ds===td;
    let dayCtrs=schedMap[ds]||[];let over=dayCtrs.length>2;let cnt=dayCtrs.length;
    cal+=`<th style="width:14.28%;padding:6px 4px;text-align:center;background:${isToday?'#E6F1FB':'#fafafa'};border-top:3px solid ${isToday?'#185FA5':'#e8e8e8'};border-right:1px solid #e8e8e8">`;
    cal+=`<div style="font-weight:700;color:${isToday?'#185FA5':i>=5?'#bbb':'#333'}">${DAYS[i]}</div>`;
    cal+=`<div style="font-size:13px;font-weight:700;color:${isToday?'#185FA5':'#1a1a1a'}">${d.getMonth()+1}/${d.getDate()}</div>`;
    cal+=`<div style="margin-top:3px"><span style="font-size:10px;padding:1px 6px;border-radius:3px;font-weight:700;background:${over?'#FCEBEB':cnt>0?'#EAF3DE':'#f0f0f0'};color:${over?'#A32D2D':cnt>0?'#3B6D11':'#aaa'}">${cnt}/2</span></div></th>`;
  });
  cal+=`</tr></thead><tbody><tr>`;
  weekDates.forEach(d=>{
    let ds=d.toISOString().slice(0,10);let isToday=ds===td;let dayCtrs=schedMap[ds]||[];
    cal+=`<td style="vertical-align:top;padding:4px;background:${isToday?'#f0f7ff':''};border-right:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;min-height:80px">`;
    if(!dayCtrs.length){cal+=`<div style="color:#ddd;font-size:11px;text-align:center;padding:8px 0">—</div>`;}
    else dayCtrs.forEach(c=>{
      let fr=c.ftRem;
      let bg,bd,tc;
      if(fr!==null&&fr<0){bg='#FCEBEB';bd='#E24B4A';tc='#842029';}
      else if(fr!==null&&fr<=3){bg='#FFF3CD';bd='#ffc107';tc='#664d03';}
      else if(c.stockScore<=-200){bg='#FCEBEB';bd='#E24B4A';tc='#842029';}
      else if(c.stockScore<=-100||(fr!==null&&fr<=8)){bg='#FAEEDA';bd='#EF9F27';tc='#854F0B';}
      else if(fr!==null){bg='#EAF3DE';bd='#639922';tc='#2d6a0a';}
      else{bg='#E6F1FB';bd='#185FA5';tc='#0c447c';}
      let ftStr=c.ft?`FT:${c.ft.getMonth()+1}/${c.ft.getDate()}`:'FT미설정';
      let urgStr=fr!==null?(fr<0?`FT초과${Math.abs(fr)}일`:(fr<=3?`FT임박${fr}일`:`FT${fr}일남`)):'';
      let stockStr=c.stockScore<=-100?' ⚠재고위험':c.stockScore<0?' !재고주의':'';
      let itemLines=c.items.map(x=>`<div style="font-size:10px;color:${tc};opacity:0.85">${x.item.replace('DSSDAY','')}×${x.qty}</div>`).join('');
      cal+=`<div style="background:${bg};border:1px solid ${bd};border-left:3px solid ${bd};border-radius:6px;padding:5px 6px;margin-bottom:4px">`;
      cal+=`<div style="font-size:11px;font-weight:700;color:${tc}">${c.no}</div>`;
      cal+=`<div style="font-size:10px;color:${tc};opacity:0.8">${ftStr}${urgStr?' · '+urgStr:''}${stockStr}</div>`;
      cal+=itemLines+`</div>`;
    });
    cal+=`</td>`;
  });
  cal+=`</tr></tbody></table>`;
  document.getElementById('priority-calendar').innerHTML=cal;

  if(!ranked.length){document.getElementById('priority-table-wrap').innerHTML='<div style="text-align:center;padding:24px;color:#888">미입고 컨테이너 없음</div>';return;}

  // 재고 현황 요약
  let stockSummary=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;background:#fafafa;border-radius:8px;border:1px solid #e8e8e8">`;
  stockSummary+=`<span style="font-size:11px;color:#888">현재재고 (안전재고 ${SAFETY}개):</span>`;
  ITEMS.forEach(it=>{
    let stock=cur[it]||0;let ds=daysToSafety(it);
    let color=stock<=0?'#A32D2D':stock<SAFETY?'#A32D2D':ds<=5?'#856404':'#2d6a0a';
    let warn=stock<=0?'🔴소진':stock<SAFETY?'🔴이하':ds<=5?`🟠${ds}일후`:'✓';
    stockSummary+=`<span style="font-size:12px"><strong style="color:${color}">${it.replace('DSSDAY','')}</strong>: ${stock}개 <span style="font-size:10px;color:${color}">${warn}</span></span>`;
  });
  stockSummary+=`</div>`;

  let tbl=stockSummary+`<table><thead><tr>
    <th style="text-align:center">순위</th><th>FT긴급도</th><th>재고위험</th>
    <th>CNTR No.</th><th>ETA</th><th>FT마감</th><th style="text-align:center">FT잔여</th>
    <th>DET마감</th><th>품목·수량(현재고)</th><th>계획입고일</th>
    <th style="color:#185FA5">권장입고일</th><th>비고</th>
  </tr></thead><tbody>`;

  ranked.forEach((c,idx)=>{
    let fr=c.ftRem;let dr=c.detRem;
    let rowBg='',urgBdg='',urgNote='',stockBdg='';
    if(fr!==null&&dr!==null&&dr<0){rowBg='background:#fff0f0';urgBdg='<span class="bdg b-danger">DET초과</span>';urgNote=`FT${Math.abs(fr)}+DET${Math.abs(dr)}일초과`;}
    else if(fr!==null&&fr<0){rowBg='background:#fff5f5';urgBdg='<span class="bdg b-danger">FT초과</span>';urgNote=`FT ${Math.abs(fr)}일 초과`;}
    else if(fr!==null&&fr<=3){rowBg='background:#FFFBF0';urgBdg='<span class="bdg b-warn">FT임박</span>';urgNote=`FT마감 ${fr}일 전`;}
    else if(fr!==null&&fr<=8){urgBdg='<span class="bdg" style="background:#FAEEDA;color:#854F0B">FT주의</span>';urgNote=`FT마감 ${fr}일 전`;}
    else if(fr!==null){urgBdg='<span class="bdg b-ok">FT여유</span>';urgNote=`FT마감 ${fr}일 전`;}
    else{urgBdg='<span class="bdg b-info">FT미설정</span>';urgNote='FT확인 필요';}
    if(c.stockScore<=-200){stockBdg='<span class="bdg b-danger">재고위험</span>';if(!rowBg)rowBg='background:#fff5f5';}
    else if(c.stockScore<=-100){stockBdg='<span class="bdg b-warn">재고주의</span>';if(!rowBg)rowBg='background:#FFFBF0';}
    else if(c.stockScore<0){stockBdg='<span class="bdg" style="background:#FAEEDA;color:#854F0B">재고확인</span>';}
    else{stockBdg='<span class="bdg b-ok">재고여유</span>';}
    let itemTags=c.items.map(x=>{
      let stock=cur[x.item]||0;let ds=daysToSafety(x.item);
      let sc=stock<SAFETY?'color:#A32D2D':ds<=5?'color:#856404':'color:#888';
      return `<span class="tag" style="font-size:10px">${x.item.replace('DSSDAY','')}×${x.qty}</span><span style="font-size:10px;${sc}"> (${stock}개)</span>`;
    }).join(' ');
    let recDs=assigned[c.no];let recStr=recDs?fmtD(recDs):'—';
    let frColor=fr===null?'':fr<0?'color:#A32D2D;font-weight:700':fr<=3?'color:#856404;font-weight:600':fr<=8?'color:#854F0B':'';
    tbl+=`<tr style="${rowBg}">
      <td style="text-align:center;font-weight:700">${idx+1}</td>
      <td>${urgBdg}</td>
      <td>${stockBdg}<div style="font-size:10px;color:#888;margin-top:2px;white-space:normal">${c.stockRisk}</div></td>
      <td><strong>${c.no}</strong></td><td>${fmtD(c.eta)}</td>
      <td><strong>${c.ftDeadline?fmtD(c.ftDeadline):'—'}</strong></td>
      <td style="text-align:center"><span style="${frColor}">${fr!==null?fr+'일':'—'}</span></td>
      <td>${c.det?fmtD(c.det.toISOString().slice(0,10)):'—'}</td>
      <td>${itemTags}</td>
      <td>${c.planDate?fmtD(c.planDate):'<span style="color:#ccc">미설정</span>'}</td>
      <td style="color:#185FA5;font-weight:700">${recStr}</td>
      <td style="font-size:11px;color:#666;white-space:normal;max-width:110px">${urgNote}</td>
    </tr>`;
  });
  tbl+=`</tbody></table>`;
  document.getElementById('priority-table-wrap').innerHTML=tbl;
}


function parseCSVText(text){
  // RFC4180 준수 파서: quoted 필드 내 줄바꿈 처리
  let records=[];
  let i=0,n=text.length;
  function parseRecord(){
    let fields=[];
    while(i<n){
      let field='';
      if(text[i]==='"'){
        i++; // 시작 따옴표 건너뜀
        while(i<n){
          if(text[i]==='"'){
            if(i+1<n&&text[i+1]==='"'){field+='"';i+=2;} // escaped quote
            else{i++;break;} // 종료 따옴표
          } else {field+=text[i++];}
        }
      } else {
        while(i<n&&text[i]!==','&&text[i]!=='\r'&&text[i]!=='\n'){field+=text[i++];}
      }
      fields.push(field.replace(/\n/g,' ').trim());
      if(i<n&&text[i]===','){i++;} // 쉼표 건너뜀
      else break;
    }
    // 줄 끝 처리
    if(i<n&&text[i]==='\r')i++;
    if(i<n&&text[i]==='\n')i++;
    return fields;
  }
  let headers=null;
  while(i<n){
    let rec=parseRecord();
    if(!rec.length||(rec.length===1&&!rec[0]))continue;
    if(!headers){headers=rec;}
    else{let row={};headers.forEach((h,j)=>row[h]=rec[j]||'');records.push(row);}
  }
  return records;
}

function showStatus(msg,type){
  let cls=type==='ok'?'al-ok':type==='warn'?'al-w':'al-d';
  let el=document.getElementById('import-status');
  if(el)el.innerHTML=`<div class="al ${cls}">${msg}</div>`;
}
function showPreview(keys){
  let el=document.getElementById('import-preview');
  if(!el)return;
  let h='<div style="font-size:12px;color:#888;margin-bottom:6px">인식된 컬럼 (총 '+keys.length+'개):</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
  keys.forEach(k=>h+=`<span class="tag">${String(k).replace(/\n/g,' ')}</span>`);
  el.innerHTML=h+'</div>';
}

function processCSV(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  let rows=parseCSVText(text);
  if(!rows.length){showStatus('CSV 데이터가 없습니다.','danger');return;}
  let hkeys=Object.keys(rows[0]);
  function nH(h){return h.replace(/\n/g,' ').replace(/ +/g,' ').trim();}
  function eCol(keys,name){return keys.find(h=>nH(h)===name)||null;}
  function pCol(keys,tests,excl){return keys.find(h=>{let n=nH(h);return tests.some(t=>n.includes(t))&&(!excl||!excl.some(e=>n.includes(e)));});}
  let colBl=pCol(hkeys,['B/L No']);
  let colCtr=pCol(hkeys,['CNTR No']);
  let colEta=pCol(hkeys,['수식) ETA','(수식) ETA']);
  let colFt=pCol(hkeys,['터미널','FT: 10일'],['통관','컨테이너']);
  let colCode=eCol(hkeys,'단품코드')||pCol(hkeys,['단품코드'],['색상','-색상']);
  let colQty=eCol(hkeys,'수량')||pCol(hkeys,['수량'],['BX']);
  let colPlan=eCol(hkeys,'입고일')||pCol(hkeys,['입고일'],['ODCY','수입']);
  let colStatus=eCol(hkeys,'진행상태')||pCol(hkeys,['진행상태']);
  let colOdcy=pCol(hkeys,['ODCY 입고일','ODCY입고일']);
  let colOdcyYn=pCol(hkeys,['ODCY 반입여부','반입여부']);
  console.log('컬럼매핑',{colBl,colCtr,colEta,colFt,colCode,colQty,colPlan,colStatus},'총',hkeys.length,'개');
  if(!colCode){showStatus('단품코드 컬럼을 찾을 수 없습니다. (인식된 컬럼 '+hkeys.length+'개)','danger');showPreview(hkeys);return;}
  let filtered=rows.filter(r=>ITEMS.includes(normalizeCode(r[colCode]||'')));
  if(!filtered.length){showStatus('DSSDAY 품목이 없습니다. 올바른 시트 탭의 CSV인지 확인하세요.','danger');showPreview(hkeys);return;}
  let added=0,skipped=0,updated=0;
  filtered.forEach(r=>{
    let no=String(r[colCtr]||'').trim();
    let code=normalizeCode(r[colCode]||'');
    let qty=parseInt(r[colQty]||0);
    let eta=parseDate(r[colEta]||'');
    let bl=String(r[colBl]||'').trim();
    let ftDate=parseDate(r[colFt]||'');
    let planDate=parseDate(r[colPlan]||'');
    let status=String(r[colStatus]||'').trim();
    let odcy=parseDate(r[colOdcy]||'');
    if(!no||!code||!qty){skipped++;return;}
    let existing=ctrs.find(c=>c.no===no&&c.item===code);
    if(existing){if(planDate&&!existing.planDate){existing.planDate=planDate;updated++;}if(ftDate&&!existing.ftDeadline)existing.ftDeadline=ftDate;if(status)existing.csvStatus=status;skipped++;return;}
    let actualDate='';if(status==='입고완료'){actualDate=planDate||today();}
    let odcyYn=colOdcyYn?String(r[colOdcyYn]||'').trim():'';
    ctrs.push({id:Date.now()+Math.random(),bl,no,eta,ftDeadline:ftDate,detDays:defDet,item:code,qty,planDate:planDate,odcyInDate:odcy,odcyYn:odcyYn,actualDate,csvStatus:status,src:'csv'});
    added++;
  });
  save();
  document.getElementById('sync-badge').textContent='CSV 동기화: '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  showStatus('완료 — 신규 '+added+'개 추가 / '+updated+'개 업데이트 / '+skipped+'개 건너뜀',added>0?'ok':'warn');
  if(added>0||updated>0)renderDash();
}
function addCtr(){
  let bl='';
  let no=document.getElementById('c-no').value.trim();
  let eta=document.getElementById('c-eta').value;
  let ft=document.getElementById('c-ft').value;
  let det=parseInt(document.getElementById('c-det').value)||defDet;
  let item=document.getElementById('c-item').value;
  let qty=parseInt(document.getElementById('c-qty').value);
  let plan=document.getElementById('c-plan').value;
  if(!no||!qty){alert('CNTR No.와 수량은 필수입니다.');return;}
  if(ctrs.find(c=>c.no===no&&c.item===item)){alert('이미 등록된 CNTR No.+품목코드입니다.');return;}
  ctrs.push({id:Date.now(),bl,no,eta,ftDeadline:ft,detDays:det,item,qty,planDate:plan,actualDate:'',csvStatus:'',src:'manual'});
  save();renderCtrTable();
  ['c-no','c-eta','c-ft','c-qty','c-plan'].forEach(id=>document.getElementById(id).value='');
}
function setPlan(id){
  let c=ctrs.find(c=>c.id===id);if(!c)return;
  let d=prompt('계획 입고일 (YYYY-MM-DD):',c.planDate||today());if(!d)return;
  ctrs.filter(x=>x.no===c.no).forEach(x=>x.planDate=d);
  save();renderCtrTable();renderDash();
}
function completeCtrGroup(no){
  let d=prompt('실제 입고일 (YYYY-MM-DD):',today());if(!d)return;
  ctrs.filter(c=>c.no===no).forEach(c=>{c.actualDate=d;c.csvStatus='입고완료';});
  save();renderCtrTable();renderDash();
}
function delCtrGroup(no){
  if(!confirm(`[${no}] 컨테이너를 삭제하시겠습니까?`))return;
  ctrs=ctrs.filter(c=>c.no!==no);save();renderCtrTable();
}
function renderCtrTable(){
  let fs=document.getElementById('f-status').value;
  let fi=document.getElementById('f-item').value;
  let td=today();
  let filtered=ctrs.filter(c=>(!fi||c.item===fi));
  let ctrMap=buildCtrMap(filtered);
  let list=Object.values(ctrMap).filter(c=>!fs||(fs==='pending'?!c.actualDate:!!c.actualDate))
    .sort((a,b)=>{let fa=a.ftDeadline||'9999',fb=b.ftDeadline||'9999';return fa<fb?-1:fa>fb?1:0;});
  let body=document.querySelector('#tbl-ctr tbody');body.innerHTML='';
  if(!list.length){body.innerHTML='<tr><td colspan="12" style="text-align:center;padding:24px;color:#888">데이터 없음 — CSV 가져오기 탭에서 ILOOM 시트 CSV를 업로드하세요</td></tr>';return;}
  list.forEach(c=>{
    let fl=c.ftDeadline;
    let det=fl?addDays(fl,defDet):'';
    let diff=fl?diffDays(td,fl):null;
    let detDiff=det?diffDays(td,det):null;
    let st,bg='';
    if(c.actualDate){st='<span class="bdg b-ok">입고완료</span>';bg='background:#f6fff5';}
    else if(diff!==null&&diff<0&&detDiff!==null&&detDiff<0){st='<span class="bdg b-danger">DET초과</span>';bg='background:#fff0f0';}
    else if(diff!==null&&diff<0){st='<span class="bdg b-danger">FT초과</span>';bg='background:#fff5f5';}
    else if(diff!==null&&diff<=3){st='<span class="bdg b-warn">FT임박</span>';bg='background:#fffbf0';}
    else if(diff!==null&&diff<=8){st='<span class="bdg" style="background:#FAEEDA;color:#854F0B">FT주의</span>';}
    else if(c.csvStatus==='입고일확정'){st='<span class="bdg b-confirm">입고일확정</span>';}
    else{st='<span class="bdg b-gray">대기중</span>';}
    let ftRemStr=diff===null?'—':diff<0?`<span style="color:#A32D2D;font-weight:700">+${Math.abs(diff)}일초과</span>`:`<span style="color:${diff<=3?'#856404':diff<=8?'#854F0B':'inherit'}">${diff}일</span>`;
    let detRemStr=detDiff===null?'—':detDiff<0?`<span style="color:#A32D2D;font-weight:700">+${Math.abs(detDiff)}일초과</span>`:`${detDiff}일`;
    let itemTags=c.items.map(i=>`<span class="tag" style="font-size:10px">${i.item.replace('DSSDAY','')}×${i.qty}</span>`).join('');
    let totalQty=c.items.reduce((s,i)=>s+parseInt(i.qty||0),0);
    let repId=c.items[0]?.id||c.id;
    // ODCY 관련 계산
    let odcyRec=odcyRecommend(c.ftDeadline);
    let odcyIn=c.odcyInDate||'';
    let det60=det60Deadline(c.eta);
    let det60Rem=det60?diffDays(td,det60):null;
    let isOdcy=c.odcyYn==='O'||!!odcyIn;
    let det60Str=det60Rem===null?'—':det60Rem<0?`<span style="color:#A32D2D;font-weight:700">+${Math.abs(det60Rem)}일초과</span>`:det60Rem<=10?`<span style="color:#856404;font-weight:600">${det60Rem}일</span>`:`${det60Rem}일`;
    // ODCY 이고 권장일: FT잔여가 10일 이하이거나 FT초과인 경우 강조
    let odcyRecColor=diff!==null&&diff<=10?'color:#A32D2D;font-weight:700':'color:#854F0B';

    body.innerHTML+=`<tr style="${bg}">
      <td><strong>${c.no}</strong>${isOdcy?'<span class="bdg b-purple" style="font-size:9px;margin-left:4px">ODCY</span>':''}</td>
      <td>${fmtD(c.eta)}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:2px">${itemTags}</div><div style="font-size:10px;color:#888;margin-top:2px">합계 ${totalQty}개</div></td>
      <td><strong style="color:${diff!==null&&diff<0?'#842029':diff!==null&&diff<=3?'#856404':'inherit'}">${fl?fmtD(fl):'—'}</strong></td>
      <td>${ftRemStr}</td>
      <td style="${odcyRecColor}">${odcyRec?fmtD(odcyRec):'—'}</td>
      <td style="color:#3C3489;font-weight:600">${odcyIn?fmtD(odcyIn):'—'}</td>
      <td>${det?fmtD(det):'—'} <span style="font-size:10px;color:#888">(${detRemStr})</span></td>
      <td style="color:#185FA5;font-weight:600">${c.planDate?fmtD(c.planDate):'<span style="color:#ccc;font-weight:400">미설정</span>'}</td>
      <td>${c.actualDate?fmtD(c.actualDate):'—'}</td>
      <td>${st}</td>
      <td style="display:flex;gap:3px;flex-wrap:wrap;min-width:130px">
        ${!c.actualDate?`<button class="btn btn-sm" onclick="setPlan(${repId})">입고일</button><button class="btn btn-p btn-sm" onclick="completeCtrGroup('${c.no}')">입고완료</button>`:''}
        <button class="btn btn-d btn-sm" onclick="delCtrGroup('${c.no}')">삭제</button>
      </td></tr>`;
  });
}

function renderDaily(){
  let from=document.getElementById('d-from').value;
  let to=document.getElementById('d-to').value;
  let vi=document.getElementById('d-item').value;
  const{cur,daily,dates}=getStock();
  let fd=dates.filter(d=>(!from||d>=from)&&(!to||d<=to));
  if(!fd.length){document.getElementById('daily-wrap').innerHTML='<div style="text-align:center;padding:24px;color:#888">해당 기간 데이터 없음</div>';return;}
  let si=vi==='ALL'?ITEMS:[vi];
  let html='<table><thead><tr><th>날짜</th>';
  si.forEach(it=>html+=`<th colspan="3" style="text-align:center;border-left:2px solid #e8e8e8">${it}</th>`);
  html+='</tr><tr><th></th>';
  si.forEach(()=>html+='<th style="border-left:2px solid #e8e8e8;color:#185FA5">입고</th><th style="color:#A32D2D">출고</th><th>재고</th>');
  html+='</tr></thead><tbody>';
  fd.forEach(date=>{
    let isToday=date===today();
    let rowBg=isToday?'background:#EBF4FF':'';
    html+=`<tr style="${rowBg}"><td><strong style="${isToday?'color:#185FA5':''}">${fmtD(date)}${isToday?' <span style="font-size:10px;background:#185FA5;color:#fff;padding:1px 5px;border-radius:3px;margin-left:3px">오늘</span>':''}</strong></td>`;
    si.forEach(it=>{
      let d=daily[date]?.[it]||{inb:0,inbPlan:0,out:0,stock:0,initStock:null};
      let sc=d.stock<=10?'color:#A32D2D;font-weight:700':d.stock<=30?'color:#856404;font-weight:600':'';
      let inbStr=d.inbPlan>0?`<span style="color:#5BA4D4;font-style:italic">+${d.inbPlan}</span>`:'';
      // 오늘 행: 초기재고 → 재고 흐름 표시
      let stockCell=isToday&&d.initStock!==null
        ?`<span style="font-size:10px;color:#aaa">${d.initStock}→</span><strong style="${sc}">${d.stock}</strong>`
        :`<span style="${sc}">${d.stock}</span>`;
      html+=`<td style="text-align:right;border-left:2px solid #e8e8e8">${inbStr}</td><td style="text-align:right;color:#A32D2D">${d.out>0?'-'+d.out:''}</td><td style="text-align:right">${stockCell}</td>`;
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('daily-wrap').innerHTML=html;
}

function addOut(){
  let date=document.getElementById('o-date').value;
  let item=document.getElementById('o-item').value;
  let qty=parseInt(document.getElementById('o-qty').value);
  if(!date||!qty||qty<=0){alert('날짜와 수량을 입력하세요.');return;}
  outs.push({id:Date.now(),date,item,qty,src:'manual'});
  document.getElementById('o-qty').value='';save();renderOutTable();
}
function delOut(id){outs=outs.filter(o=>o.id!==id);save();renderOutTable();}
function renderOutTable(){
  let body=document.querySelector('#tbl-out tbody');body.innerHTML='';
  if(!outs.length){body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">입력된 출고 없음</td></tr>';return;}
  [...outs].sort((a,b)=>b.date.localeCompare(a.date)).forEach(o=>{
    let srcBdg=o.src==='xls'?'<span class="bdg b-purple">XLS</span>':'<span class="bdg b-gray">수동</span>';
    body.innerHTML+=`<tr><td>${fmtD(o.date)}</td><td>${o.item}</td><td style="color:#A32D2D;font-weight:700">-${o.qty}개</td><td>${srcBdg}</td><td><button class="btn btn-d btn-xs" onclick="delOut(${o.id})">삭제</button></td></tr>`;
  });
}

function renderSettings(){
  document.getElementById('def-det').value=defDet;
  let html='';
  ITEMS.forEach(it=>{html+=`<div><label>${it}</label><div style="display:flex;align-items:center;gap:8px"><input type="number" id="init_${it}" value="${initSt[it]||0}" min="0" style="width:100px" oninput="updTotal()"> 개</div></div>`;});
  document.getElementById('init-grid').innerHTML=html;updTotal();
}
function updTotal(){let t=ITEMS.reduce((s,it)=>{let el=document.getElementById('init_'+it);return s+(el?parseInt(el.value||0):0);},0);document.getElementById('init-total').textContent='합계: '+t+'개';}
function saveInit(){ITEMS.forEach(it=>{let el=document.getElementById('init_'+it);if(el)initSt[it]=parseInt(el.value||0);});save();alert('저장되었습니다.');}
function saveDefaults(){defDet=parseInt(document.getElementById('def-det').value)||14;save();alert('기본값 저장 완료');}

// ── 관리자 모드 ──
function toggleAdminMode(){
  const pw = prompt('관리자 비밀번호:');
  if(pw !== 'desker2024'){ alert('비밀번호가 틀렸습니다.'); return; }
  const panel = document.getElementById('admin-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if(panel.style.display === 'block') renderAdminInitPanel();
}

function renderAdminInitPanel(){
  let h = '';
  ITEMS.forEach(it => {
    h += `<div style="display:flex;align-items:center;gap:6px;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #ddd">
      <label style="margin:0;font-size:11px;color:#185FA5;white-space:nowrap">${it.replace('DSSDAY','')}</label>
      <input type="number" id="apanel_${it}" value="${initSt[it]||0}" min="0" style="width:70px;font-size:12px;padding:4px 6px;border:1px solid #ddd;border-radius:4px">개
    </div>`;
  });
  document.getElementById('admin-init-grid-panel').innerHTML = h;
  document.getElementById('admin-det-val').value = defDet;
}

function adminSaveSettings(){
  ITEMS.forEach(it => {
    const el = document.getElementById('apanel_'+it);
    if(el) initSt[it] = parseInt(el.value||0);
  });
  defDet = parseInt(document.getElementById('admin-det-val').value)||14;
  save();
  setAdminStatus('✅ 재고 초기값·디텐션 저장 완료', 'ok');
  renderDash();
}

function adminHandleCSV(file){ handleFile(file); }

function adminHandleJson(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const data = JSON.parse(e.target.result);
      if(data.ctrs) ctrs = data.ctrs;
      if(data.outs) outs = data.outs;
      if(data.initSt) initSt = data.initSt;
      if(data.defDet) defDet = parseInt(data.defDet)||14;
      save();
      renderAdminInitPanel();
      setAdminStatus(
        `✅ JSON 복원 완료 — 컨테이너 ${ctrs.length}개 / 출고 ${outs.length}건 / ` +
        ITEMS.map(it => it.replace('DSSDAY','') + ':' + (initSt[it]||0) + '개').join(' / '),
        'ok'
      );
      renderDash();
    }catch(err){
      setAdminStatus('❌ JSON 오류: ' + err.message, 'danger');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function setAdminStatus(msg, type){
  const cls = type==='ok'?'al-ok':type==='warn'?'al-w':'al-d';
  const el = document.getElementById('admin-status');
  if(el) el.innerHTML = `<div class="al ${cls}">${msg}</div>`;
}

// ── 관리자 모드 ──
function toggleAdminMode(){
  const panel = document.getElementById('admin-panel');
  if(panel.style.display !== 'none'){ panel.style.display='none'; return; }
  const pw = prompt('관리자 비밀번호:');
  if(pw !== 'desker2024'){ alert('비밀번호가 틀렸습니다.'); return; }
  panel.style.display = 'block';
  renderAdminInitPanel();
}
function renderAdminInitPanel(){
  let h='';
  ITEMS.forEach(it=>{
    h+=`<div style="display:flex;align-items:center;gap:6px;background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #ddd">
      <label style="margin:0;font-size:11px;color:#185FA5;white-space:nowrap">${it.replace('DSSDAY','')}</label>
      <input type="number" id="apanel_${it}" value="${initSt[it]||0}" min="0" style="width:70px;font-size:12px;padding:4px 6px;border:1px solid #ddd;border-radius:4px">개
    </div>`;
  });
  document.getElementById('admin-init-grid-panel').innerHTML=h;
  document.getElementById('admin-det-val').value=defDet;
}
function adminSaveSettings(){
  ITEMS.forEach(it=>{const el=document.getElementById('apanel_'+it);if(el)initSt[it]=parseInt(el.value||0);});
  defDet=parseInt(document.getElementById('admin-det-val').value)||14;
  save();
  setAdminStatus('✅ 재고 초기값·디텐션 저장 완료','ok');
  renderDash();
}
function adminHandleCSV(file){ handleFile(file); }
function adminHandleJson(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(data.ctrs)ctrs=data.ctrs;
      if(data.outs)outs=data.outs;
      if(data.initSt)initSt=data.initSt;
      if(data.defDet)defDet=parseInt(data.defDet)||14;
      save();
      renderAdminInitPanel();
      setAdminStatus(
        `✅ JSON 복원 완료 — 컨테이너 ${ctrs.length}개 / 출고 ${outs.length}건 / `+
        ITEMS.map(it=>it.replace('DSSDAY','')+':'+(initSt[it]||0)+'개').join(' / '),
        'ok'
      );
      renderDash();
    }catch(err){ setAdminStatus('❌ JSON 오류: '+err.message,'danger'); }
  };
  reader.readAsText(file,'UTF-8');
}
function setAdminStatus(msg,type){
  const cls=type==='ok'?'al-ok':type==='warn'?'al-w':'al-d';
  const el=document.getElementById('admin-status');
  if(el)el.innerHTML=`<div class="al ${cls}">${msg}</div>`;
}


loadDataFromServer();

loadDataFromServer();
