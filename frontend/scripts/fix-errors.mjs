import fs from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd(), 'src')
const SKIP = new Set(['lib/errors.ts', 'hooks/useErrorHandler.ts'])

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(tsx?)$/.test(ent.name)) out.push(p)
  }
  return out
}

const patterns = [
  [/toast\.error\(\s*err\s*instanceof\s*Error\s*\?\s*err\.message\s*:\s*'([^']*)'\s*\)/g, "toast.error(getErrorMessage(err, 'generic'))"],
  [/toast\.error\(\s*error\s*instanceof\s*Error\s*\?\s*error\.message\s*:\s*'([^']*)'\s*\)/g, "toast.error(getErrorMessage(error, 'generic'))"],
  [/toast\.error\(\s*e\s*instanceof\s*Error\s*\?\s*e\.message\s*:\s*'([^']*)'\s*\)/g, "toast.error(getErrorMessage(e, 'generic'))"],
  [/setError\(\s*err\s*instanceof\s*Error\s*\?\s*err\.message\s*:\s*'([^']*)'\s*\)/g, "setError(getErrorMessage(err, 'generic'))"],
  [/setError\(\s*e\s*instanceof\s*Error\s*\?\s*e\.message\s*:\s*'([^']*)'\s*\)/g, "setError(getErrorMessage(e, 'generic'))"],
  [/setLoadError\(\s*friendlyDbError\(error\)\.message\s*\)/g, "setLoadError(getErrorMessage(error, 'generic'))"],
  [/toast\.error\(friendlyDbError\(err\)\.message\)/g, "toast.error(getErrorMessage(err, 'generic'))"],
]

let changed = 0
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (SKIP.has(rel)) continue
  let src = fs.readFileSync(file, 'utf8')
  const before = src
  for (const [re, rep] of patterns) src = src.replace(re, rep)
  if (src === before) continue

  if (!src.includes('getErrorMessage') && /getErrorMessage\(/.test(src)) {
    const depth = rel.split('/').length - 1
    const prefix = depth ? '../'.repeat(depth) : './'
    const importLine = `import { getErrorMessage } from '${prefix}lib/errors'\n`
    if (!src.includes("from '../lib/errors'") && !src.includes("from '../../lib/errors'") && !src.includes("from '../../../lib/errors'")) {
      const m = src.match(/^import .+\n/m)
      src = m ? src.replace(m[0], m[0] + importLine) : importLine + src
    }
  }

  fs.writeFileSync(file, src)
  changed++
  console.log('updated', rel)
}
console.log('done', changed, 'files')
