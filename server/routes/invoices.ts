import { Router, Response } from 'express'
import { db, Invoice } from '../db.js'
import { authenticate, requireRole, AuthenticatedRequest } from '../auth.js'

export const invoicesRouter = Router()

// Reject CHEF from invoices (403)
const forbidChef = (req: AuthenticatedRequest, res: Response, next: () => void) => {
  if (req.user?.role === 'CHEF') {
    return res.status(403).json({
      message: 'Forbidden. Chefs do not have access to invoice records.',
      errors: ['FORBIDDEN']
    })
  }
  next()
}

invoicesRouter.use(authenticate, forbidChef)

// POST /api/invoices — { paymentId } manual fallback (409 if already exists)
invoicesRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const { paymentId } = req.body

  if (!paymentId) {
    return res.status(400).json({
      message: 'paymentId is required',
      errors: ['PAYMENT_ID_REQUIRED']
    })
  }

  const existing = db.invoices.find(inv => inv.paymentId === Number(paymentId))
  if (existing) {
    return res.status(409).json({
      message: 'Invoice already exists for this payment',
      errors: ['INVOICE_ALREADY_EXISTS'],
      data: existing
    })
  }

  const payment = db.payments.find(p => p.id === Number(paymentId))
  if (!payment) {
    return res.status(404).json({
      message: 'Payment not found',
      errors: ['PAYMENT_NOT_FOUND']
    })
  }

  if (payment.status !== 'PAID') {
    return res.status(400).json({
      message: 'Cannot issue invoice for unpaid or unverified payment',
      errors: ['PAYMENT_NOT_PAID']
    })
  }

  const now = new Date().toISOString()
  const dateStr = now.slice(0, 10).replace(/-/g, '')
  const invSeq = db.nextInvoiceId()
  const invoiceNumber = `INV-${dateStr}-${invSeq}`

  const targetTable = db.tables.find(t => t.id === payment.tableId)
  const orders = db.orders.filter(o => o.tableId === payment.tableId && o.paymentStatus === 'PAID')

  const subtotal = +orders.reduce((s, o) => s + o.subtotal, 0).toFixed(2)
  const discount = +orders.reduce((s, o) => s + (o.discount || 0), 0).toFixed(2)
  const tax = +orders.reduce((s, o) => s + (o.tax || 0), 0).toFixed(2)
  const total = +orders.reduce((s, o) => s + o.total, 0).toFixed(2)

  const newInvoice: Invoice = {
    id: invSeq,
    invoiceNumber,
    paymentId: payment.id,
    paymentMethod: payment.method,
    tableId: payment.tableId,
    tableNumber: targetTable?.table_number || String(payment.tableId),
    orderIds: orders.map(o => o.id),
    orders,
    subtotal,
    discount,
    tax,
    total,
    currency: payment.currency,
    status: 'ISSUED',
    reprintCount: 0,
    createdAt: now
  }

  db.invoices.unshift(newInvoice)

  return res.status(201).json({
    message: 'Invoice created successfully',
    data: newInvoice
  })
})

// GET /api/invoices — (?page&limit&paymentMethod&dateFrom&dateTo&search&tableNo)
invoicesRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const { page = '1', limit = '20', paymentMethod, dateFrom, dateTo, search, tableNo } = req.query

  let list = db.invoices

  // Customers see only invoices covering their own table/orders
  if (user.role === 'CUSTOMER') {
    if (user.tableId) {
      list = list.filter(inv => inv.tableId === user.tableId)
    } else {
      list = list.filter(inv => inv.orders.some(o => o.customerId === user.id))
    }
  }

  if (paymentMethod) {
    list = list.filter(inv => inv.paymentMethod.toUpperCase() === String(paymentMethod).toUpperCase())
  }
  if (tableNo) {
    list = list.filter(inv => inv.tableNumber === String(tableNo))
  }
  if (dateFrom) {
    list = list.filter(inv => inv.createdAt >= String(dateFrom))
  }
  if (dateTo) {
    list = list.filter(inv => inv.createdAt <= String(dateTo))
  }
  if (search) {
    const q = String(search).toLowerCase()
    list = list.filter(inv => 
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.tableNumber.toLowerCase().includes(q)
    )
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1)
  const limitNum = Math.max(1, parseInt(String(limit), 10) || 20)
  const total = list.length
  const totalPages = Math.ceil(total / limitNum) || 1
  const start = (pageNum - 1) * limitNum
  const paginated = list.slice(start, start + limitNum)

  return res.status(200).json({
    message: 'Invoices retrieved successfully',
    data: paginated,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  })
})

// GET /api/invoices/number/:invoiceNumber
invoicesRouter.get('/number/:invoiceNumber', (req: AuthenticatedRequest, res: Response) => {
  const numParam = req.params.invoiceNumber
  const invoice = db.invoices.find(inv => inv.invoiceNumber === numParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  return res.status(200).json({
    message: 'Invoice details retrieved successfully',
    data: invoice
  })
})

// GET /api/invoices/:id
invoicesRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const invoice = db.invoices.find(inv => inv.id === Number(idParam) || inv.invoiceNumber === idParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  return res.status(200).json({
    message: 'Invoice details retrieved successfully',
    data: invoice
  })
})

// GET /api/invoices/:id/receipt — thermal text format
invoicesRouter.get('/:id/receipt', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const invoice = db.invoices.find(inv => inv.id === Number(idParam) || inv.invoiceNumber === idParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  const divider = '========================================\n'
  const subDivider = '----------------------------------------\n'
  let text = ''
  text += '                GOMEAL POS              \n'
  text += '         Artisanal Dining Experience    \n'
  text += '        Preah Norodom Blvd, Phnom Penh  \n'
  text += '            Tel: +855 23 888 999        \n'
  text += divider
  text += `Receipt No: ${invoice.invoiceNumber}\n`
  text += `Table: ${invoice.tableNumber}   | Date: ${new Date(invoice.createdAt).toLocaleString()}\n`
  text += `Payment: ${invoice.paymentMethod} | Status: ${invoice.status}\n`
  if (invoice.reprintCount > 0) {
    text += `*** DUPLICATE REPRINT #${invoice.reprintCount} ***\n`
  }
  text += subDivider
  text += 'Item                    Qty   Price    Total\n'
  text += subDivider

  invoice.orders.forEach(ord => {
    ord.items.forEach(it => {
      const name = it.name.padEnd(23).slice(0, 23)
      const qty = String(it.quantity).padStart(3)
      const price = `$${it.unitPrice.toFixed(2)}`.padStart(8)
      const sub = `$${it.subtotal.toFixed(2)}`.padStart(8)
      text += `${name} ${qty} ${price} ${sub}\n`
      if (it.customizations && it.customizations.length > 0) {
        it.customizations.forEach(c => {
          text += `  * ${c.name}: ${c.amount} ${c.unit || ''}\n`
        })
      }
    })
  })

  text += subDivider
  text += `Subtotal:                              $${invoice.subtotal.toFixed(2)}\n`
  if (invoice.discount > 0) {
    text += `Discount:                             -$${invoice.discount.toFixed(2)}\n`
  }
  text += `VAT / Tax (10%):                       $${invoice.tax.toFixed(2)}\n`
  text += divider
  text += `TOTAL USD:                             $${invoice.total.toFixed(2)}\n`
  text += `TOTAL KHR:                      KHR ${(invoice.total * 4100).toLocaleString()}\n`
  text += divider
  text += '         Thank you for dining with us!  \n'
  text += '           Please come back soon!       \n'

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  return res.status(200).send(text)
})

// GET /api/invoices/:id/reprint — increments reprintCount, same invoice never a new one
invoicesRouter.get('/:id/reprint', (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const invoice = db.invoices.find(inv => inv.id === Number(idParam) || inv.invoiceNumber === idParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  invoice.reprintCount += 1

  return res.status(200).json({
    message: `Invoice reprinted (reprint #${invoice.reprintCount})`,
    data: invoice
  })
})

// GET /api/invoices/:id/pdf — PDF generation
invoicesRouter.get('/:id/pdf', async (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const invoice = db.invoices.find(inv => inv.id === Number(idParam) || inv.invoiceNumber === idParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  try {
    const PDFDocument = (await import('pdfkit')).default
    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`)

    doc.pipe(res)

    // Header
    doc.fontSize(22).fillColor('#e65100').text('GoMeal Restaurant', { align: 'center' })
    doc.fontSize(10).fillColor('#666666').text('Official Tax Invoice & Receipt', { align: 'center' })
    doc.moveDown(1)

    // Meta box
    doc.fillColor('#333333').fontSize(11)
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 40, 110)
    doc.text(`Table: ${invoice.tableNumber}`, 40, 126)
    doc.text(`Payment: ${invoice.paymentMethod}`, 40, 142)

    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleString()}`, 340, 110)
    doc.text(`Status: ${invoice.status}`, 340, 126)
    doc.text(`Reprint: #${invoice.reprintCount}`, 340, 142)

    doc.moveDown(2)
    doc.strokeColor('#cccccc').moveTo(40, 165).lineTo(550, 165).stroke()

    // Table headers
    let y = 180
    doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
    doc.text('Item Description', 40, y)
    doc.text('Qty', 320, y, { width: 40, align: 'center' })
    doc.text('Price', 380, y, { width: 70, align: 'right' })
    doc.text('Total', 470, y, { width: 70, align: 'right' })

    doc.font('Helvetica').fontSize(9).fillColor('#444444')
    y += 20
    doc.strokeColor('#eeeeee').moveTo(40, y - 5).lineTo(550, y - 5).stroke()

    invoice.orders.forEach(order => {
      order.items.forEach(item => {
        doc.text(item.name, 40, y)
        doc.text(String(item.quantity), 320, y, { width: 40, align: 'center' })
        doc.text(`$${item.unitPrice.toFixed(2)}`, 380, y, { width: 70, align: 'right' })
        doc.text(`$${item.subtotal.toFixed(2)}`, 470, y, { width: 70, align: 'right' })
        y += 18
      })
    })

    doc.moveDown(1)
    doc.strokeColor('#cccccc').moveTo(300, y + 10).lineTo(550, y + 10).stroke()
    y += 20

    doc.fontSize(10).fillColor('#333333')
    doc.text('Subtotal:', 340, y)
    doc.text(`$${invoice.subtotal.toFixed(2)}`, 470, y, { width: 70, align: 'right' })
    y += 16

    if (invoice.discount > 0) {
      doc.text('Discount:', 340, y)
      doc.text(`-$${invoice.discount.toFixed(2)}`, 470, y, { width: 70, align: 'right' })
      y += 16
    }

    doc.text('VAT / Tax (10%):', 340, y)
    doc.text(`$${invoice.tax.toFixed(2)}`, 470, y, { width: 70, align: 'right' })
    y += 20

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#e65100')
    doc.text('Grand Total:', 340, y)
    doc.text(`$${invoice.total.toFixed(2)}`, 470, y, { width: 70, align: 'right' })
    y += 18
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
    doc.text(`KHR ${(invoice.total * 4100).toLocaleString()}`, 470, y, { width: 70, align: 'right' })

    doc.moveDown(3)
    doc.fontSize(9).fillColor('#888888').text('Thank you for dining with GoMeal Restaurant!', 40, y + 60, { align: 'center' })

    doc.end()
  } catch (err: any) {
    console.error('PDF generation error:', err)
    return res.status(500).json({
      message: 'Failed to generate invoice PDF',
      errors: ['PDF_GENERATION_FAILED']
    })
  }
})

// PATCH /api/invoices/:id/cancel — { reason } required, MANAGER only (record kept)
invoicesRouter.patch('/:id/cancel', requireRole(['MANAGER']), (req: AuthenticatedRequest, res: Response) => {
  const idParam = req.params.id
  const { reason } = req.body

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({
      message: 'reason is required to cancel an invoice',
      errors: ['CANCEL_REASON_REQUIRED']
    })
  }

  const invoice = db.invoices.find(inv => inv.id === Number(idParam) || inv.invoiceNumber === idParam)

  if (!invoice) {
    return res.status(404).json({
      message: 'Invoice not found',
      errors: ['INVOICE_NOT_FOUND']
    })
  }

  if (invoice.status === 'CANCELLED') {
    return res.status(400).json({
      message: 'Invoice is already cancelled',
      errors: ['ALREADY_CANCELLED']
    })
  }

  const now = new Date().toISOString()
  invoice.status = 'CANCELLED'
  invoice.cancelReason = String(reason).trim()
  invoice.cancelledAt = now

  return res.status(200).json({
    message: 'Invoice cancelled successfully. Record maintained for audit.',
    data: invoice
  })
})
