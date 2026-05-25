const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const APP_DATE_PICKER = path.join(ROOT, 'components', 'date', 'AppDatePicker.js')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'scripts') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(js|jsx)$/.test(entry.name)) files.push(full)
  }
  return files
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), APP_DATE_PICKER).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel.replace(/\.js$/, '')
}

function migrate(content, file) {
  if (file.includes('AppDatePicker.js') || file.includes('AppDateField.js')) return content
  if (!content.includes("from '@mui/x-date-pickers/DatePicker'") && !content.includes('<DatePicker')) return content

  let next = content
  const importPath = relImport(file)
  const importLine = `import AppDatePicker from '${importPath}'\n`

  next = next.replace(/import \{ DatePicker \} from '@mui\/x-date-pickers\/DatePicker'\n?/g, '')
  next = next.replace(/<DatePicker/g, '<AppDatePicker')

  if (!next.includes("import AppDatePicker from")) {
    const useClient = next.startsWith("'use client'") || next.startsWith('"use client"')
    if (useClient) {
      const firstNewline = next.indexOf('\n')
      next = next.slice(0, firstNewline + 1) + importLine + next.slice(firstNewline + 1)
    } else {
      const importMatch = next.match(/^import .+\n/m)
      if (importMatch) {
        const idx = next.indexOf(importMatch[0]) + importMatch[0].length
        next = next.slice(0, idx) + importLine + next.slice(idx)
      } else {
        next = importLine + next
      }
    }
  }

  return next
}

let changed = 0
for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, 'utf8')
  const after = migrate(before, file)
  if (after !== before) {
    fs.writeFileSync(file, after)
    changed++
    console.log('picker updated', path.relative(ROOT, file))
  }
}
console.log(`Done. ${changed} file(s).`)
