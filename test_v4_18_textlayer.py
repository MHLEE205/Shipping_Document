# ✦ Powered by LEENAI Automation System — D-03 v4.18 自動モードの見えない文字の層 (行ごと · 本当の空白) 試験
# デモ (loadDemo · ログイン 0 · COMPASS 0 · メール 0) で 3 書類を作り、v4.13 の d03aTextLayer と v4.18 の d03aTextLayerLines で PDF を作って比べる。
#   ① PDFium (Edge と同じ) で文字を抜く → つながった単語 0 · 抜けた単語 0   ② ページの画像 = 同じ (画素)   ③ 画面の 3 書類 HTML = HEAD~ と同じ (普通の出力の変化 0)
# 使い方: python test_v4_18_textlayer.py   (pip: playwright pypdfium2 pillow · playwright install chromium)
import asyncio, base64, functools, http.server, json, os, re, subprocess, sys, tempfile, threading
import pypdfium2 as pdfium
from PIL import ImageChops
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); TMP = tempfile.mkdtemp(prefix="d03v418_")
open(os.path.join(TMP, "new.html"), "wb").write(open(os.path.join(HERE, "index.html"), "rb").read())
base = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
open(os.path.join(TMP, "old.html"), "wb").write(subprocess.run(["git", "-C", HERE, "show", base + ":index.html"], capture_output=True).stdout)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=TMP)); threading.Thread(target=srv.serve_forever, daemon=True).start()
PORT = srv.server_address[1]
BUILD = r"""async (layer)=>{
  if(!window.html2canvas) await d03aLoad(D03A_LIBS[0]);
  if(!(window.jspdf&&window.jspdf.jsPDF)) await d03aLoad(D03A_LIBS[1]);
  const moved=[]; ['invoice','pl','si'].forEach(w=>{ const el=document.getElementById('doc-'+w); if(el){ moved.push([el,el.parentNode,el.nextSibling,el.style.display]); document.body.appendChild(el); el.style.display='block'; } });
  const pages=[]; moved.forEach(m=>m[0].querySelectorAll('.a4-page').forEach(p=>pages.push(p)));
  const pdf=new window.jspdf.jsPDF({unit:'pt', format:'a4', compress:true}); const PW=595.28, PH=841.89, K=0.97;
  for(let i=0;i<pages.length;i++){ const pg=pages[i]; pg.style.boxShadow='none'; pg.style.margin='0';
    const cv=await window.html2canvas(pg,{scale:2.5, backgroundColor:'#ffffff', useCORS:true, logging:false});
    if(i) pdf.addPage('a4','portrait'); pdf.addImage(cv.toDataURL('image/jpeg',0.88),'JPEG',PW*(1-K)/2,0,PW*K,PH*K,undefined,'FAST'); window[layer](pdf,pg,PW*(1-K)/2,PW*K); }
  const dom=pages.map(pg=>{ const o=[]; const tw=document.createTreeWalker(pg,NodeFilter.SHOW_TEXT); let n; while((n=tw.nextNode())){ (n.textContent.match(/\S+/g)||[]).forEach(w=>{ if(!/[^\x20-\x7E\xA0-\xFF]/.test(w)) o.push(w); }); } return o; });
  moved.slice().reverse().forEach(m=>{ if(m[1]){ if(m[2]) m[1].insertBefore(m[0],m[2]); else m[1].appendChild(m[0]); } m[0].style.display=m[3]; });
  return {b64:d03aB64(new Uint8Array(pdf.output('arraybuffer'))), dom};
}"""
def glued(tk, ds):
    j = set()
    for i in range(len(ds)):
        s = ds[i]
        for k in range(i + 1, min(i + 6, len(ds))): s += ds[k]; j.add(s)
    return [t for t in tk if t not in set(ds) and t in j]
async def main():
    res = {}
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for name in ("old", "new"):
            pg = await br.new_page(viewport={"width": 1400, "height": 1000})
            await pg.goto(f"http://127.0.0.1:{PORT}/{name}.html", wait_until="networkidle")
            await pg.evaluate("()=>loadDemo()"); await pg.wait_for_timeout(1500); await pg.evaluate("()=>renderAllDocs()"); await pg.wait_for_timeout(500)
            res[name + "_docs"] = await pg.evaluate("()=>['invoice','pl','si'].map(w=>document.getElementById('doc-'+w).innerHTML)")
            if name == "new":
                for ly in ("d03aTextLayer", "d03aTextLayerLines"):
                    r = await pg.evaluate(BUILD, ly); path = os.path.join(TMP, ly + ".pdf"); open(path, "wb").write(base64.b64decode(r["b64"])); res[ly] = (path, r["dom"])
        await br.close()
    ok = True
    print("③ 普通の 3 書類 HTML (" + base + " ↔ 今):", "同じ" if res["old_docs"] == res["new_docs"] else "違う"); ok &= res["old_docs"] == res["new_docs"]
    for ly in ("d03aTextLayer", "d03aTextLayerLines"):
        path, dom = res[ly]; d = pdfium.PdfDocument(path); g = []; miss = 0
        for i in range(len(d)):
            tk = re.findall(r"\S+", d[i].get_textpage().get_text_range()); g += glued(tk, dom[i])
            c = {}
            for x in tk: c[x] = c.get(x, 0) + 1
            for w in dom[i]:
                if c.get(w, 0) > 0: c[w] -= 1
                else: miss += 1
        print(f"① {ly}: つながった単語 {len(g)} · 抜けた単語 {miss} / {sum(len(x) for x in dom)}", g[:5])
        if ly == "d03aTextLayerLines": ok &= not g and not miss
    a, b = pdfium.PdfDocument(res["d03aTextLayer"][0]), pdfium.PdfDocument(res["d03aTextLayerLines"][0])
    same = all(ImageChops.difference(a[i].render(scale=1.5).to_pil().convert("RGB"), b[i].render(scale=1.5).to_pil().convert("RGB")).getbbox() is None for i in range(len(a)))
    print("② ページの画像 同じ:", same); ok &= same
    print("結果:", "OK" if ok else "NG"); sys.exit(0 if ok else 1)
asyncio.run(main())
