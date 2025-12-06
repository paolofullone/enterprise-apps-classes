export enum PlanChangeStatus {
  /** Plan change completed, waiting for invoice generation */
  PendingInvoice = 'PENDING_INVOICE',

  /** Invoice has been generated successfully */
  InvoiceGenerated = 'INVOICE_GENERATED',

  /** Invoice generation failed (will retry) */
  InvoiceFailed = 'INVOICE_FAILED',
}
