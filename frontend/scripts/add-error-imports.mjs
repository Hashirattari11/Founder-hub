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

function importPath(fromFile) {
  const rel = path.relative(path.dirname(fromFile), path.join(ROOT, 'lib', 'errors.ts'))
  const normalized = rel.split(path.sep).join('/')
  if (normalized.startsWith('.')) return normalized.replace(/\.ts$/, '')
  return './' + normalized.replace(/\.ts$/, '')
}

let changed = 0
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (SKIP.has(rel)) continue

  let src = fs.readFileSync(file, 'utf8')
  if (!src.includes('getErrorMessage(')) continue
  if (/import\s*\{[^}]*getErrorMessage[^}]*\}\s*from/.test(src)) continue

  const importLine = `import { getErrorMessage } from '${importPath(file)}'\n`
  const m = src.match(/^import .+\n/m)
  src = m ? src.replace(m[0], m[0] + importLine) : importLine + src
  fs.writeFileSync(file, src)
  changed++
  console.log('added import:', rel)
}

console.log('done:', changed, 'files')
