const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DISPLAY_DATES = path.join(ROOT, 'utils', 'displayDates.js')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
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

function ensureImport(content, fromFile) {
  if (content.includes('formatDisplayDate')) return content
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

function transform(content, file) {
  if (file.includes('displayDates.js') || file.includes('apply-display-dates.js')) return content
  if (!content.includes('toLocaleDateString')) return content

  let next = content

  next = next.replace(/new Date\(\)\.toLocaleDateString\(\)/g, 'formatDisplayDate(new Date())')
  next = next.replace(/new Date\(([^)]+)\)\.toLocaleDateString\([^)]*\)/g, 'formatDisplayDate($1)')
  next = next.replace(/([a-zA-Z_$][\w$.]*)\.toLocaleDateString\(\)/g, 'formatDisplayDate($1)')

  if (next !== content) {
    next = ensureImport(next, file)
  }
  return next
}

const files = walk(ROOT)
let changed = 0
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8')
  const after = transform(before, file)
  if (after !== before) {
    fs.writeFileSync(file, after)
    changed++
    console.log('updated', path.relative(ROOT, file))
  }
}
console.log(`Done. ${changed} file(s) updated.`)
