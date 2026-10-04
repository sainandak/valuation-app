export const num = value => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const inr = value => '₹' + Math.round(value).toLocaleString('en-IN')

export const ratePerGram = (report, metal) => num(report[metal === 'Silver' ? 'silverG' : 'goldG'])

export function calc(item, report) {
  const net = Math.max(num(item.gross) - num(item.stone), 0)
  const pure = net * num(item.purity) / 100
  const gramRate = item.metal === 'Silver' || item.metal === 'Gold' ? ratePerGram(report, item.metal) : 0
  const value = pure * gramRate + num(item.fixed)
  return {net, pure, rate: item.metal === 'Silver' ? gramRate * 1000 : item.metal === 'Gold' ? gramRate * 10 : 0, value: Math.floor(Math.round(value * 1e6) / 1e6)}
}

const present = value => String(value ?? '').trim().length > 0
const numeric = value => {
  if (!present(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateReport(report, reports = []) {
  const errors = []
  if (!present(report.date)) errors.push('Enter the valuation date.')
  if (!present(report.owner)) errors.push('Enter the owner name.')
  if (!present(report.cert)) errors.push('Enter a certificate number.')
  if (!present(report.valuer)) errors.push('Enter the valuer name.')

  const duplicate = reports.some(saved => saved.id !== report.id && String(saved.cert ?? '').trim().toLowerCase() === String(report.cert ?? '').trim().toLowerCase())
  if (present(report.cert) && duplicate) errors.push('Certificate number already exists in saved reports.')

  const activeItems = (report.items ?? []).filter(item => present(item.name) || present(item.gross) || present(item.fixed))
  if (!activeItems.length) errors.push('Add at least one item.')

  for (let index = 0; index < activeItems.length; index += 1) {
    const item = activeItems[index]
    const label = `Item ${index + 1}`
    if (!present(item.name)) errors.push(`${label}: enter a description.`)
    if (numeric(item.qty) === null || numeric(item.qty) <= 0) errors.push(`${label}: quantity must be greater than zero.`)
    if (item.metal === 'Other') {
      if (num(item.fixed) <= 0) errors.push(`${label}: enter a positive fixed value.`)
      continue
    }
    if (numeric(item.gross) === null || numeric(item.gross) <= 0) errors.push(`${label}: gross weight must be greater than zero.`)
    if (numeric(item.stone) === null && present(item.stone)) errors.push(`${label}: stone weight must be a number.`)
    else if (num(item.stone) < 0 || num(item.stone) > num(item.gross)) errors.push(`${label}: stone weight must be between zero and gross weight.`)
    if (numeric(item.purity) === null || numeric(item.purity) <= 0 || numeric(item.purity) > 100) errors.push(`${label}: purity must be between 0 and 100.`)
    const reportRate = item.metal === 'Silver' ? report.silverG : report.goldG
    if (numeric(reportRate) === null || ratePerGram(report, item.metal) <= 0) errors.push(`${label}: enter a positive ${item.metal.toLowerCase()} rate.`)
  }
  return errors
}
