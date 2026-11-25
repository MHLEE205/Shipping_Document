/* D-03 v4.14 — FD 文字版 自動保存 (FD_DATA) の試験 (jsdom · 通信なし · 実際の SharePoint に書かない)
   実行: node test_v4_14_fddata.js   (jsdom が必要: npm i -g jsdom なら NODE_PATH を通す)
   ✦ Powered by LEENAI Automation System */
'use strict';
const {JSDOM}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');

function lastJs(h){ const m=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)]; return m.length?m[m.length-1][1]:''; }
function body(h){ const m=h.match(/<body[^>]*>([\s\S]*?)<\/body>/i); return m?m[1].replace(/<script[\s\S]*?<\/script>/gi,''):''; }
function def(w,k,v){ Object.defineProperty(w,k,{value:v,writable:true,configurable:true}); }

let pass=0, fail=0;
function ok(label,cond,info){ if(cond){ console.log('  ✔ '+label); pass++; } else { console.error('  ✖ FAIL: '+label+(info!==undefined?' — '+JSON.stringify(info):'')); fail++; } }

/* 画面 1 つ (毎回新しく) · fetch / html2canvas / jsPDF は偽物 */
function makeWin(opt){
  opt=opt||{};
  const dom=new JSDOM('<!DOCTYPE html><html><head></head><body>'+body(html)+'</body></html>',
    {url:'https://mhlee205.github.io/Shipping_Document/'+(opt.test?'?fddata_test=1':''),runScripts:'dangerously',pretendToBeVisual:true});
  const w=dom.window;
  const calls=[];                                       // [{method,url,body}]
  const files=opt.files||[];                            // フォルダにある名前
  def(w,'fetch',async(url,o)=>{
    o=o||{}; const m=o.method||'GET'; calls.push({method:m,url:String(url),auth:(o.headers||{}).Authorization});
    if(m==='GET'){
      if(opt.folder404) return {ok:false,status:404,json:async()=>({})};
      return {ok:true,status:200,json:async()=>({value:files.map(n=>({name:n}))})};
    }
    if(m==='PUT'){
      const name=(decodeURIComponent(String(url)).match(/\/([^\/]+):\/content/)||[])[1]||'';
      if(opt.putStatus) return {ok:false,status:opt.putStatus,json:async()=>({error:{message:'denied'}})};
      if(files.map(x=>x.toUpperCase()).includes(name.toUpperCase())) return {ok:false,status:409,json:async()=>({})};
      const size=o.body&&o.body.size;
      files.push(name);
      return {ok:true,status:201,json:async()=>({name,size})};
    }
    return {ok:false,status:500,json:async()=>({})};
  });
  def(w,'alert',()=>{});
  def(w,'confirm',()=>true);
  def(w,'scrollTo',()=>{});
  // jsdom は配置をしないので 位置を固定値に (見えない文字の層が動くように)
  w.Element.prototype.getBoundingClientRect=function(){ return {left:0,top:0,width:600,height:848,right:600,bottom:848}; };
  w.Range.prototype.getClientRects=function(){ return [{left:10,top:10,width:30,height:10}]; };
  w.HTMLElement.prototype.scrollIntoView=function(){ (w.__scrolled=(w.__scrolled||0)+1); };
  def(w,'LEENAI',{init(){}, auth:{token:async()=>'TOKEN', status:{}}, SP:{DRIVE_ID:'DRIVE'}, sp:{getJson:async()=>null}, user:null});
  const pdfLog=[];
  def(w,'html2canvas',async()=>({width:100,height:141,toDataURL:()=>'data:image/jpeg;base64,AAAA'}));
  def(w,'jspdf',{jsPDF:function(){ const o={pages:1,texts:[],props:null,
    addPage(){ o.pages++; }, addImage(){ pdfLog.push('img'); }, setFont(){}, setFontSize(){},
    text(t){ o.texts.push(t); }, setProperties(p){ o.props=p; },
    output(){ return new Uint8Array([37,80,68,70,45,49,46,52,10,(o.pages)]).buffer; } }; w.__pdf=o; return o; }});
  const sc=w.document.createElement('script'); sc.textContent=lastJs(html); w.document.body.appendChild(sc);   // 普通の <script> と同じ (const / let もグローバル)
  return {w,calls,files,pdfLog};
}
/* 書類を「生成した」状態にする (証明書 2 枚 · N/A 1 枚 · 非表示タブ 1 枚 · IV/PL は偽の render) */
function prepDocs(w,opt){
  opt=opt||{};
  w.eval(`S.invoiceNo='${opt.iv||'NA2605-08'}'; S.booking={cr49f_invoice_no:'${opt.iv||'NA2605-08'}'}; S.showFreight=true; S.showFreightFD=false;
    S.ivPod={1:true,2:false,3:false}; S.siPod={1:true,2:false,3:false};`);
  const d=w.document;
  d.getElementById('doc-qq').innerHTML='<div>CERTIFICATE OF QUALITY AND QUANTITY INVOICE NO. NA2605-08 L/C NO. 1234LC5678</div>';
  d.getElementById('doc-co').innerHTML='<div>CERTIFICATE OF ORIGIN NA2605-08</div>';
  d.getElementById('ft-content').innerHTML='<div class="na-panel">N/A — 不要</div>';
  d.getElementById('doc-esl').innerHTML='<div>EXPORTER STATEMENT (hidden tab)</div>';
  const t=d.getElementById('tab-esl'); if(t) t.style.display='none';
  // IV · PL: 本物の render は COMPASS が要るので偽物 (buildDocWrap を呼ぶ点と警告欄を書き換える点は本物と同じ)
  w.eval(`renderInvoice=function(){ document.getElementById('fxNote').textContent='FX CHANGED'; document.getElementById('fxNote').style.display='block';
            S.__ivFreight=S.showFreight; buildDocWrap('invoice',['<div class="tx">COMMERCIAL INVOICE NA2605-08 L/C 1234LC5678</div>']); };
          renderPackingList=function(){ buildDocWrap('pl',['<div class="tx">PACKING LIST p1</div>','<div class="tx">PACKING LIST p2</div>']); };
          syncSelectedPodToIvPod=function(){ S.ivPod={1:false,2:true,3:false}; S.siPod={...S.ivPod}; };`);
}
const hangul=s=>/[가-힣]/.test(s);

(async()=>{
  console.log('\n[1] 次の名前 (版番号)');
  { const {w}=makeWin();
    ok('なし → {IV}_FD_DATA.pdf', w.fdDataNextName('NA2605-08',['NA2605-08_FD.pdf','NA2605-08_.pdf'])==='NA2605-08_FD_DATA.pdf');
    ok('あり → _FD_DATA_2.pdf', w.fdDataNextName('NA2605-08',['NA2605-08_FD_DATA.pdf'])==='NA2605-08_FD_DATA_2.pdf');
    ok('1 · 2 あり → _3', w.fdDataNextName('NA2605-08',['NA2605-08_FD_DATA.pdf','NA2605-08_FD_DATA_2.pdf'])==='NA2605-08_FD_DATA_3.pdf');
    ok('大文字小文字は同じ扱い', w.fdDataNextName('NA2605-08',['na2605-08_fd_data.PDF'])==='NA2605-08_FD_DATA_2.pdf');
    ok('2 だけあり (1 なし) → 1 から', w.fdDataNextName('NA2605-08',['NA2605-08_FD_DATA_2.pdf'])==='NA2605-08_FD_DATA.pdf'); }

  console.log('\n[2] 保存先 · 名前 · ページ (本番の場所)');
  { const {w,calls,pdfLog}=makeWin({files:['NA2605-08_FD.pdf']}); prepDocs(w);
    const r=await w.fdDataAutoSave();
    const put=calls.find(c=>c.method==='PUT');
    ok('成功', r.ok===true, r);
    ok('PUT 1 回', calls.filter(c=>c.method==='PUT').length===1);
    ok('場所 = ▲ 書類作成中/{IV}/{IV}_FD_DATA.pdf', put&&decodeURIComponent(put.url).includes('/root:/古紙/-. 古紙書類/▲ 書類作成中/NA2605-08/NA2605-08_FD_DATA.pdf:/content'), put&&decodeURIComponent(put.url));
    ok('上書きしない (conflictBehavior=fail)', put&&put.url.includes('conflictBehavior=fail'));
    ok('トークン付き', put&&put.auth==='Bearer TOKEN');
    ok('ページ = IV 1 + PL 2 + 証明書 2 (N/A · 非表示タブは除く)', r.pages===5&&r.ivpl===3&&r.certs===2, r);
    ok('画像 5 枚', pdfLog.length===5);
    ok('見えない文字に IV 番号 · L/C 番号', w.__pdf.texts.includes('NA2605-08')&&w.__pdf.texts.includes('1234LC5678'), w.__pdf.texts.slice(0,20));
    ok('PDF 題名 = {IV}_FD_DATA', w.__pdf.props&&w.__pdf.props.title==='NA2605-08_FD_DATA');
    const msg=w.document.getElementById('fdDataMsg').textContent;
    ok('成功 1 行 (日本語)', /^✅ FD_DATA 保存しました: ▲ 書類作成中\/NA2605-08\/NA2605-08_FD_DATA\.pdf \(5 ページ/.test(msg)&&!hangul(msg), msg);
    ok('作業用の div は残らない', !w.document.getElementById('fdDataStage')); }

  console.log('\n[3] 画面の書類 · 状態は変えない');
  { const {w}=makeWin(); prepDocs(w);
    const d=w.document; const fx=d.getElementById('fxNote'); fx.textContent='ORIGINAL FX'; fx.style.display='none';
    const before={inv:!!d.getElementById('doc-invoice'), pl:!!d.getElementById('doc-pl'), qq:d.getElementById('doc-qq').innerHTML, prev:d.getElementById('previewArea').innerHTML};
    await w.fdDataAutoSave();
    ok('doc-invoice / doc-pl を作らない (通関書類タブのプレビューそのまま)', !d.getElementById('doc-invoice')===!before.inv&&!d.getElementById('doc-pl')===!before.pl);
    ok('previewArea 同じ', d.getElementById('previewArea').innerHTML===before.prev);
    ok('証明書の中身 同じ', d.getElementById('doc-qq').innerHTML===before.qq);
    ok('警告欄を元に戻す', fx.textContent==='ORIGINAL FX'&&fx.style.display==='none', [fx.textContent,fx.style.display]);
    ok('S.showFreight · ivPod · siPod を元に戻す', w.S.showFreight===true&&w.S.ivPod[1]===true&&w.S.ivPod[2]===false&&w.S.siPod[1]===true);
    ok('IV は FD の運賃設定 (showFreightFD) で描く', w.S.__ivFreight===false);
    ok('buildDocWrap を元に戻す', typeof w.buildDocWrap==='function'&&String(w.buildDocWrap).includes('preview-toolbar'));
    ok('画面をスクロールしない', !w.__scrolled, w.__scrolled); }

  console.log('\n[4] もうある → 版番号 · 同時保存 (409) → 次の番号');
  { const {w,calls}=makeWin({files:['NA2605-08_FD_DATA.pdf']}); prepDocs(w);
    const r=await w.fdDataAutoSave();
    ok('_FD_DATA_2.pdf', r.name==='NA2605-08_FD_DATA_2.pdf', r);
    ok('元の _FD_DATA.pdf に PUT しない', !calls.some(c=>c.method==='PUT'&&decodeURIComponent(c.url).includes('/NA2605-08_FD_DATA.pdf:'))); }
  { const files=['NA2605-08_FD_DATA.pdf']; const {w,calls}=makeWin({files}); prepDocs(w);
    // 一覧を読んだ後に 他の人が _2 を作った (一覧には出ない → PUT 409)
    const f0=w.fetch; let first=true;
    w.fetch=async(u,o)=>{ const r=await f0(u,o); if((o||{}).method!=='PUT'&&first){ first=false; files.push('NA2605-08_FD_DATA_2.pdf'); } return r; };
    const r=await w.fdDataAutoSave();
    ok('409 → _FD_DATA_3.pdf', r.ok&&r.name==='NA2605-08_FD_DATA_3.pdf', r); }

  console.log('\n[5] 同じ画面で同じ内容 → 2 回目は保存しない · 内容が変われば次の番号');
  { const {w,calls}=makeWin(); prepDocs(w);
    await w.fdDataAutoSave(); const r2=await w.fdDataAutoSave();
    ok('2 回目 same', r2.same===true&&calls.filter(c=>c.method==='PUT').length===1, r2);
    ok('表示 「保存済み」', /保存済みです \(同じ内容\): NA2605-08_FD_DATA\.pdf/.test(w.document.getElementById('fdDataMsg').textContent));
    w.document.getElementById('doc-co').innerHTML='<div>CERTIFICATE OF ORIGIN NA2605-08 REVISED</div>';
    const r3=await w.fdDataAutoSave();
    ok('内容が変わる → _FD_DATA_2.pdf', r3.ok&&r3.name==='NA2605-08_FD_DATA_2.pdf', r3); }

  console.log('\n[6] 失敗の表示 (日本語 1 行)');
  { const {w,calls}=makeWin({folder404:true}); prepDocs(w);
    const r=await w.fdDataAutoSave(); const msg=w.document.getElementById('fdDataMsg').textContent;
    ok('フォルダなし → 作らない (PUT 0)', !r.ok&&calls.filter(c=>c.method==='PUT').length===0);
    ok('「⚠ FD_DATA 保存できませんでした: フォルダがありません」', /^⚠ FD_DATA 保存できませんでした: フォルダがありません/.test(msg)&&!hangul(msg), msg); }
  { const {w}=makeWin({putStatus:403}); prepDocs(w);
    const r=await w.fdDataAutoSave(); const msg=w.document.getElementById('fdDataMsg').textContent;
    ok('403 → 権限なし · 再ログイン', !r.ok&&/Graph 403 \(書き込み権限なし · 再ログインしてください\)/.test(msg), msg); }
  { const {w}=makeWin(); prepDocs(w); w.eval('renderInvoice=function(){ throw new Error("S/I なし"); }');
    const r=await w.fdDataAutoSave(); const msg=w.document.getElementById('fdDataMsg').textContent;
    ok('IV が描けなくても証明書だけ保存 + 表示', r.ok&&r.pages===2&&/IV · PL なし \(S\/I なし\)/.test(msg), [r,msg]);
    ok('失敗しても buildDocWrap を元に戻す', String(w.buildDocWrap).includes('preview-toolbar')); }
  { const {w,calls}=makeWin(); prepDocs(w); w.eval('DEMO_MODE=true');
    const r=await w.fdDataAutoSave();
    ok('サンプル (DEMO) では保存しない', r.skip===true&&calls.length===0); }

  console.log('\n[7] 試験の場所 (?fddata_test=1)');
  { const {w,calls}=makeWin({test:true}); prepDocs(w);
    const r=await w.fdDataAutoSave(); const put=calls.find(c=>c.method==='PUT'); const msg=w.document.getElementById('fdDataMsg').textContent;
    ok('PUT 先 = D-00/doc_tool/save_test/{IV}/', put&&decodeURIComponent(put.url).includes('/root:/古紙/-. AI 活用/D-00/doc_tool/save_test/NA2605-08/NA2605-08_FD_DATA.pdf:'), put&&decodeURIComponent(put.url));
    ok('本番フォルダに触れない', !calls.some(c=>decodeURIComponent(c.url).includes('書類作成中')));
    ok('表示に [試験]', /^\[試験\] ✅ FD_DATA 保存しました: save_test\//.test(msg), msg); }
  { const {w,calls}=makeWin({test:true,folder404:true}); prepDocs(w);
    const r=await w.fdDataAutoSave();
    ok('試験の場所はフォルダが無くても保存 (save_test/{IV}/ を作る)', r.ok&&calls.filter(c=>c.method==='PUT').length===1, r); }

  console.log('\n[8] 「生成」 につながっている · 画面の文字');
  { const js=lastJs(html);
    const ba=js.slice(js.indexOf('function buildAll(){'), js.indexOf('\n}\n', js.indexOf('function buildAll(){')));
    ok('buildAll の最後 (alert の後) で fdDataAutoSave()', /alert\('全書類を生成しました！[\s\S]*\);\s*\n\s*fdDataAutoSave\(\);/.test(ba));
    ok('ボタン追加なし (onclick に fdData なし)', !/onclick="[^"]*fdData/.test(html));
    ok('graphScopes Sites.ReadWrite.All', /graphScopes:\['Sites\.ReadWrite\.All'\]/.test(js));
    ok('version 4.14 以上', /version:'4\.1[4-9]'/.test(js));   // v4.15: 4.14 → 4.15
    ok('自動モード (通関書類送付) は 4.13 のまま (PDF を変えない)', /creator:'D-03 v4\.13 自動モード/.test(js)&&/window\.D03AUTO=\{version:'4\.13'/.test(js));
    const noCmt=html.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').split('\n').map(l=>l.replace(/(^|[^:'"])\/\/.*$/,'$1')).join('\n');
    ok('画面の文字に 한글 0', !hangul(noCmt), (noCmt.match(/.{0,30}[가-힣].{0,30}/)||[])[0]);
    ok('フッター ✦ Powered by LEENAI Automation System', html.includes('✦ Powered by LEENAI Automation System</div>')); }

  console.log('\n─────────────────────────\n結果: PASS '+pass+' / FAIL '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.error('ERROR',e); process.exit(1); });
