/* D-03 v4.17 — Bene のメール発送日時: 分は 17:05〜17:55 (ちょうどの分を避ける) · 同じ Invoice はいつも同じ分 (通信なし)
   実行: node test_v4_17_bene.js   ✦ Powered by LEENAI Automation System */
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
let pass=0,fail=0;
function ok(label,cond,info){ if(cond){ console.log('  ✔ '+label); pass++; } else { console.error('  ✖ FAIL: '+label+(info!==undefined?' — '+JSON.stringify(info):'')); fail++; } }
function grab(name){ const i=html.indexOf('function '+name+'('); if(i<0) return '';
  let d=0,j=html.indexOf('{',i); for(;j<html.length;j++){ if(html[j]==='{')d++; else if(html[j]==='}'&&--d===0) break; } return html.slice(i,j+1); }
const f=new Function(grab('emailSentMinute')+'\n'+grab('makeEmailSentTime')+'\nreturn {emailSentMinute,makeEmailSentTime};')();
const bk=(iv,etd)=>({cr49f_invoice_no:iv,crcf9_bl_etd:etd});

console.log('■ 100 個の Invoice');
const pre=['NXS','NSG','NTJ','NXM','NA','NCV','UNF','NKH','NPH','NID'];
const ivs=[]; for(let i=0;i<100;i++) ivs.push(`${pre[i%10]}26${String(1+(i%12)).padStart(2,'0')}-${String(1+Math.floor(i/10)).padStart(2,'0')}`);
ok('100 個すべて別の Invoice 番号', new Set(ivs).size===100);
const ms=ivs.map(f.emailSentMinute);
ok('100 個の分がすべて 05〜55', ms.every(m=>Number.isInteger(m)&&m>=5&&m<=55), ms.filter(m=>!(m>=5&&m<=55)));
ok('発送日時の文字列も 17:05〜17:55', ivs.every(iv=>{ const m=/ 17:(\d\d)$/.exec(f.makeEmailSentTime(bk(iv,'2026-11-20T00:00:00Z'))); return m&&+m[1]>=5&&+m[1]<=55; }));
ok('同じ IV → 同じ分 (100 個 × 20 回)', ivs.every(iv=>{ const a=f.makeEmailSentTime(bk(iv,'2026-11-20')); for(let k=0;k<20;k++) if(f.makeEmailSentTime(bk(iv,'2026-11-20'))!==a) return false; return true; }));
ok('ばらける (100 個で 30 種類以上の分)', new Set(ms).size>=30, new Set(ms).size);

console.log('■ 広い範囲 (4,000 個) · 空 Invoice');
const big=[]; for(let i=0;i<4000;i++) big.push(f.emailSentMinute('IV'+i));
ok('4,000 個すべて 05〜55', big.every(m=>m>=5&&m<=55));
ok('端の 05 と 55 も出る (範囲の両端まで使う)', big.includes(5)&&big.includes(55));
ok('00〜04 · 56〜59 は出ない', !big.some(m=>m<5||m>55));
ok('Invoice なしでも 05〜55', [undefined,null,'','  '].every(v=>{const m=f.emailSentMinute(v); return m>=5&&m<=55;}));

console.log('■ コード');
ok('version 4.17', /version:'4\.17'/.test(html));
ok('FD_DATA の creator v4.17', /creator:'D-03 v4\.17 · /.test(html));
ok('自動モードは 4.13 のまま', /window\.D03AUTO=\{version:'4\.13'/.test(html));
ok('Math.random を使わない (発送日時)', !/Math\.random/.test(grab('makeEmailSentTime')+grab('emailSentMinute')));
ok('フッター', html.includes('✦ Powered by LEENAI Automation System</div>'));

console.log(`結果: PASS ${pass} / FAIL ${fail}`);
process.exit(fail?1:0);
