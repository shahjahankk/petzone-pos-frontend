const fs = require('fs')
const path = require('path')
const assert = require('assert')

const source = fs.readFileSync(path.join(process.cwd(), 'app/pos/terminal/page.js'), 'utf8')

const extractArrow = (name) => {
  const marker = `const ${name} = (`
  const start = source.indexOf(marker)
  assert(start >= 0, `missing helper: ${name}`)
  const end = source.indexOf('\n\n', start)
  assert(end >= 0, `unterminated helper: ${name}`)
  return source.slice(start, end)
}

const helpers = new Function([
  extractArrow('normalizeQuantity'),
  extractArrow('readQuantityInput'),
  'return { normalizeQuantity, readQuantityInput }'
].join('\n'))()

assert.strictEqual(helpers.normalizeQuantity('100'), 100)
assert.strictEqual(helpers.normalizeQuantity('2.345'), 2.35)
assert.strictEqual(helpers.normalizeQuantity('0.001', 1), 0.01)
assert.strictEqual(helpers.normalizeQuantity('abc', 1), 1)

const input = { value: '0.005' }
assert.strictEqual(helpers.readQuantityInput(input, 1), 0.01)
assert.strictEqual(input.value, 0.01)
assert.strictEqual(helpers.readQuantityInput({ value: '' }, 3), 3)

assert(source.includes("const [addQuantity, setAddQuantity] = useState('1')"))
assert(source.includes('const quantityToAdd = normalizeQuantity(addQuantity, 1)'))
assert(source.includes('label="Add Qty"'))
assert(source.includes('aria-label="Quantity"'))

const section = (startText, endText) => {
  const start = source.indexOf(startText)
  assert(start >= 0, `missing section start: ${startText}`)
  const end = source.indexOf(endText, start + startText.length)
  assert(end >= 0, `missing section end: ${endText}`)
  return source.slice(start, end)
}

const snapshot = section('const tabGlobalSnapshot = useMemo(() => ({', 'const hasChanges = Object.entries(tabGlobalSnapshot)')
for (const key of [
  'customerName', 'customerPhone', 'paymentMethod', 'paymentAmount', 'creditAmount',
  'isPartialPayment', 'isFullyCredit', 'isBalancePayment', 'selectedSalesperson',
  'outstandingPayments', 'selectedOutstandingPayments', 'settlementPaymentAmount',
  'settlementCreditAmount', 'isSettlementPartial', 'isSettlementFullyCredit',
  'showSettlementOptions', 'taxRate', 'totalDiscount', 'notes', 'saleDate'
]) assert(snapshot.includes(key), `tab snapshot missing ${key}`)

const hydrate = section('const hydrateTabGlobals = useCallback((tab) => {', 'const createNewTab = useCallback')
for (const key of [
  'setCustomerName', 'setCustomerPhone', 'setPaymentMethod', 'setPaymentAmount', 'setCreditAmount',
  'setIsPartialPayment', 'setIsFullyCredit', 'setIsBalancePayment', 'setSelectedSalesperson',
  'setOutstandingPayments', 'setSelectedOutstandingPayments', 'setSettlementPaymentAmount',
  'setSettlementCreditAmount', 'setIsSettlementPartial', 'setIsSettlementFullyCredit',
  'setShowSettlementOptions', 'setTaxRate', 'setTotalDiscount', 'setNotes', 'setSaleDate'
]) assert(hydrate.includes(key), `hydrate missing ${key}`)

const createTab = section('const createNewTab = useCallback', 'const loadAvailablePrinters = useCallback')
assert(createTab.includes('updateCurrentTab(tabGlobalSnapshot)'))
assert(createTab.includes('hydrateTabGlobals(newTab)'))
assert(createTab.includes('cancelCustomerSearch()'))
assert(createTab.includes('clearCustomerSearchUi()'))

const closeTab = section('const closeTab = (tabId) => {', 'const switchToTab = (tabId) => {')
assert(closeTab.includes('hydrateTabGlobals(nextTab)'))
assert(closeTab.includes('cancelCustomerSearch()'))
assert(closeTab.includes('clearCustomerSearchUi()'))

const switchTab = section('const switchToTab = (tabId) => {', 'const handleSearch = (query) => {')
assert(switchTab.includes('updateCurrentTab(tabGlobalSnapshot)'))
assert(switchTab.includes('hydrateTabGlobals(targetTab)'))
assert(switchTab.includes('cancelCustomerSearch()'))
assert(switchTab.includes('clearCustomerSearchUi()'))

assert(source.includes('const outstandingSearchTokenRef = useRef(0)'))
assert(source.includes('const customerSearchTokenRef = useRef(0)'))

const outstandingSearch = section('const searchOutstandingPayments = useCallback', 'useEffect(() => {\n    const timeoutId')
assert(outstandingSearch.includes('searchToken === outstandingSearchTokenRef.current && requestedTabId === activeTabIdRef.current'))
assert(outstandingSearch.includes('if (!isCurrentSearch()) return'))

const customerSearch = section('const searchCustomers = useCallback', 'const triggerCustomerSearch = useCallback')
assert(customerSearch.includes('searchToken === customerSearchTokenRef.current && requestedTabId === activeTabIdRef.current'))
assert(customerSearch.includes('if (!isCurrentSearch()) return'))
assert(outstandingSearch.includes('setIsSearchingOutstanding(false)'))
assert(customerSearch.includes('setCustomerSearchLoading(false)'))

const cancelHelper = section('const cancelCustomerSearch = useCallback', 'const clearCustomerSearchUi = useCallback')
assert(cancelHelper.includes('setCustomerSearchLoading(false)'))

const clearState = section('const clearAllPOSState = () => {', 'const refreshOutstandingPayments = () => {')
assert(clearState.includes('cancelCustomerSearch()'))
assert(clearState.includes('clearCustomerSearchUi()'))

let token = 0
let activeTab = 'A'
const startSearch = () => {
  const searchToken = ++token
  const requestedTabId = activeTab
  return () => searchToken === token && requestedTabId === activeTab
}
const tabASearch = startSearch()
activeTab = 'B'
const tabBSearch = startSearch()
assert.strictEqual(tabASearch(), false)
assert.strictEqual(tabBSearch(), true)

console.log('POS terminal checks passed')
