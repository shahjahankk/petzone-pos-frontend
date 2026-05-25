const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DISPLAY_DATES = path.join(ROOT, 'utils', 'displayDates.js')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'scripts') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), DISPLAY_DATES).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel.replace(/\.js$/, '')
}

function hasImport(content) {
  return /import\s+\{[^}]*formatDisplayDate[^}]*\}\s+from/.test(content)
}

function addImport(content, fromFile) {
  if (!content.includes('formatDisplayDate') || hasImport(content)) return content
  const importLine = `import { formatDisplayDate } from '${relImport(fromFile)}'\n`
  const useClient = content.startsWith("'use client'") || content.startsWith('"use client"')
  if (useClient) {
    const firstNewline = content.indexOf('\n')
    return content.slice(0, firstNewline + 1) + importLine + content.slice(firstNewline + 1)
  }
  const importMatch = content.match(/^import .+\n/m)
  if (importMatch) {
    const idx = content.indexOf(importMatch[0]) + importMatch[0].length
    return content.slice(0, idx) + importLine + content.slice(idx)
  }
  return importLine + content
}

let changed = 0
for (const file of walk(ROOT)) {
  if (file.includes('displayDates.js') || file.includes('ledgerUxDates.js')) continue
  const before = fs.readFileSync(file, 'utf8')
  const after = addImport(before, file)
  if (after !== before) {
    fs.writeFileSync(file, after)
    changed++
    console.log('import added', path.relative(ROOT, file))
  }
}
console.log(`Done. ${changed} import(s) added.`)
