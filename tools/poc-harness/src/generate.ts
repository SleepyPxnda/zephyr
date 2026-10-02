/**
 * Generates golden reference values from the prototype (reference/poc-reitwege.html).
 *
 * The prototype's script is one closure `(() => { … })();`. We insert `inject.js` right before
 * the closing `})();` so the closure's functions become reachable as `window.__poc`, load the
 * patched page in Chromium and record what the prototype computes (`collect.js`). Output goes
 * to packages/core/test/fixtures/. Run with `pnpm poc:fixtures`.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import { geometryCases } from './cases.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const pocPath = join(root, 'reference/poc-reitwege.html')
const outDir = join(root, 'packages/core/test/fixtures')

function patchedPoc(): string {
  const html = readFileSync(pocPath, 'utf8').replace(/\r\n/g, '\n')
  const marker = '})();\n</script>'
  const at = html.lastIndexOf(marker)
  if (at < 0) throw new Error('closing `})();` of the prototype script not found')
  const own = (f: string) => readFileSync(join(here, f), 'utf8')
  return (
    html.slice(0, at) +
    own('inject.js') +
    html.slice(at) +
    `\n<script>${own('scenarios.js')}</script>\n<script>${own('ops.js')}</script>\n<script>${own('collect.js')}</script>`
  )
}

function launch() {
  const pwPath = process.env.PLAYWRIGHT_BROWSERS_PATH
  return pwPath
    ? chromium.launch({ executablePath: join(pwPath, 'chromium') })
    : chromium.launch({ channel: process.env.E2E_CHANNEL ?? 'chrome' })
}

function write(name: string, data: unknown) {
  writeFileSync(join(outDir, name), JSON.stringify(data) + '\n')
  console.log('wrote', name)
}

async function main() {
  const tmp = join(tmpdir(), `zephyr-poc-${process.pid}.html`)
  writeFileSync(tmp, patchedPoc())
  const browser = await launch()
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(pathToFileURL(tmp).href)
    await page.waitForFunction('!!window.__harness && !!window.__poc')
    if (errors.length) throw new Error('prototype errors: ' + errors.join('; '))

    rmSync(outDir, { recursive: true, force: true })
    mkdirSync(join(outDir, 'plans'), { recursive: true })

    const names = (await page.evaluate('window.__harness.names()')) as {
      drawn: string[]
      raw: string[]
      ops: string[]
    }
    for (const [kind, list] of [
      ['drawn', names.drawn],
      ['raw', names.raw],
    ] as const) {
      for (const name of list) {
        const plan = await page.evaluate(
          `window.__harness.runPlan(${JSON.stringify(name)}, ${JSON.stringify(kind)})`,
        )
        write(`plans/${name}.json`, plan)
      }
    }

    const ops: unknown[] = []
    for (const name of names.ops) ops.push(await page.evaluate(`window.__harness.runOp(${JSON.stringify(name)})`))
    write('ops.json', ops)

    const geometry = await page.evaluate(
      `window.__harness.runGeometry(${JSON.stringify(geometryCases())})`,
    )
    write('geometry.json', geometry)
    if (errors.length) throw new Error('prototype errors: ' + errors.join('; '))
  } finally {
    await browser.close()
    rmSync(tmp, { force: true })
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
