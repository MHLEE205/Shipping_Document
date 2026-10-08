/* D-03 v3.45 vs v4.0 — renderDataCard / renderBuyerCard text 比較 (node --check 補完) */
'use strict';
const {JSDOM}=require('jsdom');
const fs=require('fs');
const commonJs=fs.readFileSync('C:\\Users\\李明鎬\\Documents\\LEENAI_COMMON\\v1\\leenai-common.js','utf8');
const v39html=fs.readFileSync(__dirname+'/index_v3_45_backup.html','utf8');
const v40html=fs.readFileSync(__dirname+'/index.html','utf8');

function extractLastJs(html){
  const m=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  return m.length?m[m.length-1][1]:'';
}
function extractBody(html){
  const m=html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if(!m) return '';
  return m[1].replace(/<script[\s\S]*?<\/script>/gi,'');
}
function def(w,k,v){Object.defineProperty(w,k,{value:v,writable:true,configurable:true});}
function makeDOM(bodyHtml){
  const dom=new JSDOM('<!DOCTYPE html><html data-theme="dark"><head></head><body>'+bodyHtml+'</body></html>',
    {url:'https://mhlee205.github.io/Shipping_Document/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  def(w,'crypto',{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:(a)=>{for(let i=0;i<a.length;i++)a[i]=i%256;return a;}});
  def(w,'sessionStorage',{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=v;},removeItem(k){delete this._d[k];}});
  def(w,'localStorage',{_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=v;},removeItem(k){delete this._d[k];}});
  def(w,'history',{replaceState:()=>{}});
  def(w,'requestAnimationFrame',(cb)=>setTimeout(cb,0));
  def(w,'navigator',{clipboard:{writeText:async()=>{}}});
  def(w,'scrollTo',()=>{});
  def(w,'fetch',async()=>({ok:true,json:async()=>({value:[]})}));
  w.HTMLElement.prototype.scrollIntoView=function(){};
  return dom;
}

let passed=0,failed=0;
function ok(label,a,b){
  if(a===b){console.log('  ✔ '+label);passed++;}
  else{console.error('  ✖ FAIL:',label,'\n    v3.45:',String(a).slice(0,120),'\n    v4.0: ',String(b).slice(0,120));failed++;}
}

async function prepDOM(html,isV4){
  const dom=makeDOM(extractBody(html));
  const w=dom.window;
  if(isV4){
    w.eval(commonJs);
    await new Promise(r=>setTimeout(r,20));
    def(w,'fetch',async()=>({ok:true,json:async()=>({value:[]})}));
  }
  let evalErr=null;
  try{ w.eval(extractLastJs(html)); }catch(e){evalErr=e;}
  await new Promise(r=>setTimeout(r,30));
  if(evalErr) console.error('  eval error:',evalErr.message);

  /* Inject fake DV data directly into S state */
  if(!w.S) return {dom,w,evalErr};
  w.S.booking={cr49f_bookingid:'BKG-001',cr49f_invoice_no:'NMG2607-07',
    cr49f_main_ship_name:'EVER GIVEN',cr49f_etd:'2026-08-15',crcf9_bl_etd:'2026-08-20',
    _cr49f_sale_contract_id_value:'SC-001',_cr49f_region_japan_id_value:'RJ-001'};
  w.S.saleContract={cr49f_sale_contract_no:'NSG-2607-03',cr49f_terms_conditions:'CIF'};
  w.S.regionJapan={crcf9_pol:'NAGOYA'};
  w.S.siHeader={cr49f_s_iid:'SI-001',cr49f_lc_no:'LC-2607-01',crcf9_vo_no:'VO NO.12345',
    crcf9_po_vo:'PO-98765',crcf9_pod_bl1:'HO CHI MINH',crcf9_place_of_delivery_1:'HO CHI MINH',
    crcf9_notify_party:'SAIGON PAPER',crcf9_consignee:'SAIGON PAPER',crcf9_address:'ADDR'};
  w.S.saleDetails=[{cr49f_sale_detailid:'SD-001',cr49f_price:255,cr49f_quantity:100}];
  w.S.siDetails=[{crcf9_s_i_detailid:'DET-001',crcf9_productname:'OLD CORRUGATED CARTON',
    crcf9_hs_code:'4707.10',_crcf9_sale_detail_id_value:'SD-001',crcf9_price:255}];
  w.S.containers=[{crcf9_container_informationid:'CT-001',crcf9_container_no:'ABCD1234567',
    crcf9_quantity:22,crcf9_n_w:20000,crcf9_gross_weight:21000,
    _crcf9_sale_detail_id_value:'SD-001',crcf9_type:'40HC'}];
  w.S.invoiceNo='NMG2607-07';
  w.S.importer='SAIGON';
  w.S.signerName='PARK';
  w.S.totalNwMt=20;w.S.totalBales=22;w.S.containerCount=1;w.S.amountUsd=5100;
  w.S.goodsType='OCC';w.S.docs46A=[];w.S.addCond47A='';
  w.S.showFreight=true;w.S.showFreightTsukan=true;w.S.showFreightFD=false;
  w.S.carrierCost={crcf9_cost_per_van_usd:800,crcf9_carrier_name:'EVERGREEN'};
  w.S.carrierName='EVERGREEN';

  /* Call renderDataCard if it exists */
  try{if(typeof w.renderDataCard==='function') w.renderDataCard();}catch(e){}
  try{if(typeof w.updateTabHighlights==='function') w.updateTabHighlights();}catch(e){}
  await new Promise(r=>setTimeout(r,30));
  return {dom,w,evalErr};
}

(async()=>{
  console.log('\n[D-03 比較テスト] v3.45 vs v4.0 — S state 直接注入');
  const {dom:d39,w:w39}=await prepDOM(v39html,false);
  const {dom:d40,w:w40}=await prepDOM(v40html,true);

  /* loadInvoice availability */
  ok('v3.45 loadInvoice defined', typeof w39.loadInvoice, 'function');
  ok('v4.0  loadInvoice defined', typeof w40.loadInvoice, 'function');

  /* renderDataCard availability */
  ok('v3.45 renderDataCard defined', typeof w39.renderDataCard, 'function');
  ok('v4.0  renderDataCard defined', typeof w40.renderDataCard, 'function');

  /* SIGNER_MAP */
  ok('SIGNER_MAP both', JSON.stringify(w39.SIGNER_MAP||{}), JSON.stringify(w40.SIGNER_MAP||{}));

  /* S state after injection */
  ok('S.importer', w39.S&&w39.S.importer||'', w40.S&&w40.S.importer||'');
  ok('S.invoiceNo', w39.S&&w39.S.invoiceNo||'', w40.S&&w40.S.invoiceNo||'');

  /* dataCard DOM text */
  function allText(dom){
    return [...dom.window.document.querySelectorAll('.data-item span')].map(e=>e.textContent.trim()).join('|');
  }
  const dc39=allText(d39), dc40=allText(d40);
  ok('dataCard span texts', dc39, dc40);
  console.log('  v3.45 dataCard:', dc39.slice(0,200));
  console.log('  v4.0  dataCard:', dc40.slice(0,200));

  /* tab highlights */
  function tabClasses(dom){
    return [...dom.window.document.querySelectorAll('.tab')].map(e=>e.className+':'+e.id).join('|');
  }
  ok('tab highlights', tabClasses(d39), tabClasses(d40));

  console.log('\n─────────────────────────');
  console.log('結果: PASS '+passed+' / FAIL '+failed);
  process.exit(failed>0?1:0);
})();
