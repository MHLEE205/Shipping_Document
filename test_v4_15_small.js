/* D-03 v4.15 — 小さな修正 (D2 · D4 · D5) の試験 (jsdom · 通信なし · 実際の SharePoint に書かない)
   D2 = Invoice フォルダの最新 FD_DATA と 文字の層が同じなら保存しない (ページを開き直しても)
   D4 = 「生成」 の後に FD 運賃のチェックを変えた → 「FD_DATA と違います — もう一度 生成」 (印刷に出ない)
   D5 = Bene+MAIL の印刷名 {IV}_BC_MAIL
   実行: node test_v4_15_small.js   (jsdom が必要: NODE_PATH=$(npm root -g))
   ✦ Powered by LEENAI Automation System */
'use strict';
const {JSDOM}=require('jsdom');
const fs=require('fs');
const zlib=require('zlib');
const html=fs.readFileSync(__dirname+'/index.html','utf8');

function lastJs(h){ const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)]; return m.length?m[m.length-1][1]:''; }
function body(h){ const m=h.match(/<body[^>]*>([\s\S]*?)<\/body>/i); return m?m[1].replace(/<script[\s\S]*?<\/script>/gi,''):''; }
function def(w,k,v){ Object.defineProperty(w,k,{value:v,writable:true,configurable:true}); }
const hangul=s=>/[가-힣]/.test(s);

let pass=0, fail=0;
function ok(label,cond,info){ if(cond){ console.log('  ✔ '+label); pass++; } else { console.error('  ✖ FAIL: '+label+(info!==undefined?' — '+JSON.stringify(info):'')); fail++; } }

/* jsPDF と同じ形の PDF を作る (文字の層 = FlateDecode の流れの中の (word) Tj · 画像の流れも 1 つ入れる) */
const esc=t=>String(t).replace(/[\\()]/g,m=>'\\'+m);
function fakePdfBytes(texts,opt){
  opt=opt||{};
  const content='BT /F1 10 Tf 3 Tr\n'+texts.map((t,i)=>'10 '+(800-i)+' Td ('+esc(t)+') Tj').join('\n')+'\nET';
  const z=zlib.deflateSync(Buffer.from(content,'latin1'));
  const img=Buffer.from('JFIF (FAKEIMAGE) Tj garbage','latin1');
  const parts=[Buffer.from('%PDF-1.3\n1 0 obj\n<< /Type /XObject /Subtype /Image /Filter /DCTDecode /Length '+img.length+' >>\nstream\n','latin1'), img,
    Buffer.from('\nendstream\nendobj\n2 0 obj\n<< /Length '+z.length+' /Filter /FlateDecode >>\nstream\n','latin1'), z,
    Buffer.from('\nendstream\nendobj\n%%EOF\n','latin1')];
  const b=Buffer.concat(parts); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
}

/* 画面 1 つ · store = フォルダの中身 {name: ArrayBuffer} (同じ store を渡せば「ページを開き直した」と同じ) */
function makeWin(opt){
  opt=opt||{};
  const dom=new JSDOM('<!DOCTYPE html><html><head></head><body>'+body(html)+'</body></html>',
    {url:'https://mhlee205.github.io/Shipping_Document/'+(opt.test?'?fddata_test=1':''),runScripts:'dangerously',pretendToBeVisual:true});
  const w=dom.window;
  const calls=[]; const store=opt.store||{};
  def(w,'Blob',Blob); def(w,'Response',Response); def(w,'DecompressionStream',DecompressionStream);
  def(w,'fetch',async(url,o)=>{
    o=o||{}; const m=o.method||'GET'; const u=String(url); calls.push({method:m,url:u,auth:(o.headers||{}).Authorization});
    if(m==='GET'&&u.startsWith('https://dl.test/')){
      const n=decodeURIComponent(u.slice('https://dl.test/'.length));
      if(opt.dlFail) return {ok:false,status:500,arrayBuffer:async()=>new ArrayBuffer(0)};
      return {ok:true,status:200,arrayBuffer:async()=>store[n]};
    }
    if(m==='GET') return {ok:true,status:200,json:async()=>({value:Object.keys(store).map(n=>({name:n,size:store[n].byteLength,'@microsoft.graph.downloadUrl':'https://dl.test/'+encodeURIComponent(n)}))})};
    if(m==='PUT'){
      const name=(decodeURIComponent(u).match(/\/([^\/]+):\/content/)||[])[1]||'';
      if(Object.keys(store).some(x=>x.toUpperCase()===name.toUpperCase())) return {ok:false,status:409,json:async()=>({})};
      store[name]=await o.body.arrayBuffer();
      return {ok:true,status:201,json:async()=>({name,size:store[name].byteLength})};
    }
    return {ok:false,status:500,json:async()=>({})};
  });
  def(w,'alert',()=>{}); def(w,'confirm',()=>true); def(w,'scrollTo',()=>{}); def(w,'print',()=>{ w.__printed=(w.__printed||0)+1; });
  w.Element.prototype.getBoundingClientRect=function(){ return {left:0,top:0,width:600,height:848,right:600,bottom:848}; };
  w.Range.prototype.getClientRects=function(){ return [{left:10,top:10,width:30,height:10}]; };
  w.HTMLElement.prototype.scrollIntoView=function(){};
  def(w,'LEENAI',{init(){}, auth:{token:async()=>'TOKEN', status:{}}, SP:{DRIVE_ID:'DRIVE'}, sp:{getJson:async()=>null}, user:null});
  def(w,'html2canvas',async()=>({width:100,height:141,toDataURL:()=>'data:image/jpeg;base64,AAAA'}));
  def(w,'jspdf',{jsPDF:function(){ const o={texts:[],
    addPage(){}, addImage(){}, setFont(){}, setFontSize(){}, setProperties(p){ o.props=p; },
    text(t){ o.texts.push(t); }, output(){ return fakePdfBytes(o.texts); } }; w.__pdf=o; return o; }});
  const sc=w.document.createElement('script'); sc.textContent=lastJs(html); w.document.body.appendChild(sc);
  return {w,calls,store};
}
function prepDocs(w,opt){
  opt=opt||{}; const iv=opt.iv||'NA2605-08';
  w.eval(`S.invoiceNo='${iv}'; S.booking={cr49f_invoice_no:'${iv}'}; S.showFreight=true; S.showFreightFD=${opt.freight?'true':'false'};
    S.ivPod={1:true,2:false,3:false}; S.siPod={1:true,2:false,3:false};`);
  const d=w.document;
  d.getElementById('doc-qq').innerHTML='<div>CERTIFICATE OF QUALITY '+iv+' L/C NO. 1234LC5678 (A)</div>';
  d.getElementById('doc-co').innerHTML='<div>CERTIFICATE OF ORIGIN '+iv+(opt.co||'')+'</div>';
  d.getElementById('doc-bene').innerHTML='<div>BENEFICIARY CERTIFICATE SENT 2026/11/20 '+(opt.time||'17:23')+' '+(opt.bene||'')+'</div>';
  w.eval(`renderInvoice=function(){ buildDocWrap('invoice',['<div>COMMERCIAL INVOICE ${iv} FREIGHT '+(S.showFreight?'USD 500':'NONE')+'</div>']); };
          renderPackingList=function(){ buildDocWrap('pl',['<div>PACKING LIST ${iv}</div>']); };
          syncSelectedPodToIvPod=function(){};`);
}
const puts=c=>c.filter(x=>x.method==='PUT');
const msgOf=w=>w.document.getElementById('fdDataMsg').textContent;

(async()=>{
  console.log('\n[1] 文字の層を取り出す (PDF)');
  { const {w}=makeWin();
    const a=await w.fdDataPdfWords(fakePdfBytes(['NA2605-08','A(B)','C\\D','2026/11/20','17:05','12:30']));
    ok('FlateDecode の中の (…) Tj を順に · 括弧 · \\ の戻し', JSON.stringify(a)===JSON.stringify(['NA2605-08','A(B)','C\\D','2026/11/20','17:**','12:30']), a);
    ok('画像の流れは読まない', !a.includes('FAKEIMAGE'));
    ok('日付の後の 17:xx だけ伏せる (Bene の送信時刻)', a[4]==='17:**'&&a[5]==='12:30'); }
  { const {w}=makeWin();
    ok('最新 = 番号いちばん大きい', w.fdDataLatest('NA2605-08',[{name:'NA2605-08_FD_DATA.pdf'},{name:'NA2605-08_FD_DATA_3.pdf'},{name:'na2605-08_fd_data_2.PDF'},{name:'NA2605-08_FD.pdf'},{name:'NA2605-08_FD_DATA_X.pdf'}]).name==='NA2605-08_FD_DATA_3.pdf');
    ok('_FD_DATA.pdf だけ → それ', w.fdDataLatest('NA2605-08',[{name:'NA2605-08_FD_DATA.pdf'}]).name==='NA2605-08_FD_DATA.pdf');
    ok('なし → null', w.fdDataLatest('NA2605-08',[{name:'NA2605-08_.pdf'},{name:'NA2605-081_FD_DATA.pdf'}])===null); }

  console.log('\n[2] D2 ページを開き直して同じ内容 → 保存しない');
  { const store={};
    const A=makeWin({store}); prepDocs(A.w); const r1=await A.w.fdDataAutoSave();
    ok('1 回目 保存 _FD_DATA.pdf', r1.ok&&r1.name==='NA2605-08_FD_DATA.pdf', r1);
    const B=makeWin({store}); prepDocs(B.w); const r2=await B.w.fdDataAutoSave();   // 新しい画面 (FDDATA_DONE は空)
    ok('2 回目 (開き直し) same · PUT 0', r2.same===true&&r2.folderSame===true&&puts(B.calls).length===0, r2);
    ok('表示 「FD_DATA は保存済みです (同じ内容): …_FD_DATA.pdf」', /^FD_DATA は保存済みです \(同じ内容\): NA2605-08_FD_DATA\.pdf$/.test(msgOf(B.w))&&!hangul(msgOf(B.w)), msgOf(B.w));
    ok('フォルダの中身 1 つのまま', Object.keys(store).length===1);
    ok('最新ファイルは downloadUrl から (トークンなしで) 読む', B.calls.some(c=>c.url.startsWith('https://dl.test/')&&!c.auth));
    const C=makeWin({store}); prepDocs(C.w,{time:'17:48'}); const r3=await C.w.fdDataAutoSave();
    ok('Bene の送信時刻 (17 時台ランダム) だけ違う → 同じ扱い', r3.same===true&&puts(C.calls).length===0, r3);
    const D=makeWin({store}); prepDocs(D.w,{co:' REVISED'}); const r4=await D.w.fdDataAutoSave();
    ok('中身が違う → _FD_DATA_2.pdf', r4.ok&&!r4.same&&r4.name==='NA2605-08_FD_DATA_2.pdf', r4);
    const E=makeWin({store}); prepDocs(E.w); const r5=await E.w.fdDataAutoSave();
    ok('比べるのは最新 (_2) — 前の内容 (= _FD_DATA.pdf) に戻した → _FD_DATA_3.pdf', r5.ok&&r5.name==='NA2605-08_FD_DATA_3.pdf', r5);
    const F=makeWin({store}); prepDocs(F.w); const r6=await F.w.fdDataAutoSave();
    ok('最新 (_3) と同じ → 保存しない', r6.same===true&&r6.name==='NA2605-08_FD_DATA_3.pdf', r6);
    const G=makeWin({store}); prepDocs(G.w,{bene:'17:23'}); const r7=await G.w.fdDataAutoSave();
    ok('語が 1 つ増えた → 保存 (_4)', r7.ok&&!r7.same&&r7.name==='NA2605-08_FD_DATA_4.pdf', r7); }
  { const store={'NA2605-08_FD_DATA.pdf':fakePdfBytes([])};
    const A=makeWin({store}); prepDocs(A.w); const r=await A.w.fdDataAutoSave();
    ok('最新に文字の層が無い (比べられない) → 保存', r.ok&&r.name==='NA2605-08_FD_DATA_2.pdf', r); }
  { const store={}; const A=makeWin({store}); prepDocs(A.w); await A.w.fdDataAutoSave();
    const B=makeWin({store,dlFail:true}); prepDocs(B.w); const r=await B.w.fdDataAutoSave();
    ok('最新を読めない → 止めずに保存 (_2)', r.ok&&r.name==='NA2605-08_FD_DATA_2.pdf', r); }
  { const store={}; const A=makeWin({store,test:true}); prepDocs(A.w); await A.w.fdDataAutoSave();
    const B=makeWin({store,test:true}); prepDocs(B.w); const r=await B.w.fdDataAutoSave();
    ok('試験の場所でも同じ (保存しない · [試験] 表示)', r.same===true&&/^\[試験\] FD_DATA は保存済みです/.test(msgOf(B.w))&&!B.calls.some(c=>decodeURIComponent(c.url).includes('書類作成中')), msgOf(B.w)); }

  console.log('\n[3] D4 「生成」 の後に FD 運賃を変える → 1 行');
  { const {w}=makeWin(); prepDocs(w);
    const st=w.document.getElementById('fdDataStale'); const cb=w.document.getElementById('showFreightFDCheck');
    ok('欄がある · 印刷に出ない (no-print + @media print)', !!st&&st.classList.contains('no-print')&&/@media print\{#fdDataMsg,#fdDataStale\{display:none!important;\}\}/.test(html));
    cb.checked=true; cb.dispatchEvent(new w.Event('change'));
    ok('「生成」 前に変えても出ない', st.style.display==='none'&&w.S.showFreightFD===true);
    cb.checked=false; cb.dispatchEvent(new w.Event('change'));
    await w.fdDataAutoSave();
    ok('生成直後は出ない', st.style.display==='none');
    cb.checked=true; cb.dispatchEvent(new w.Event('change'));
    ok('変える → 「⚠ FD_DATA と違います — もう一度 生成」', st.style.display==='block'&&st.textContent==='⚠ FD_DATA と違います — もう一度 生成'&&!hangul(st.textContent), [st.style.display,st.textContent]);
    cb.checked=false; cb.dispatchEvent(new w.Event('change'));
    ok('元に戻す → 消える', st.style.display==='none');
    cb.checked=true; cb.dispatchEvent(new w.Event('change'));
    const r=await w.fdDataAutoSave();
    ok('もう一度 生成 (運賃あり = 内容違い → 保存) → 消える', r.ok&&r.name==='NA2605-08_FD_DATA_2.pdf'&&st.style.display==='none', [r,st.style.display]);
    w.eval("S.invoiceNo='NX9999-01'"); cb.checked=false; cb.dispatchEvent(new w.Event('change'));
    ok('別の Invoice に移ったら出ない', st.style.display==='none'); }
  { const store={}; const A=makeWin({store}); prepDocs(A.w); await A.w.fdDataAutoSave();
    const B=makeWin({store}); prepDocs(B.w); const r=await B.w.fdDataAutoSave();
    const cb=B.w.document.getElementById('showFreightFDCheck'); cb.checked=true; cb.dispatchEvent(new B.w.Event('change'));
    ok('「保存済み (同じ内容)」 の後でも 変えれば出る', r.same===true&&B.w.document.getElementById('fdDataStale').style.display==='block'); }

  console.log('\n[4] D5 Bene+MAIL 印刷名');
  { const {w}=makeWin(); prepDocs(w);
    w.printDocs('bene-mail');
    ok('bene-mail → {IV}_BC_MAIL', w.document.title==='NA2605-08_BC_MAIL', w.document.title);
    w.dispatchEvent(new w.Event('afterprint'));
    w.printDocs('bene'); ok('bene は {IV}_BC のまま', w.document.title==='NA2605-08_BC', w.document.title);
    w.dispatchEvent(new w.Event('afterprint'));
    w.printDocs('mail'); ok('mail は {IV}_MAIL のまま', w.document.title==='NA2605-08_MAIL', w.document.title); }

  console.log('\n[5] 版 · 自動モード · 画面');
  { const js=lastJs(html);
    ok('version 4.15', /version:'4\.15'/.test(js));
    ok('FD_DATA の creator v4.15', /creator:'D-03 v4\.15 · /.test(js));
    ok('自動モード (通関書類送付) は 4.13 のまま', /creator:'D-03 v4\.13 自動モード/.test(js)&&/window\.D03AUTO=\{version:'4\.13'/.test(js));
    ok('文字の層 (d03aTextLayer) は変えない', /pdf\.text\(w, ox\+\(rc\.left-pr\.left\)\*k, \(rc\.top-pr\.top\+rc\.height\*0\.8\)\*k, \{renderingMode:'invisible', baseline:'alphabetic'\}\);/.test(js));
    ok('ボタン追加なし (onclick の fdData は運賃チェックの 1 つだけ)', (html.match(/on\w+="[^"]*fdData/g)||[]).length===1&&/onchange="S\.showFreightFD=this\.checked;fdDataStaleCheck\(\)"/.test(html));
    const noCmt=html.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').split('\n').map(l=>l.replace(/(^|[^:'"])\/\/.*$/,'$1')).join('\n');
    ok('画面の文字に 한글 0', !hangul(noCmt), (noCmt.match(/.{0,30}[가-힣].{0,30}/)||[])[0]);
    ok('フッター ✦ Powered by LEENAI Automation System', html.includes('✦ Powered by LEENAI Automation System</div>')); }

  console.log('\n─────────────────────────\n結果: PASS '+pass+' / FAIL '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error('ERROR',e); process.exit(1); });
