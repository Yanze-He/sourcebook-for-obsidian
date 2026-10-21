"""Run the compiled plugin against a browser host contract, NOT real Obsidian."""
from pathlib import Path
import json, os, threading, http.server, functools, tempfile
from playwright.sync_api import sync_playwright, expect
P=Path(__file__).resolve().parents[2]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
Handler=functools.partial(QuietHandler,directory=str(P))
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[];errors=[]
def mark(name):results.append({'test':name,'passed':True})
with sync_playwright() as p:
 candidates=[os.environ.get('SOURCEBOOK_BROWSER',''),'/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium']
 executable=next((candidate for candidate in candidates if candidate and Path(candidate).is_file()),None)
 browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox']) if executable else p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':1280,'height':960},locale='zh-CN',permissions=['clipboard-read','clipboard-write'])
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 html=(P/'tests/browser/index.html').read_text()
 html=html.replace('<link rel="stylesheet" href="/styles.css?v=ui-v15">','<style>'+(P/'styles.css').read_text()+'</style>')
 for url,filename in [('/tests/browser/host.cjs','tests/browser/host.cjs'),('/main.js?v=ui-v15','main.js')]:
  html=html.replace('<script src="'+url+'"></script>','<script>'+(P/filename).read_text()+'</script>')
 page.set_content(html);page.wait_for_function('window.__host.ready===true')
 expect(page.get_by_role('heading',name='Start a Book for your next project')).to_be_visible();mark('Initial workspace')
 page.get_by_role('button',name='Create first Book').click();page.locator('.modal input').fill('Drone campaign references');page.locator('.modal').get_by_role('button',name='Create',exact=True).click();expect(page.locator('.harness-overlay')).to_have_count(0)
 expect(page.get_by_role('button',name='Add materials',exact=True)).to_be_visible();mark('Create schema-v2 Book')
 page.get_by_role('button',name='Add materials',exact=True).click();page.get_by_role('menuitem',name='Add text record',exact=True).click();page.locator('.modal input').nth(0).fill('Creative direction');page.locator('.modal textarea').fill('Use a natural setting and precise framing.');page.locator('.modal').get_by_role('button',name='Save',exact=True).click();expect(page.locator('.harness-overlay')).to_have_count(0)
 page.get_by_role('button',name='Add materials',exact=True).click();page.get_by_role('menuitem',name='Add link',exact=True).click();page.locator('.modal input').nth(0).fill('Reference');page.locator('.modal input').nth(1).fill('https://example.com/reference');page.locator('.modal').get_by_role('button',name='Save',exact=True).click();expect(page.locator('.harness-overlay')).to_have_count(0)
 from PIL import Image,ImageDraw
 im=Image.new('RGB',(760,460));draw=ImageDraw.Draw(im);draw.rectangle((0,0,760,460),fill=(39,57,72));draw.polygon([(0,460),(190,180),(390,460)],fill=(74,90,106));draw.polygon([(220,460),(480,110),(760,460)],fill=(101,116,129));draw.ellipse((105,70,165,130),fill=(223,207,159))
 fixture=Path(tempfile.gettempdir())/'sourcebook-fixture.png';im.save(fixture)
 page.get_by_role('button',name='Add materials',exact=True).click()
 with page.expect_file_chooser() as chooser: page.get_by_role('menuitem',name='Import local files',exact=True).click()
 chooser.value.set_files(str(fixture));expect(page.locator('.source-masonry-card')).to_have_count(3);mark('Add text, link and imported original')
 image=page.locator('.source-masonry-card').filter(has=page.get_by_role('heading',name='sourcebook-fixture'));image.click();page.locator('textarea[aria-label="Book note"]').fill('Borrow the whitespace and subject scale only.');page.locator('textarea[aria-label="Book note"]').press('Tab');expect(page.get_by_text('Borrow the whitespace and subject scale only.',exact=True)).to_be_visible();mark('Book note round-trip')
 page.locator('button[aria-label="Close detail"]').click();page.get_by_role('searchbox').fill('Creative');expect(page.locator('.source-masonry-card')).to_have_count(1);page.get_by_role('searchbox').fill('');expect(page.locator('.source-masonry-card')).to_have_count(3);mark('Search')
 page.get_by_role('button',name='Batch actions',exact=True).click();page.get_by_role('button',name='Select all',exact=True).click();page.get_by_role('button',name='More',exact=True).click();expect(page.get_by_role('button',name='Add to note',exact=True)).to_be_visible()
 page.evaluate("window.__host.app.vault.create('Existing.md','Existing project notes.\\n')")
 page.get_by_role('button',name='Add to note',exact=True).click();page.get_by_role('button',name='Existing.md',exact=True).click();page.wait_for_function("new TextDecoder().decode(window.__host.fileMap.get('Existing.md').bytes).includes('#^sb-entry-')");note=page.evaluate("new TextDecoder().decode(window.__host.fileMap.get('Existing.md').bytes)");assert 'Use a natural setting' not in note;mark('Add to existing note uses live Book block embeds')
 page.get_by_role('button',name='Generate note',exact=True).click();page.locator('.modal input').fill('Projects/Drone campaign.md');page.locator('.modal').get_by_role('button',name='Create and open').click();expect(page.locator('.harness-overlay')).to_have_count(0);page.wait_for_function("window.__host.fileMap.has('Projects/Drone campaign.md')")
 note=page.evaluate("new TextDecoder().decode(window.__host.fileMap.get('Projects/Drone campaign.md').bytes)");assert '#^sb-entry-' in note and 'Use a natural setting' not in note;mark('Create project note uses live Book block embeds')
 page.get_by_role('button',name='Send selected',exact=True).click();page.locator('.handoff-prompt textarea').fill('Draft a focused campaign brief.');page.locator('.handoff-modal').get_by_role('button',name='Copy prompt',exact=True).click();prompt=page.evaluate('navigator.clipboard.readText()');assert prompt == 'Draft a focused campaign brief.';mark('Editable handoff prompt copies directly without a snapshot')
 assert page.evaluate("[...window.__host.fileMap.keys()].filter(p=>p.startsWith('Sourcebook/Snapshots/')).length") == 0
 page.locator('.handoff-modal').get_by_role('button',name='Close',exact=True).click();page.set_viewport_size({'width':540,'height':940});out=P/'artifacts';out.mkdir(exist_ok=True);page.screenshot(path=str(out/'workspace-v2-preview.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');mark('Narrow layout')
page.get_by_role('button',name='More',exact=True).click();page.get_by_role('button',name='Remove',exact=True).click();expect(page.locator('.harness-overlay')).to_have_count(0);expect(page.locator('.source-masonry-card')).to_have_count(0);assert page.evaluate("window.__host.fileMap.has('Projects/Drone campaign.md')");mark('Remove preserves originals and live-reference note')
 assert not errors,errors
 report={'environment':'Chromium with mocked Obsidian host; NOT real Obsidian','checks':results,'uncaughtErrors':errors,'passed':len(results)}
 (P/'artifacts/browser-test-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
 browser.close()
server.shutdown()
