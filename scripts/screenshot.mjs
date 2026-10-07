// Visit every view, open a concept drawer, run a search, save 1440x900 screenshots, and fail on any
// console error or page error.
//   BASE_URL=http://127.0.0.1:8408/ OUT_DIR=./screenshots SINGLE_FILE=./dist-single/index.html node scripts/screenshot.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8408/'
const OUT = path.resolve(process.env.OUT_DIR || 'screenshots')
const SINGLE = process.env.SINGLE_FILE || ''
const THEME = process.env.THEME || 'dark'
fs.mkdirSync(OUT, { recursive: true })

const errors = []
const shots = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
// block any network request that is not to the app itself: the app must make no external calls
const external = []
await ctx.route('**/*', (route) => {
  const u = route.request().url()
  if (u.startsWith(BASE) || u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue()
  external.push(u)
  return route.abort()
})
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

async function shot(name, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 700)
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: !!opts.full })
  shots.push(file)
  console.log('saved', path.basename(file))
}
async function goView(hash) {
  await page.goto(BASE + hash, { waitUntil: 'networkidle' })
  await page.waitForSelector('.content h1, .content .h-page')
}

if (THEME === 'light') {
  await page.goto(BASE)
  await page.evaluate(() => localStorage.setItem('cte-theme', 'light'))
}

const views = ['overview', 'hierarchy', 'relations', 'lens', 'flow', 'heatmap', 'sources', 'evolution', 'governance', 'explore', 'text', 'about']
let i = 1
for (const v of views) {
  await goView(`#/${v}`)
  await shot(`${String(i++).padStart(2, '0')}-${v}`, { wait: v === 'relations' ? 2500 : v === 'hierarchy' ? 1200 : 700 })
}

// extra states
await goView('#/hierarchy?focus=facet:Climate%20risk')
await shot(`${String(i++).padStart(2, '0')}-hierarchy-zoom-climate-risk`, { wait: 1400 })
await goView('#/relations')
await page.waitForTimeout(2200)
// hover the canvas centre to show the neighbour highlight
const box = await page.locator('canvas').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await shot(`${String(i++).padStart(2, '0')}-relations-hover`, { wait: 400 })
await goView('#/heatmap?r=Crops%20%26%20agronomy&f=Intervention')
await shot(`${String(i++).padStart(2, '0')}-heatmap-cell`)
await goView('#/explore?facet=Climate%20risk&atag=Adaptation-specific')
await shot(`${String(i++).padStart(2, '0')}-explore-filtered`)

// drawer deep link
await page.goto(BASE + '#/concept/CRK_102', { waitUntil: 'networkidle' })
await page.waitForSelector('.drawer')
await shot(`${String(i++).padStart(2, '0')}-drawer-CRK_102`)
await page.goto(BASE + '#/concept/INT_269', { waitUntil: 'networkidle' })
await page.waitForSelector('.drawer')
await shot(`${String(i++).padStart(2, '0')}-drawer-INT_269`)
await page.keyboard.press('Escape')

// spot-check concepts in the drawer against the source JSON
const data = JSON.parse(fs.readFileSync(new URL('../src/data/taxonomy.json', import.meta.url)))
const byId = new Map(data.concepts.map((c) => [c.id, c]))
for (const id of ['CRK_102', 'INT_269', 'CDI_03', 'SYS_076']) {
  const c = byId.get(id)
  if (!c) continue
  await page.goto(BASE + '#/concept/' + id, { waitUntil: 'networkidle' })
  await page.waitForSelector('.drawer h2')
  const got = await page.evaluate(() => {
    const d = document.querySelector('.drawer')
    const secs = [...d.querySelectorAll('.dsec')]
    const sec = (t) => secs.find((s) => s.querySelector('h4')?.textContent.startsWith(t))
    const rel = sec('Typed relations')
    return {
      label: d.querySelector('h2').textContent,
      def: sec('Definition')?.querySelector('p')?.textContent,
      path: [...d.querySelectorAll('nav[aria-label=Path] button')].map((b) => b.textContent.trim()),
      relRows: rel ? rel.querySelectorAll(':scope > div > div').length : 0,
      syn: sec('Synonyms')?.querySelectorAll('.chip').length ?? 0,
      official: d.querySelector('a[href*="mlolita26.github.io"]')?.getAttribute('href'),
    }
  })
  const parentLabel = c.parent ? byId.get(c.parent).label : null
  const checks = {
    label: got.label === c.label,
    definition: got.def === c.def,
    parent: parentLabel === null ? got.path.length === 0 : got.path[got.path.length - 1] === parentLabel,
    relations: got.relRows === c.rels.length + c.inRels.length,
    synonyms: got.syn === c.syn.length,
    official: got.official === `${data.meta.site}terms/${id}.html`,
  }
  const ok = Object.values(checks).every(Boolean)
  console.log(`spot-check ${id} ${c.label}: ${ok ? 'OK' : 'MISMATCH'} parent=${parentLabel} rels=${got.relRows} syn=${got.syn}`, ok ? '' : JSON.stringify(checks))
  if (!ok) errors.push(`spot-check failed for ${id}: ${JSON.stringify(checks)}`)
}

// global search palette
await goView('#/overview')
await page.keyboard.press('/')
await page.waitForSelector('.pal input')
await page.keyboard.type('drought', { delay: 30 })
await shot(`${String(i++).padStart(2, '0')}-search-drought`, { wait: 500 })
await page.keyboard.press('Enter')
await page.waitForSelector('.drawer')
const drawerTitle = await page.locator('.drawer h2').first().textContent()
console.log('search Enter opened:', drawerTitle)

// explore table search
await goView('#/explore')
await page.fill('[data-testid=explore-search]', 'insurance')
await page.waitForTimeout(300)
const cnt = await page.locator('[data-testid=explore-count] b').textContent()
console.log('explore search "insurance" ->', cnt, 'concepts')
await shot(`${String(i++).padStart(2, '0')}-explore-search-insurance`)

// light theme overview
await goView('#/overview')
await page.click('button[aria-label^="Switch to"]')
await shot(`${String(i++).padStart(2, '0')}-overview-light`)
await page.click('button[aria-label^="Switch to"]')

// mobile width
await page.setViewportSize({ width: 390, height: 844 })
await goView('#/overview')
await shot(`${String(i++).padStart(2, '0')}-overview-phone`)
await page.setViewportSize({ width: 1440, height: 900 })

// single-file build via file://
if (SINGLE) {
  const p2 = await ctx.newPage()
  p2.on('console', (m) => m.type() === 'error' && errors.push(`single console: ${m.text()}`))
  p2.on('pageerror', (e) => errors.push(`single pageerror: ${e.message}`))
  await p2.goto(pathToFileURL(path.resolve(SINGLE)).href)
  await p2.waitForSelector('.content h1')
  await p2.waitForTimeout(800)
  const f1 = path.join(OUT, `${String(i++).padStart(2, '0')}-single-file-overview.png`)
  await p2.screenshot({ path: f1 })
  shots.push(f1)
  await p2.goto(pathToFileURL(path.resolve(SINGLE)).href + '#/relations')
  await p2.waitForTimeout(2500)
  const f2 = path.join(OUT, `${String(i++).padStart(2, '0')}-single-file-relations.png`)
  await p2.screenshot({ path: f2 })
  shots.push(f2)
  console.log('saved single-file screenshots')
}

await browser.close()
console.log(`\n${shots.length} screenshots in ${OUT}`)
console.log(`external requests blocked: ${external.length}${external.length ? ' ' + JSON.stringify(external.slice(0, 5)) : ''}`)
console.log(`console/page errors: ${errors.length}`)
errors.forEach((e) => console.log('  ' + e))
if (errors.length || external.length) process.exit(1)
