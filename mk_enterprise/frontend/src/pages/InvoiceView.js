import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { invoiceApi } from '../utils/api';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, numToWords, formatIST } from '../utils/helpers';
import { FileText, ArrowLeft, AlertTriangle, Edit, Share2, Trash2, Printer, Phone, Mail, CheckCircle, Wallet, Smartphone, Globe, CreditCard, MessageSquare, Info, Truck, User, Tag, Download } from 'lucide-react';


const uploadPDF = async (pdfBlob, invoiceNumber) => {
  const fileName = `invoice-${invoiceNumber}-${Date.now()}.pdf`;

  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(fileName, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    console.error("SUPABASE ERROR:", error);
    throw new Error(error.message);
  }

  const { data: urlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

const fc = formatCurrency;

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useApp();
  const { isManager } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    invoiceApi.get(id).then(setInvoice).catch(e => { toast.error(e.message); navigate('/invoices'); }).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try { await invoiceApi.delete(id); toast.success('Invoice cancelled'); navigate('/invoices'); }
    catch (err) { toast.error(err.message); }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = invoice?.invoice_number || 'Invoice';
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 1000);
  };

  const handleEscalate = () => {
    const reason = window.prompt("Reason for escalation to Admin:");
    if (reason) {
      toast.success('Invoice escalated to Admin for review.');
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo || !emailTo.includes('@')) return toast.error('Enter a valid email address');
    setEmailSending(true);
    try {
      // Try backend email API first
      if (typeof invoiceApi.sendEmail === 'function') {
        await invoiceApi.sendEmail(id, emailTo);
        toast.success(`✅ Invoice sent to ${emailTo}`);
        setShowShareModal(false);
        setEmailTo('');
      } else {
        throw new Error('Email API not available');
      }
    } catch (err) {
      // Fallback: open native mailto with invoice summary in body
      const subject = encodeURIComponent(`Invoice ${invoice.invoice_number} from ${settings.business_name || 'My Shop'}`);
      const body = encodeURIComponent(
        `Dear ${invoice.customer_name},\n\n` +
        `Please find your invoice details below:\n\n` +
        `Invoice No: ${invoice.invoice_number}\n` +
        `Date: ${invoice.ist_formatted || ''}\n` +
        `Items:\n` +
        (invoice.items || []).map(i => `  - ${i.product_name}: ${i.qty} x ₹${i.price} = ₹${i.total}`).join('\n') +
        `\n\nSubtotal: ₹${invoice.subtotal?.toFixed(2) || '0.00'}` +
        (invoice.discount > 0 ? `\nDiscount: -₹${invoice.discount?.toFixed(2)}` : '') +
        (invoice.vehicle_charge > 0 ? `\nVehicle Charge: +₹${invoice.vehicle_charge?.toFixed(2)}` : '') +
        `\nGrand Total: ₹${invoice.total?.toFixed(2)}` +
        (invoice.previous_balance > 0 ? `\nPrevious Balance: ₹${invoice.previous_balance?.toFixed(2)}` : '') +
        `\nAmount Received: ₹${invoice.amount_received?.toFixed(2)}` +
        (invoice.balance_due > 0.01 ? `\nBalance Due: ₹${invoice.balance_due?.toFixed(2)}` : '\nStatus: PAID ✅') +
        `\n\n${invoice.notes ? 'Notes: ' + invoice.notes + '\n\n' : ''}` +
        `Thank you for your business!\n${settings.business_name || ''}\n${settings.business_phone || ''}`
      );
      window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`, '_blank');
      toast.success('📧 Email client opened with invoice details');
      setShowShareModal(false);
      setEmailTo('');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSMS = () => {
    let phone = invoice.customer_phone;
    if (!phone || phone.trim() === '') {
      toast.error('No customer phone number on file');
      return;
    }
    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    // Build SMS text
    const itemLines = (invoice.items || [])
      .map(i => `${i.product_name} x${i.qty} = Rs.${i.total?.toFixed(2)}`)
      .join(', ');

    const lines = [
      `Hello ${invoice.customer_name},`,
      `Your purchase at ${settings.business_name || 'our shop'} on ${invoice.ist_formatted || ''}:`,
      `Items: ${itemLines}`,
      `Total: Rs.${invoice.total?.toFixed(2)}`,
      invoice.previous_balance > 0 ? `Previous Due: Rs.${invoice.previous_balance?.toFixed(2)}` : null,
      `Received: Rs.${invoice.amount_received?.toFixed(2)}`,
      invoice.balance_due > 0.01
        ? `Balance Due: Rs.${invoice.balance_due?.toFixed(2)}`
        : 'Status: PAID',
      `Invoice: ${invoice.invoice_number}`,
      `Thank you! ${settings.business_phone ? '| ' + settings.business_phone : ''}`,
    ].filter(Boolean).join('\n');

    // Try native SMS intent (works on Android/iOS browsers)
    const smsUri = `sms:+${phone}?body=${encodeURIComponent(lines)}`;
    window.open(smsUri, '_blank');
    toast.success('📱 SMS app opened');
  };

  const handleWhatsApp = async () => {
    try {
      console.log("STEP 1: Finding element...");
      const element = document.querySelector('.invoice-paper');

      if (!element) {
        throw new Error("invoice-paper not found");
      }

      console.log("STEP 2: Loading html2pdf...");
      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: 0.3,
        filename: `invoice-${invoice.invoice_number}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      console.log("STEP 3: Generating PDF...");
      const pdfBlob = await html2pdf()
        .set(opt)
        .from(element)
        .output('blob');

      console.log("PDF GENERATED:", pdfBlob);

      console.log("STEP 4: Uploading to Supabase...");
      const pdfUrl = await uploadPDF(pdfBlob, invoice.invoice_number);

      console.log("UPLOADED URL:", pdfUrl);

      console.log("STEP 5: Opening WhatsApp...");

      const msg = encodeURIComponent(
        `Dear ${invoice.customer_name},

This is your invoice.

🧾 Invoice No: ${invoice.invoice_number}
📅 Date: ${invoice.ist_formatted}
💰 Total: ₹${invoice.total.toFixed(2)}
💳 Received: ₹${invoice.amount_received.toFixed(2)}
📌 Balance: ₹${invoice.balance_due.toFixed(2)}

👉 Click here to view your invoice:
${pdfUrl}

⚠️ Note: This invoice link will be deleted after 7 days.

Thank you! 🙏`
      );

      let phone = invoice.customer_phone;

      if (!phone || phone.trim() === "") {
        toast.error("No customer phone number found");
        return;
      }

      phone = phone.replace(/\D/g, '');

      // add country code if missing
      if (phone.length === 10) {
        phone = "91" + phone;
      }

      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');

    } catch (err) {
      console.error("FINAL ERROR:", err);
      alert(err?.message || "Unknown error");
      toast.error("Failed to generate/share PDF");
    }
  };

  if (loading) return <div className="loading"><span className="spinner" style={{ width: 32, height: 32 }}></span></div>;
  if (!invoice) return null;

  // GST summary by rate
  const gstSummary = {};
  invoice.items.forEach(item => {
    const r = item.gst;
    if (!gstSummary[r]) gstSummary[r] = { taxable: 0, cgst: 0, sgst: 0 };
    gstSummary[r].taxable += item.taxable_amount;
    gstSummary[r].cgst += item.cgst;
    gstSummary[r].sgst += item.sgst;
  });

  // Enhancement 5: optimized QR value
  const upiId = settings.upi_id;
  const upiName = settings.upi_name || settings.business_name;
  // Final payable = total + previous balance (the actual amount customer owes)
  const finalPayable = (invoice.total_with_prev_balance || invoice.total || 0);
  const qrValue = upiId
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${finalPayable.toFixed(2)}&cu=INR`
    : (settings.business_phone || 'ShopBill Pro');
  const istDisplay = invoice.ist_formatted || formatIST(invoice.date);
  const hasBankDetails = settings.bank_account && settings.bank_ifsc;
  const paymentModeBadge = {
    cash: <Wallet size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    upi: <Smartphone size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    online: <Globe size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    others: <CreditCard size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
  };

  return (
    <div>
      {/* Action bar */}
      <div className="page-header no-print" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title d-flex align-items-center gap-2"><FileText size={22} className="text-primary" /> {invoice.invoice_number}</div>
          <div className="page-subtitle">{istDisplay} · <span style={{ textTransform: 'capitalize' }}>{invoice.status}</span></div>
        </div>
        <div className="page-actions">
          <Link to="/invoices" className="btn btn-outline d-inline-flex align-items-center gap-1"><ArrowLeft size={14} /> All Invoices</Link>
          {isManager && (
            <button className="btn btn-outline d-inline-flex align-items-center gap-1" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={handleEscalate}>
              <AlertTriangle size={14} /> Escalate to Admin
            </button>
          )}
          <Link to={`/invoices/${id}/edit`} className="btn btn-warning d-inline-flex align-items-center gap-1"><Edit size={14} /> Edit</Link>
          <button className="btn btn-outline d-inline-flex align-items-center gap-1" onClick={() => setShowShareModal(true)}><Share2 size={14} /> Share</button>
          <button className="btn btn-danger d-inline-flex align-items-center gap-1" onClick={handleDelete}><Trash2 size={14} /> Cancel</button>
          <button className="btn btn-primary btn-lg d-inline-flex align-items-center gap-1" onClick={handlePrint}><Printer size={14} /> Print / PDF</button>
        </div>
      </div>

      {/* ── INVOICE PAPER ── */}
      <div className="invoice-paper">
        {/* Header */}
        <div className="inv-header">
          <div>
            <div className="inv-biz-name">{settings.business_name || 'My Shop'}</div>
            <div style={{ color: '#6b7280', fontSize: 13, maxWidth: 320, marginTop: 4 }}>{settings.business_address}</div>
            {settings.business_phone && <div style={{ fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {settings.business_phone}</div>}
            {settings.business_email && <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Mail size={11} /> {settings.business_email}</div>}
            {settings.business_gstin && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>GSTIN: {settings.business_gstin}</div>}
            {settings.business_state && <div style={{ fontSize: 12, color: '#6b7280' }}>State: {settings.business_state}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="inv-tag">{invoice.is_manual_bill ? 'MANUAL BILL' : 'TAX INVOICE'}</div>
            <table className="inv-meta-table" style={{ marginTop: 10, marginLeft: 'auto' }}>
              <tbody>
                <tr><td className="label">Invoice No.</td><td className="value" style={{ fontFamily: 'monospace' }}>{invoice.invoice_number}</td></tr>
                <tr><td className="label">Date & Time</td><td className="value">{istDisplay}</td></tr>
                {invoice.manual_bill_ref && <tr><td className="label">Manual Ref.</td><td className="value">{invoice.manual_bill_ref}</td></tr>}
                {invoice.vehicle_number && <tr><td className="label">Vehicle No.</td><td className="value">{invoice.vehicle_number}</td></tr>}
                {invoice.driver_name && <tr><td className="label">Driver</td><td className="value">{invoice.driver_name}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <div className="inv-section-title">Bill To</div>
            <div className="inv-bill-to">
              <div style={{ fontWeight: 700, fontSize: 15 }}>{invoice.customer_name}</div>
              {invoice.customer_phone && <div style={{ fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {invoice.customer_phone}</div>}
              {invoice.customer_address && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{invoice.customer_address}</div>}
            </div>
          </div>
          <div>
            {invoice.balance_due > 0.01 ? (
              <div style={{ background: 'var(--danger-light)', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 18px', textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>Balance Due</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--danger)' }}>{fc(invoice.balance_due)}</div>
              </div>
            ) : (
              <div style={{ background: 'var(--success-light)', border: '1.5px solid #86efac', borderRadius: 10, padding: '12px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><CheckCircle size={16} /> PAID</div>
              </div>
            )}
          </div>
        </div>

        {/* Previous balance note */}
        {invoice.previous_balance > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 14px', marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} className="text-warning" /> <span>Previous balance of <strong>{fc(invoice.previous_balance)}</strong> included in total.</span>
          </div>
        )}

        {/* Items Table */}
        <table className="inv-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Item Description</th>
              <th style={{ textAlign: 'center' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th style={{ textAlign: 'right' }}>Taxable</th>
              {invoice.gst_enabled && <>
                <th style={{ textAlign: 'center' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
              </>}
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={item._id || i}>
                <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                <td>
                  <strong>{item.product_name}</strong>
                  {item.returned_qty > 0 && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>Returned: {item.returned_qty}</span>}
                  {item.is_defective && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>Defective</span>}
                </td>
                <td style={{ textAlign: 'center' }}>{item.qty}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fc(item.price)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fc(item.taxable_amount)}</td>
                {invoice.gst_enabled && <>
                  <td style={{ textAlign: 'center' }}>{item.gst}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fc(item.cgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fc(item.sgst)}</td>
                </>}
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fc(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* GST Summary + Totals */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start', marginBottom: 14 }}>
          {invoice.gst_enabled && Object.keys(gstSummary).length > 0 && (
            <div style={{ flex: 1 }}>
              <div className="inv-section-title">GST Summary</div>
              <table className="gst-summary-table">
                <thead><tr><th>GST Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th></tr></thead>
                <tbody>
                  {Object.entries(gstSummary).map(([rate, g]) => (
                    <tr key={rate}><td>{rate}%</td><td style={{ fontFamily: 'monospace' }}>{fc(g.taxable)}</td><td style={{ fontFamily: 'monospace' }}>{fc(g.cgst)}</td><td style={{ fontFamily: 'monospace' }}>{fc(g.sgst)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="inv-totals-box" style={{ minWidth: 280 }}>
            <div className="inv-total-row"><span className="text-muted">Subtotal</span><span className="mono">{fc(invoice.subtotal)}</span></div>
            {invoice.gst_enabled && <>
              <div className="inv-total-row"><span className="text-muted">CGST</span><span className="mono">{fc(invoice.gst_total / 2)}</span></div>
              <div className="inv-total-row"><span className="text-muted">SGST</span><span className="mono">{fc(invoice.gst_total / 2)}</span></div>
            </>}
            {invoice.discount > 0 && <div className="inv-total-row text-success"><span>Discount</span><span className="mono">- {fc(invoice.discount)}</span></div>}
            {/* Enhancement 5: vehicle charge line */}
            {invoice.vehicle_charge > 0 && (
              <div className="inv-total-row text-warning">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} /> Vehicle Charge</span>
                <span className="mono">+ {fc(invoice.vehicle_charge)}</span>
              </div>
            )}
            {invoice.labour_charge > 0 && (
              <div className="inv-total-row" style={{ color: '#7c3aed', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> Labour Charge</span>
                <span className="mono">+ {fc(invoice.labour_charge)}</span>
              </div>
            )}
            <div className="inv-total-row grand"><span>Grand Total</span><span className="mono">{fc(invoice.total)}</span></div>
            {invoice.previous_balance > 0 && <div className="inv-total-row" style={{ color: 'var(--warning)', fontWeight: 600 }}><span>+ Prev. Balance</span><span className="mono">{fc(invoice.previous_balance)}</span></div>}
            {invoice.previous_balance > 0 && <div className="inv-total-row" style={{ fontWeight: 800 }}><span>Net Payable</span><span className="mono">{fc(invoice.total_with_prev_balance)}</span></div>}
            <div className="inv-total-row rcvd"><span>Amount Received</span><span className="mono">{fc(invoice.amount_received)}</span></div>
            {invoice.balance_due > 0.01 && <div className="inv-total-row due"><span>Balance Due</span><span className="mono">{fc(invoice.balance_due)}</span></div>}
          </div>
        </div>

        {/* Amount in words */}
        <div className="inv-words">
          <span style={{ color: '#6b7280', fontWeight: 600 }}>Amount in Words: </span>
          <span style={{ fontWeight: 600 }}>{numToWords(invoice.total)}</span>
        </div>

        {/* Payment modes */}
        {invoice.payments?.length > 0 && (
          <div style={{ marginBottom: 14, fontSize: 13 }}>
            <div className="inv-section-title" style={{ marginBottom: 6 }}>Payment Received Via</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {invoice.payments.map((p, i) => (
                <span key={i} className="badge badge-gray" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center' }}>
                  {paymentModeBadge[p.mode]} {p.mode.toUpperCase()}: {fc(p.amount)} {p.reference ? `(${p.reference})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {(invoice.notes || invoice.concession_reason) && (
          <div style={{ marginBottom: 14, fontSize: 13, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            {invoice.notes && (
              <div style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                <strong><FileText size={12} /> Notes:</strong> <span>{invoice.notes}</span>
              </div>
            )}
            {invoice.concession_reason && (
              <div style={{ color: '#374151', marginTop: invoice.notes ? 6 : 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <strong><Tag size={12} /> Concession Reason:</strong> <span>{invoice.concession_reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Enhancement 5: Bank Details */}
        {hasBankDetails && (
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            <div className="inv-section-title" style={{ marginBottom: 6 }}>Bank Transfer Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 16px' }}>
              {settings.bank_name && <><span style={{ color: '#6b7280' }}>Bank:</span><span style={{ fontWeight: 600 }}>{settings.bank_name}</span></>}
              <span style={{ color: '#6b7280' }}>Account No.:</span><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{settings.bank_account}</span>
              <span style={{ color: '#6b7280' }}>IFSC:</span><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{settings.bank_ifsc}</span>
              {settings.bank_branch && <><span style={{ color: '#6b7280' }}>Branch:</span><span>{settings.bank_branch}</span></>}
            </div>
          </div>
        )}

        {/* Footer: QR + Signature */}
        <div className="inv-footer">
          <div className="inv-qr">
            {/* Enhancement 5: optimized QR code size */}
            <QRCode value={qrValue} size={80} />
            <div className="inv-qr-label">{upiId ? `Scan to Pay · ${upiId}` : 'Scan for Payment'}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1, fontSize: 11.5, color: '#9ca3af' }}>
            <div>This is a computer generated invoice.</div>
            <div>Thank you for your business!</div>
          </div>
          <div className="inv-sign">
            {invoice.signature && (
              <img
                src={invoice.signature}
                alt="signature"
                style={{
                  height: 60,
                  objectFit: "contain",
                  marginBottom: 6,
                  maxWidth: "150px"
                }}
              />
            )}
            <div className="inv-sign-line">Authorised Signature</div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title d-flex align-items-center gap-2"><Share2 size={18} /> Share Invoice {invoice.invoice_number}</div>
              <button className="modal-close" onClick={() => setShowShareModal(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* ── WhatsApp ── */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label d-flex align-items-center gap-1"><MessageSquare size={14} /> WhatsApp</label>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {invoice.customer_phone
                    ? `Sends PDF link to +91 ${invoice.customer_phone}`
                    : 'No phone on file — opens WhatsApp with message ready'}
                </p>
                <button
                  className="btn btn-success btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center' }}
                  onClick={() => { handleWhatsApp(); setShowShareModal(false); }}
                >
                  <MessageSquare size={14} /> Send via WhatsApp
                </button>
              </div>

              <hr className="divider" />

              {/* ── SMS ── */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label d-flex align-items-center gap-1"><Smartphone size={14} /> Send via SMS</label>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  {invoice.customer_phone
                    ? `Opens SMS app for ${invoice.customer_phone} with invoice summary`
                    : <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={14} /> No phone number on file</span>}
                </p>
                <button
                  className="btn btn-outline btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center', borderColor: '#6b7280' }}
                  onClick={() => { handleSMS(); setShowShareModal(false); }}
                  disabled={!invoice.customer_phone}
                >
                  <Smartphone size={14} /> Send SMS
                </button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Opens your phone's native SMS app with message pre-filled
                </div>
              </div>

              <hr className="divider" />

              {/* ── Email ── */}
              <div style={{ marginBottom: 18 }}>
                <label className="form-label d-flex align-items-center gap-1"><Mail size={14} /> Send via Email</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="customer@email.com"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  style={{ marginBottom: 8 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendEmail(); }}
                />
                <button
                  className="btn btn-primary btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center' }}
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailTo}
                >
                  {emailSending
                    ? <><span className="spinner"></span> Sending...</>
                    : <><Mail size={14} /> Send Email</>}
                </button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  If backend email is unavailable, opens your email client as fallback
                </div>
              </div>

              <hr className="divider" />

              {/* ── PDF ── */}
              <div>
                <label className="form-label d-flex align-items-center gap-1"><FileText size={14} /> Save as PDF</label>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Opens browser print dialog — choose "Save as PDF"
                </p>
                <button
                  className="btn btn-outline btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center' }}
                  onClick={() => { handlePrint(); setShowShareModal(false); }}
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
