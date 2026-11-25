/* D-03 v4.16 — Bene のメール発送日時: 17 時台 · 分は Invoice 番号で固定 (通信なし)
   実行: node test_v4_16_bene.js   ✦ Powered by LEENAI Automation System */
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
let pass=0,fail=0;
function ok(label,cond,info){ if(cond){ console.log('  ✔ '+label); pass++; } else { console.error('  ✖ FAIL: '+label+(info!==undefined?' — '+JSON.stringify(info):'')); fail++; } }
function grab(name){ const i=html.indexOf('function '+name+'('); if(i<0) return '';
  let d=0,j=html.indexOf('{',i); for(;j<html.length;j++){ if(html[j]==='{')d++; else if(html[j]==='}'&&--d===0) break; } return html.slice(i,j+1); }
const src=grab('emailSentMinute')+'\n'+grab('makeEmailSentTime');
const f=new Function(src+'\nreturn {emailSentMinute,makeEmailSentTime};')();
const bk=(iv,etd)=>({cr49f_invoice_no:iv,crcf9_bl_etd:etd});

console.log('■ 分は Invoice 番号で決まる');
const ivs=['NXS2610-03','NSG2611-02','NTJ2611-02','NXM2609-05','NA2605-08'];
ok('同じ Invoice → 100 回とも同じ文字列', ivs.every(iv=>{ const a=f.makeEmailSentTime(bk(iv,'2026-11-20T00:00:00Z')); return Array.from({length:100},()=>f.makeEmailSentTime(bk(iv,'2026-11-20T00:00:00Z'))).every(x=>x===a); }));
ok('決まった値 (v4.17: NXS2610-03→08 · NSG2611-02→20 · NTJ2611-02→49 · NXM2609-05→11)', [8,20,49,11].every((m,i)=>f.emailSentMinute(ivs[i])===m), ivs.map(f.emailSentMinute));
ok('前後の空白 · 小文字でも同じ', f.emailSentMinute(' nxs2610-03 ')===f.emailSentMinute('NXS2610-03'));
ok('Invoice 番号なしでも止まらない (v4.17: 5〜55)', [undefined,null,''].every(v=>{const m=f.emailSentMinute(v); return m>=5&&m<=55;}));
const ms=[]; for(let y=24;y<=27;y++) for(let mo=1;mo<=12;mo++) for(let n=1;n<=9;n++) ms.push(f.emailSentMinute(`NXS${y}${String(mo).padStart(2,'0')}-0${n}`));
ok('いつも 5〜55 · 整数 (v4.17)', ms.every(m=>Number.isInteger(m)&&m>=5&&m<=55));
ok('Invoice ごとにばらける (432 件で 40 種類以上の分)', new Set(ms).size>=40, new Set(ms).size);

console.log('■ 日付 · 時は今までどおり');
const t=f.makeEmailSentTime(bk('NXS2610-03','2026-10-30T00:00:00Z'));
ok('B/L 日付 + 17:分 (形 yyyy/mm/dd 17:mm)', t==='2026/10/30 17:08', t);
ok('crcf9_bl_etd が無ければ cr49f_etd', f.makeEmailSentTime({cr49f_invoice_no:'NXS2610-03',cr49f_etd:'2026-10-31'})==='2026/10/31 17:08');
ok('日付なし → 今日の日付 + 17:分', /^\d{4}\/\d{2}\/\d{2} 17:08$/.test(f.makeEmailSentTime({cr49f_invoice_no:'NXS2610-03'})));
ok('同じ日付でも Invoice が違えば分が違うことがある', f.makeEmailSentTime(bk('NSG2611-02','2026-10-30'))==='2026/10/30 17:20');

console.log('■ コード');
const js=html;
ok('Math.random を使わない (発送日時)', !/Math\.random/.test(grab('makeEmailSentTime'))&&!/Math\.random/.test(grab('emailSentMinute')));
ok('Bene 4 か所はすべて makeEmailSentTime(bk)', (js.match(/=makeEmailSentTime\(bk\)/g)||[]).length===4);
ok('D2 比較で 17:xx を伏せない (17:** なし)', !/17:\*\*/.test(grab('fdDataPdfWords')));
ok('version 4.16 以上', /version:'4\.1[6-9]'/.test(js));   // v4.17: 4.16 → 4.1x
ok('FD_DATA の creator v4.16 以上', /creator:'D-03 v4\.1[6-9] · /.test(js));
ok('自動モードは 4.13 のまま', /window\.D03AUTO=\{version:'4\.13'/.test(js));
ok('フッター', js.includes('✦ Powered by LEENAI Automation System</div>'));

console.log(`結果: PASS ${pass} / FAIL ${fail}`);
process.exit(fail?1:0);
