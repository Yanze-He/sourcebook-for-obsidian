"""Render Sourcebook Desktop parity previews in Chromium."""
from pathlib import Path
import base64, io, json
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

P = Path(__file__).resolve().parents[2]
OUT = P / 'artifacts'
OUT.mkdir(exist_ok=True)


def image_bytes(size, palette, mode='landscape'):
    w, h = size
    im = Image.new('RGB', (w, h), palette[0])
    d = ImageDraw.Draw(im)
    if mode == 'runners':
        d.rectangle((0, 0, w, h * .45), fill=palette[0])
        d.polygon([(0, h), (w * .22, h * .35), (w * .42, h)], fill=palette[1])
        d.polygon([(w * .18, h), (w * .62, h * .18), (w, h)], fill=palette[2])
        for x, c in [(w * .34, '#181818'), (w * .52, '#e8d4bd'), (w * .72, '#f0ece5')]:
            d.ellipse((x - 18, h * .42, x + 18, h * .48), fill=c)
            d.line((x, h * .48, x - 12, h * .72), fill=c, width=12)
            d.line((x - 5, h * .61, x - 35, h * .88), fill=c, width=10)
            d.line((x, h * .62, x + 28, h * .84), fill=c, width=10)
    elif mode == 'portrait':
        d.rectangle((0, 0, w, h), fill=palette[0])
        d.ellipse((w * .37, h * .12, w * .63, h * .34), fill=palette[1])
        d.rounded_rectangle((w * .2, h * .28, w * .8, h * .75), radius=40, fill=palette[2])
        d.ellipse((w * .26, h * .31, w * .45, h * .47), fill='#20242c')
        d.ellipse((w * .55, h * .31, w * .74, h * .47), fill='#20242c')
        d.rectangle((w * .42, h * .37, w * .58, h * .42), fill='#20242c')
    elif mode == 'drone':
        d.rectangle((0, 0, w, h), fill=palette[0])
        d.rounded_rectangle((w * .36, h * .38, w * .64, h * .64), radius=35, fill=palette[2])
        for cx, cy in [(w * .25, h * .35), (w * .75, h * .35), (w * .25, h * .68), (w * .75, h * .68)]:
            d.ellipse((cx - 65, cy - 30, cx + 65, cy + 30), outline=palette[1], width=16)
            d.line((w * .5, h * .5, cx, cy), fill=palette[2], width=16)
    elif mode == 'cinematic':
        d.rectangle((0, 0, w, h), fill=palette[0])
        d.ellipse((w * .62, -h * .05, w * .95, h * .6), fill=palette[3])
        d.polygon([(0, h), (w * .22, h * .25), (w * .42, h)], fill=palette[1])
        d.polygon([(w * .2, h), (w * .62, h * .12), (w, h)], fill=palette[2])
        d.rounded_rectangle((w * .38, h * .48, w * .68, h * .62), radius=20, fill='#2c3035')
    elif mode == 'grass':
        d.rectangle((0, 0, w, h), fill=palette[0])
        for i in range(160):
            x = (i * 47) % w
            y = h - (i * 29) % int(h * .55)
            d.line((x, h, x + ((i % 5) - 2) * 8, y), fill=palette[1 + (i % 2)], width=2)
    else:
        d.rectangle((0, 0, w, h), fill=palette[0])
        d.polygon([(0, h), (w * .4, h * .25), (w * .65, h)], fill=palette[1])
        d.polygon([(w * .35, h), (w * .72, h * .1), (w, h)], fill=palette[2])
    out = io.BytesIO()
    im.save(out, 'PNG')
    return out.getvalue()


fixtures = {
    'runners.png': image_bytes((620, 780), ('#93b9da', '#4e6474', '#70818d', '#f3d77d'), 'runners'),
    'antigravity.png': image_bytes((620, 350), ('#8cc5a2', '#2f5142', '#202a2e', '#e7dfd0'), 'portrait'),
    'dji-air.png': image_bytes((620, 350), ('#2d3341', '#4a3b2b', '#1b2128', '#ffcf78'), 'cinematic'),
    'grass.png': image_bytes((620, 360), ('#d9eff4', '#51a941', '#25772c', '#fff'), 'grass'),
    'drone.png': image_bytes((620, 580), ('#eef0f7', '#cfd1de', '#f4f4f7', '#fff'), 'drone'),
}
encoded = {key: base64.b64encode(value).decode() for key, value in fixtures.items()}

html = (P / 'tests/browser/index.html').read_text()
html = html.replace('<link rel="stylesheet" href="/styles.css">', '<style>' + (P / 'styles.css').read_text() + '</style>')
for url, filename in [('/tests/browser/host.cjs', 'tests/browser/host.cjs'), ('/main.js', 'main.js')]:
    html = html.replace(f'<script src="{url}"></script>', '<script>' + (P / filename).read_text() + '</script>')

SEED = r"""async files => {
  const p = window.__host.plugin;
  p.settings.language = 'en';
  const book = await p.store.createBook('Default Book', 'en');
  await p.store.createBook('sourcebook brand', 'en');
  p.settings.bookId = book.id;
  await p.saveSettings();
  const decode = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  await p.store.addLink(book, 'Yanze-He/sourcebook-for-agents', 'https://github.com/Yanze-He/sourcebook-for-agents');
  await p.store.importFile(book, 'runners.png', decode(files['runners.png']));
  await p.store.importFile(book, 'Antigravity A1.png', decode(files['antigravity.png']));
  await p.store.importFile(book, 'Introduction.pdf', new TextEncoder().encode('%PDF-1.4 Sourcebook preview').buffer);
  await p.store.importFile(book, 'DJI AIR 3S.png', decode(files['dji-air.png']));
  await p.store.addLink(book, 'Post from X', 'https://x.com/ZekeAI3D/status/1');
  await p.store.importFile(book, 'grass.png', decode(files['grass.png']));
  await p.store.addText(book, 'Drone TVC Creative Brief Project', `Drone TVC Creative Brief\n\nProject Title\n\nAeroPulse X1 – “Own the Sky”\n\nProduct\n\nAeroPulse X1 – Premium`);
  await p.store.importFile(book, 'drone.png', decode(files['drone.png']));
  await p.store.addText(book, 'grok conversation', `1. user\n\nWhat is a world model?\n\n---\n\n2. assistant\n\nA world model is an internal representation or simulator of an environment.`);
  const fresh = (await p.store.load()).books.find(value => value.id === book.id);
  const resolved = await p.store.resolve(fresh, true);
  await p.store.updateNote(fresh, resolved.items[1].entry.id, 'Motion and natural scale reference.', '');
  await p.store.updateNote((await p.store.load()).books.find(value => value.id === book.id), resolved.items[4].entry.id, 'Use the restrained cinematic lighting.', '');
  await window.__host.leaves[0].view.reload();
}"""


def make_page(context):
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(html)
    page.wait_for_function('window.__host.ready===true')
    page.evaluate(SEED, encoded)
    page.wait_for_timeout(200)
    return page, errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])

    # Wide workspace preview: equivalent to the reference desktop capture scale.
    main_context = browser.new_context(
        viewport={'width': 1575, 'height': 829},
        device_scale_factor=1.3,
        locale='en-US',
        permissions=['clipboard-read', 'clipboard-write'],
    )
    page, main_errors = make_page(main_context)
    page.screenshot(path=str(OUT / 'desktop-source-port-main.png'))

    page.get_by_role('button', name='Batch actions').click()
    cards = page.locator('.source-masonry-card')
    for index in [1, 2, 3, 4]:
        cards.nth(index).click()
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'desktop-source-port-selection.png'))
    page.get_by_role('button', name='Send to AI').click()
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'desktop-source-port-handoff.png'))
    main_context.close()

    # Native-sized popovers/details: reference screenshots were captured at retina density.
    detail_context = browser.new_context(
        viewport={'width': 520, 'height': 683},
        device_scale_factor=2,
        locale='en-US',
        permissions=['clipboard-read', 'clipboard-write'],
    )
    page, detail_errors = make_page(detail_context)
    page.locator('.source-masonry-card').filter(has=page.get_by_role('heading', name='runners')).click()
    page.wait_for_timeout(320)
    page.screenshot(path=str(OUT / 'desktop-source-port-detail.png'))
    detail_context.close()

    controls_context = browser.new_context(
        viewport={'width': 1024, 'height': 700},
        device_scale_factor=2,
        locale='en-US',
    )
    page, controls_errors = make_page(controls_context)

    page.locator('.book-switcher').click()
    page.wait_for_timeout(50)
    page.locator('.book-picker-popover').screenshot(path=str(OUT / 'desktop-source-port-book-menu.png'))
    page.locator('.popover-dismiss-layer').click(position={'x': 900, 'y': 600})

    page.get_by_role('button', name='Filter').click()
    page.wait_for_timeout(50)
    page.locator('.source-item-filter-popover').screenshot(path=str(OUT / 'desktop-source-port-filter.png'))
    page.locator('.popover-dismiss-layer').click(position={'x': 900, 'y': 600})

    page.locator('.book-switcher').click()
    page.locator('.book-options-button').first.click()
    page.get_by_role('button', name='Rename', exact=True).click()
    page.wait_for_timeout(50)
    page.locator('.book-settings-modal').screenshot(path=str(OUT / 'desktop-source-port-book-setting.png'))
    controls_context.close()

    report = {
        'errors': main_errors + detail_errors + controls_errors,
        'cards': 10,
    }
    (OUT / 'desktop-source-port-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    browser.close()
