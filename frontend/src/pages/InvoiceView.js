import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { invoiceApi, managerApi, driverApi, notificationApi, tripApi } from '../utils/api';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, numToWords, formatIST } from '../utils/helpers';
import { FileText, ArrowLeft, AlertTriangle, Edit, Share2, Trash2, Printer, Phone, Mail, CheckCircle, Wallet, Smartphone, Globe, CreditCard, MessageSquare, Info, Truck, User, Tag, Download, Send, X } from 'lucide-react';
import { parseCustomerName, formatCustomerName, isHindi, titleCase, getPrefixOptions, applyAutoSuffix, FormattedName } from '../utils/nameFormatter';


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
  const { t, settings: appSettings } = useApp();
  const lang = appSettings?.language === 'hi';
  const { isManager, user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [staffData, setStaffData] = useState({ managers: [], drivers: [], activeTrips: [] });
  const [fetchingStaff, setFetchingStaff] = useState(false);
  const [sendingDispatch, setSendingDispatch] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [scale, setScale] = useState(1);
  const [zoomIn, setZoomIn] = useState(false);
  const [driverWarningModal, setDriverWarningModal] = useState(null);
  const containerRef = useRef(null);
  
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editNameForm, setEditNameForm] = useState({ prefix: 'Shree', name: '', phone: '', address: '' });
  const [savingName, setSavingName] = useState(false);
  const editNameRef = useRef(null);

  useEffect(() => {
    if (invoice && invoice.customer_name === 'Walk-in Customer') {
      setShowEditNameModal(true);
      setEditNameForm({ prefix: 'Shree', name: '', phone: '', address: '' });
    }
  }, [invoice]);

  const handleEditNameBlur = () => {
    // setEditNameForm(prev => ({ ...prev, name: applyAutoSuffix(prev.name) }));
  };

  const handleSaveName = async (e) => {
    if (e) e.preventDefault();
    if (!editNameForm.name.trim()) return toast.error('Name is required');
    setSavingName(true);
    try {
      const payload = { 
        customer_name: editNameForm.name.trim(),
        customer_phone: editNameForm.phone.trim(),
        customer_address: editNameForm.address.trim()
      };
      await invoiceApi.update(invoice._id, payload);
      setInvoice({ ...invoice, 
        customer_name: editNameForm.name.trim(),
        customer_phone: editNameForm.phone.trim(),
        customer_address: editNameForm.address.trim()
      });
      setShowEditNameModal(false);
      toast.success('Customer details updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingName(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (containerRef.current) {
        const parentWidth = containerRef.current.offsetWidth;
        if (!zoomIn && parentWidth > 0 && parentWidth < 860) {
          setScale(parentWidth / 860);
        } else {
          setScale(1);
        }
      }
    };
    handleResize();
    const timer = setTimeout(handleResize, 150);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [invoice, zoomIn]);

  useEffect(() => {
    invoiceApi.get(id).then(setInvoice).catch(e => { toast.error(e.message); navigate('/invoices'); }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (showSendModal) {
      setFetchingStaff(true);
      Promise.all([
        managerApi.getAll().catch(() => ({ managers: [] })),
        driverApi.getAll().catch(() => ({ drivers: [] })),
        tripApi.getAll({ status: 'active' }).catch(() => ({ trips: [] }))
      ]).then(([mgrRes, drvRes, tripRes]) => {
        setStaffData({ 
          managers: mgrRes.managers || [], 
          drivers: drvRes.drivers || [],
          activeTrips: tripRes.trips || []
        });
        setFetchingStaff(false);
      });
    }
  }, [showSendModal]);

  const handleDelete = async () => {
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try { await invoiceApi.delete(id); toast.success('Invoice cancelled'); navigate('/invoices'); }
    catch (err) { toast.error(err.message); }
  };

  const overallBalanceDue = invoice ? ((invoice.total_with_prev_balance || invoice.total) - invoice.amount_received) : 0;

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = invoice?.invoice_number || 'Invoice';
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 1000);
  };

  const handleEscalate = () => {
    setShowEscalateModal(true);
  };

  const submitEscalate = async () => {
    if (!escalateReason.trim()) return toast.error('Please enter a reason');
    setEscalating(true);
    try {
      await notificationApi.create({
        recipient_role: 'supervisor',
        type: 'invoice_approval',
        title: `⚠️ Escalation — ${invoice.invoice_number}`,
        message: escalateReason,
        priority: 'high',
        entity_type: 'invoice',
        entity_id: invoice._id,
      });
      toast.success('Invoice escalated to Admin for review.');
      setShowEscalateModal(false);
      setEscalateReason('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEscalating(false);
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
      const settings = invoice.company_details || appSettings;
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
        (invoice.amount_received > 0 ? `\nAmount Received: ₹${invoice.amount_received?.toFixed(2)}` : '') +
        (overallBalanceDue > 0.01 ? `\nBalance Due: ₹${overallBalanceDue.toFixed(2)}` : '\nStatus: PAID ✅') +
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

  const handleSendDispatch = async () => {
    if (selectedStaff.length === 0) return toast.error('Select at least one staff member');
    setSendingDispatch(true);
    try {
      const itemSummary = invoice.items.map(i => `${i.product_name} x${i.qty}`).join(', ');
      const message = `Items: ${itemSummary}. Collect ₹${overallBalanceDue > 0 ? overallBalanceDue : invoice.total} from ${invoice.customer_name}.${invoice.customer_address ? ' Destination: ' + invoice.customer_address : ''} Total Weight: ${invoice.total_weight || 0} kg.`;

      // Update shared_with array on backend
      await invoiceApi.share(invoice._id, selectedStaff);

      for (const staffId of selectedStaff) {
        const isManager = staffData.managers.some(m => m._id === staffId);
        const role = isManager ? 'manager' : 'driver';

        const notifType = isManager ? 'invoice_shared' : 'driver_dispatch';
        const notifTitle = isManager ? `📄 Invoice Shared — ${invoice.invoice_number}` : `📦 Delivery Dispatch — ${invoice.invoice_number}`;
        const notifMessage = isManager 
          ? `Invoice ${invoice.invoice_number} for ${invoice.customer_name} has been shared with you.` 
          : message;

        await notificationApi.create({
          recipient_id: staffId,
          recipient_role: role,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          priority: 'high',
          entity_type: 'invoice',
          entity_id: invoice._id,
          metadata: { 
            invoice_id: invoice._id, 
            total_weight: invoice.total_weight || 0,
            customer_phone: invoice.customer_phone || '',
            customer_name: invoice.customer_name || '',
            destination: invoice.customer_address || '',
            items: invoice.items.map(item => ({
              goods_type: `${item.product_name} x${item.qty}`,
              weight: item.weight ? parseFloat(item.weight) : 0
            }))
          }
        });

        // If assigning to a driver, also notify the Admins/Supervisors about who assigned it
        if (role === 'driver') {
          const staffName = staffData.drivers.find(d => d._id === staffId)?.display_name || 'Driver';
          await notificationApi.create({
            recipient_id: null,
            recipient_role: 'supervisor',
            type: 'dispatch_assigned',
            title: `📋 Dispatch Assigned`,
            message: `${user?.display_name || user?.username} assigned Invoice ${invoice.invoice_number} to ${staffName}`,
            priority: 'medium',
            entity_type: 'invoice',
            entity_id: invoice._id,
          });
        }
      }
      toast.success('Dispatch notification(s) sent!');
      setShowSendModal(false);
      setSelectedStaff([]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingDispatch(false);
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
    const settings = invoice.company_details || appSettings;
    const itemLines = (invoice.items || [])
      .map(i => `${i.product_name} x${i.qty} = Rs.${i.total?.toFixed(2)}`)
      .join(', ');

    const lines = lang ? [
      `नमस्कार ${invoice.customer_name},`,
      `${settings.business_name || 'हमारी दुकान'} से आपकी खरीद ${invoice.ist_formatted || ''}:`,
      `सामान: ${itemLines}`,
      `कुल: ₹${invoice.total?.toFixed(2)}`,
      invoice.previous_balance > 0 ? `पिछला बकाया: ₹${invoice.previous_balance?.toFixed(2)}` : null,
      `प्राप्त: ₹${invoice.amount_received?.toFixed(2)}`,
      overallBalanceDue > 0.01
        ? `बकाया: ₹${overallBalanceDue.toFixed(2)}`
        : 'स्थिति: भुगतान पूर्ण',
      `बिल नं: ${invoice.invoice_number}`,
      `धन्यवाद! ${settings.business_phone ? '| ' + settings.business_phone : ''}`,
    ] : [
      `Hello ${invoice.customer_name},`,
      `Your purchase at ${settings.business_name || 'our shop'} on ${invoice.ist_formatted || ''}:`,
      `Items: ${itemLines}`,
      `Total: Rs.${invoice.total?.toFixed(2)}`,
      invoice.previous_balance > 0 ? `Previous Due: Rs.${invoice.previous_balance?.toFixed(2)}` : null,
      `Received: Rs.${invoice.amount_received?.toFixed(2)}`,
      overallBalanceDue > 0.01
        ? `Balance Due: Rs.${overallBalanceDue.toFixed(2)}`
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
        html2canvas: { 
          scale: 2,
          useCORS: true,
          width: 860,
          windowWidth: 860
        },
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
        lang ? 
        `नमस्कार ${invoice.customer_name},

यह आपका बिल है।

🧾 बिल नं: ${invoice.invoice_number}
📅 दिनांक: ${invoice.ist_formatted}
💰 कुल: ₹${invoice.total.toFixed(2)}
💳 प्राप्त: ₹${invoice.amount_received.toFixed(2)}
${overallBalanceDue > 0.01 ? `📌 बकाया: ₹${overallBalanceDue.toFixed(2)}\n` : ''}

👉 अपना बिल देखने के लिए यहाँ क्लिक करें:
${pdfUrl}

⚠️ नोट: यह बिल लिंक 7 दिन बाद हटा दिया जाएगा।

धन्यवाद! 🙏` 
        : 
        `Dear ${invoice.customer_name},

This is your invoice.

🧾 Invoice No: ${invoice.invoice_number}
📅 Date: ${invoice.ist_formatted}
💰 Total: ₹${invoice.total.toFixed(2)}
💳 Received: ₹${invoice.amount_received.toFixed(2)}
${overallBalanceDue > 0.01 ? `📌 Balance: ₹${overallBalanceDue.toFixed(2)}\n` : ''}

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
      toast.error(err?.message || "Unknown error");
      toast.error("Failed to generate/share PDF");
    }
  };

  if (loading) return <div className="loading"><span className="spinner" style={{ width: 32, height: 32 }}></span></div>;
  if (!invoice) return null;

  const settings = invoice.company_details || appSettings;

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
  const balanceDue = (invoice.total_with_prev_balance || invoice.total || 0) - (invoice.amount_received || 0);
  const finalPayable = balanceDue > 0 ? balanceDue : (invoice.total_with_prev_balance || invoice.total || 0);
  const qrAmount = invoice.qr_for_current_bill ? (invoice.total || 0) : finalPayable;
  const qrValue = upiId 
    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${qrAmount.toFixed(2)}&cu=INR`
    : (settings.business_phone || 'ShopBill Pro');
  const istDisplay = invoice.ist_formatted || formatIST(invoice.date);
  const hasBankDetails = settings.bank_account && settings.bank_ifsc;
  const paymentModeBadge = {
    cash: <Wallet size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    upi: <Smartphone size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    online: <Globe size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />,
    others: <CreditCard size={12} style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }} />
  };

  let paymentStatusText = 'Paid';
  let paymentStatusColor = 'var(--success)';
  let paymentStatusBackground = 'var(--success-light)';
  let paymentStatusBorder = '1px solid #86efac';

  if (invoice.status === 'cancelled') {
    paymentStatusText = 'Cancelled';
    paymentStatusColor = '#6b7280';
    paymentStatusBackground = 'var(--border)';
    paymentStatusBorder = '1px solid #e5e7eb';
  } else if (overallBalanceDue > 0.01) {
    if (invoice.amount_received > 0.01) {
      paymentStatusText = 'Pending';
      paymentStatusColor = '#d97706';
      paymentStatusBackground = 'var(--warning-light)';
      paymentStatusBorder = '1px solid #fde68a';
    } else {
      paymentStatusText = 'Due';
      paymentStatusColor = 'var(--danger)';
      paymentStatusBackground = 'var(--danger-light)';
      paymentStatusBorder = '1px solid #fca5a5';
    }
  }

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm !important;
          }
          body {
            width: 860px !important;
            min-width: 860px !important;
            font-size: 11.5px !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .app-main, .app-content {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }
          .invoice-paper {
            width: 860px !important;
            max-width: 860px !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            background: #fff !important;
          }
          .inv-header {
            margin-bottom: 12px !important;
            padding-bottom: 12px !important;
          }
          .inv-bill-to {
            padding: 8px 12px !important;
          }
          .inv-total-row {
            padding: 3px 0 !important;
          }
          .inv-words {
            margin: 8px 0 !important;
            padding: 6px 12px !important;
          }
          .no-print, .hamburger-btn, .mobile-topbar, .sidebar {
            display: none !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          .inv-table-wrapper {
            overflow: visible !important;
            width: 100% !important;
          }
          .inv-table {
            width: 100% !important;
            min-width: 100% !important;
          }
          .inv-totals-box {
            min-width: 280px !important;
            width: 280px !important;
            margin-left: auto !important;
          }
          .inv-total-row.grand {
            font-size: 16px !important;
            padding-top: 6px !important;
          }
          .inv-total-row {
            font-size: 12px !important;
            padding: 3px 0 !important;
          }
          .inv-table td {
            padding: 5px 8px !important;
            font-size: 11px !important;
          }
          .inv-table th {
            padding: 5px 8px !important;
            font-size: 9.5px !important;
          }
          .gst-summary-table td, .gst-summary-table th {
            padding: 3px 5px !important;
            font-size: 9.5px !important;
          }
        }
      `}</style>
      {/* Action bar */}
      <div className="page-header no-print" style={{ marginBottom: 20 }}>
        <div>
          <div className="page-title d-flex align-items-center gap-2"><FileText size={22} className="text-primary" /> {invoice.invoice_number}</div>
          <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {istDisplay} · 
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: paymentStatusColor,
              background: paymentStatusBackground,
              border: paymentStatusBorder,
              padding: '2px 8px',
              borderRadius: 6,
              textTransform: 'uppercase'
            }}>{paymentStatusText}</span>
          </div>
        </div>
        <div className="page-actions">
          <Link to="/invoices" className="btn btn-outline d-inline-flex align-items-center gap-1"><ArrowLeft size={14} /> All Invoices</Link>
          <Link to={`/invoices/${id}/edit`} className="btn btn-warning d-inline-flex align-items-center gap-1"><Edit size={14} />{t('Edit', 'संपादित करें')}</Link>
          {user?.role !== 'walkin_manager' && (
            <button className="btn btn-primary btn-lg d-inline-flex align-items-center gap-1" onClick={handlePrint}><Printer size={14} /> Print / PDF</button>
          )}
          {user?.role !== 'temp_manager' && user?.role !== 'walkin_manager' && (
            <>
              <button className="btn btn-outline d-inline-flex align-items-center gap-1" onClick={() => setShowSendModal(true)} style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                <Send size={14} /> Send Invoice
              </button>
              <button className="btn btn-outline d-inline-flex align-items-center gap-1" onClick={() => setShowShareModal(true)}><Share2 size={14} /> Share</button>
            </>
          )}
          {(isManager || user?.role === 'temp_manager' || user?.role === 'walkin_manager') && (
            <button className="btn btn-outline d-inline-flex align-items-center gap-1" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={handleEscalate}>
              <AlertTriangle size={14} /> Escalate to Admin
            </button>
          )}
          {user?.role !== 'walkin_manager' && (
            <button className="btn btn-danger d-inline-flex align-items-center gap-1" onClick={handleDelete}><Trash2 size={14} />{t('Cancel', 'रद्द करें')}</button>
          )}
        </div>
      </div>

      {/* Helper banner for tap-to-zoom on mobile */}
      {isMobile && (
        <div className="no-print" style={{ 
          textAlign: 'center', 
          marginBottom: 12, 
          fontSize: 12, 
          color: 'var(--text-muted)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: 6,
          background: 'var(--bg-light)',
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <Info size={14} className="text-primary" />
          <span>Tap the invoice sheet to <strong>{zoomIn ? 'Fit to Screen' : 'Zoom In & read text'}</strong></span>
        </div>
      )}

      {/* ── INVOICE PAPER ── */}
      <div className="invoice-view-wrapper" ref={containerRef} style={{ width: '100%', overflowX: zoomIn ? 'auto' : 'hidden' }}>
        <div 
          className="invoice-paper" 
          onClick={() => setZoomIn(!zoomIn)}
          style={{ zoom: scale, cursor: zoomIn ? 'zoom-out' : 'zoom-in', transition: 'zoom 0.15s ease-in-out' }}
        >
        {/* Header */}
        <div className="inv-header">
          <div>
            <div className="inv-biz-name">{settings.business_name || 'My Shop'}</div>
            <div style={{ color: '#6b7280', fontSize: 11.5, maxWidth: 320, marginTop: 4 }}>{settings.business_address}</div>
            {settings.business_phone && <div style={{ fontSize: 11.5, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {settings.business_phone}</div>}
            {settings.business_email && <div style={{ fontSize: 11.5, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><Mail size={11} /> {settings.business_email}</div>}
            {settings.business_gstin && <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2 }}>GSTIN: {settings.business_gstin}</div>}
            {settings.business_state && <div style={{ fontSize: 11.5, color: '#6b7280' }}>State: {settings.business_state}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="inv-tag">{invoice.is_manual_bill ? 'MANUAL BILL' : 'INVOICE'}</div>
            <table className="inv-meta-table" style={{ marginTop: 10, marginLeft: 'auto' }}>
              <tbody>
                <tr><td className="label">Invoice No.</td><td className="value" style={{ fontFamily: 'monospace' }}>{invoice.invoice_number}</td></tr>
                <tr><td className="label">Date & Time</td><td className="value">{istDisplay}</td></tr>
                {invoice.manual_bill_ref && <tr><td className="label">Manual Ref.</td><td className="value">{invoice.manual_bill_ref}</td></tr>}
                {invoice.vehicle_number && <tr><td className="label">Vehicle No.</td><td className="value">{(invoice.vehicle_number || '').toUpperCase()}</td></tr>}
                {invoice.driver_name && <tr><td className="label">Driver</td><td className="value">{invoice.driver_name}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          gap: 12, 
          marginBottom: 18,
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <div className="inv-section-title">{t('BILL TO', 'बिल प्राप्तकर्ता')}</div>
            <div className="inv-bill-to">
              <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                {invoice.customer_name !== 'Walk-in Customer' ? <FormattedName fullName={invoice.customer_name} /> : invoice.customer_name}
                {invoice.customer_name === 'Walk-in Customer' && (
                  <button 
                    onClick={() => setShowEditNameModal(true)}
                    className="no-print"
                    style={{ background: 'var(--danger-light)', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, outline: 'none' }}
                  >
                    <Edit size={10} /> Edit Name Required
                  </button>
                )}
              </div>
              {invoice.customer_phone && <div style={{ fontSize: 13, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {invoice.customer_phone}</div>}
              {invoice.customer_address && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{invoice.customer_address}</div>}
            </div>
          </div>
          <div style={{ width: 'auto', flexShrink: 0 }}>
            {overallBalanceDue > 0.01 ? (
              <div style={{ 
                background: 'var(--danger-light)', 
                border: '1.5px solid #fca5a5', 
                borderRadius: 10, 
                padding: '12px 18px', 
                textAlign: 'right' 
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase' }}>{t('Balance Due', 'शेष बकाया')}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--danger)' }}>{fc(overallBalanceDue)}</div>
              </div>
            ) : (
              <div style={{ 
                background: 'var(--success-light)', 
                border: '1.5px solid #86efac', 
                borderRadius: 10, 
                padding: '12px 18px', 
                textAlign: 'center' 
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><CheckCircle size={16} /> PAID</div>
              </div>
            )}
          </div>
        </div>



        {/* Items Table */}
        <div className="inv-table-wrapper" style={{ width: '100%', marginBottom: 16 }}>
          <table className="inv-table" style={{ marginBottom: 0, tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: invoice.gst_enabled ? '3%' : '4%' }}>#</th>
                <th style={{ width: invoice.gst_enabled ? '40%' : '40%', textAlign: 'left' }}>{t('Item Description', 'आइटम विवरण')}</th>
                <th style={{ width: invoice.gst_enabled ? '5%' : '8%', textAlign: 'center' }}>{t('Qty', 'मात्रा')}</th>
                <th style={{ width: invoice.gst_enabled ? '8%' : '16%', textAlign: 'right' }}>{t('Rate', 'दर')}</th>
                <th style={{ width: invoice.gst_enabled ? '8%' : '16%', textAlign: 'right' }}>{t('Taxable', 'कर योग्य')}</th>
                {invoice.gst_enabled && <>
                  <th style={{ width: '5%', textAlign: 'center' }}>{t('GST %', 'जीएसटी %')}</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>{t('CGST', 'सीजीएसटी')}</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>{t('SGST', 'एसजीएसटी')}</th>
                </>}
                <th style={{ width: invoice.gst_enabled ? '15%' : '16%', textAlign: 'right' }}>{t('Total', 'कुल')}</th>
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
                  <td style={{ textAlign: 'center' }}>{item.qty} {item.unit || 'bag'}</td>
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
        </div>

        {/* GST Summary + Totals */}
        <div className="gst-totals-container" style={{ display: 'flex', flexDirection: 'row', justifyContent: invoice.gst_enabled && Object.keys(gstSummary).length > 0 ? 'space-between' : 'flex-end', gap: 24, alignItems: 'flex-start', marginBottom: 14, width: '100%' }}>
          {invoice.gst_enabled && Object.keys(gstSummary).length > 0 && (
            <div style={{ width: '55%' }}>
              <div className="inv-section-title">{t('GST Summary', 'जीएसटी सारांश')}</div>
              <div className="inv-table-wrapper" style={{ width: '100%' }}>
                <table className="gst-summary-table" style={{ width: '100%', tableLayout: 'fixed' }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>{t('GST Rate', 'जीएसटी दर')}</th><th style={{ textAlign: 'right' }}>{t('Taxable', 'कर योग्य')}</th><th style={{ textAlign: 'right' }}>{t('CGST', 'सीजीएसटी')}</th><th style={{ textAlign: 'right' }}>{t('SGST', 'एसजीएसटी')}</th></tr></thead>
                  <tbody>
                    {Object.entries(gstSummary).map(([rate, g]) => (
                      <tr key={rate}><td>{rate}%</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fc(g.taxable)}</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fc(g.cgst)}</td><td style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fc(g.sgst)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="inv-totals-box" style={{ width: invoice.gst_enabled && Object.keys(gstSummary).length > 0 ? '40%' : '100%', minWidth: 280, marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', maxWidth: 320 }}>

              <div className="inv-total-row"><span className="text-muted">{t('Subtotal', 'उप-कुल')}</span><span className="mono">{fc(invoice.subtotal)}</span></div>
            {invoice.gst_enabled && <>
              <div className="inv-total-row"><span className="text-muted">{t('CGST', 'सीजीएसटी')}</span><span className="mono">{fc(invoice.gst_total / 2)}</span></div>
              <div className="inv-total-row"><span className="text-muted">{t('SGST', 'एसजीएसटी')}</span><span className="mono">{fc(invoice.gst_total / 2)}</span></div>
            </>}
            {invoice.discount > 0 && <div className="inv-total-row text-success"><span>{t('Discount', 'छूट')}</span><span className="mono">- {fc(invoice.discount)}</span></div>}
            {/* Enhancement 5: vehicle charge line */}
            {invoice.vehicle_charge > 0 && (
              <div className="inv-total-row text-warning">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} /> {t('Vehicle Charge', 'वाहन शुल्क')}</span>
                <span className="mono">+ {fc(invoice.vehicle_charge)}</span>
              </div>
            )}
            {invoice.labour_charge > 0 && (
              <div className="inv-total-row text-warning">
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> {t('Labour Charge', 'श्रम शुल्क')}</span>
                <span className="mono">+ {fc(invoice.labour_charge)}</span>
              </div>
            )}
            <div className="inv-total-row grand"><span>{t('Grand Total', 'कुल राशि')}</span><span className="mono">{fc(invoice.total)}</span></div>
            {invoice.previous_balance > 0 && <div className="inv-total-row" style={{ color: 'var(--warning)', fontWeight: 600 }}><span>{t('+ Prev. Balance', '+ पिछला बकाया')}</span><span className="mono">{fc(invoice.previous_balance)}</span></div>}
            {invoice.previous_balance > 0 && <div className="inv-total-row" style={{ fontWeight: 800 }}><span>{t('Net Payable', 'कुल देय')}</span><span className="mono">{fc(invoice.total_with_prev_balance)}</span></div>}
            {(invoice.amount_received > 0) && <div className="inv-total-row rcvd"><span>{t('Amount Received', 'प्राप्त राशि')}</span><span className="mono">{fc(invoice.amount_received)}</span></div>}
            
            {invoice.ledger_payments && invoice.ledger_payments.length > 0 && (
              <div style={{ marginTop: 12, padding: '6px 8px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Account History</div>
                <div className="inv-total-row" style={{ padding: '2px 0' }}><span>{t('Starting Balance', 'शुरुआती बकाया')}</span><span className="mono">{fc(invoice.starting_balance)}</span></div>
                {invoice.ledger_payments.map((lp, idx) => {
                  const d = lp.ist_formatted ? lp.ist_formatted.split(',')[0] : (lp.date ? new Date(lp.date).toLocaleDateString() : '...');
                  return (
                    <div key={idx} className="inv-total-row text-success" style={{ padding: '2px 0', fontSize: 11 }}>
                      <span>{t('Received', 'प्राप्त')} ({d})</span>
                      <span className="mono">- {fc(lp.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="inv-words">
          <span style={{ color: '#6b7280', fontWeight: 600 }}>{t('Amount in Words:', 'शब्दों में राशि:')} </span>
          <span style={{ fontWeight: 600 }}>{numToWords(invoice.total, lang)}</span>
        </div>

        {/* Payment modes */}
        {invoice.payments?.length > 0 && (
          <div style={{ marginBottom: 14, fontSize: 13 }}>
            <div className="inv-section-title" style={{ marginBottom: 6 }}>{t('Payment Received Via', 'भुगतान प्राप्त हुआ')}</div>
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
          <div style={{ marginBottom: 14, fontSize: 13, background: 'var(--bg)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
            {invoice.notes && (
              <div style={{ color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                <strong><FileText size={12} /> {t('Notes:', 'नोट्स:')}</strong> <span>{invoice.notes}</span>
              </div>
            )}
            {invoice.concession_reason && (
              <div style={{ color: '#374151', marginTop: invoice.notes ? 6 : 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <strong><Tag size={12} /> {t('Concession Reason:', 'रियायत का कारण:')}</strong> <span>{invoice.concession_reason}</span>
              </div>
            )}
          </div>
        )}

        {/* Bank Details & QR Combined Block */}
        <div className="inv-footer" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: '60%' }}>
            {(hasBankDetails || upiId) && (
              <div style={{ display: 'flex', gap: 16, background: 'var(--bg)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 11 }}>
                  {hasBankDetails && (
                    <>
                      <div className="inv-section-title" style={{ marginBottom: 6, fontSize: 12 }}>{t('Bank Transfer Details', 'बैंक ट्रांसफर विवरण')}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px' }}>
                        {settings.bank_name && <><span style={{ color: '#6b7280' }}>{t('Bank', 'बैंक')}:</span><span style={{ fontWeight: 600 }}>{settings.bank_name}</span></>}
                        <span style={{ color: '#6b7280' }}>{t('Account No.', 'खाता संख्या')}:</span><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{settings.bank_account}</span>
                        <span style={{ color: '#6b7280' }}>{t('IFSC', 'आईएफएससी')}:</span><span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{settings.bank_ifsc}</span>
                        {settings.bank_branch && <><span style={{ color: '#6b7280' }}>{t('Branch', 'शाखा')}:</span><span>{settings.bank_branch}</span></>}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingLeft: 12, borderLeft: '1px dashed #cbd5e1' }}>
                  <div style={{ background: '#ffffff', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <QRCode value={qrValue} size={60} bgColor="#FFFFFF" fgColor="#000000" />
                  </div>
                  <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', maxWidth: 80, wordWrap: 'break-word', fontWeight: 600 }}>
                    {upiId ? t('Scan to Pay', 'स्कैन करके भुगतान करें') : t('Scan for Payment', 'भुगतान के लिए स्कैन करें')}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', flex: 1, fontSize: 11.5, color: '#9ca3af' }}>
            <div>{t('This is a computer generated invoice.', 'यह कंप्यूटर जनित चालान है।')}</div>
            <div>{t('Thank you for your business!', 'आपके व्यापार के लिए धन्यवाद!')}</div>
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
            <div className="inv-sign-line">{t('Authorised Signature', 'अधिकृत हस्ताक्षर')}</div>
          </div>
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
                  placeholder={t('customer@email.com', 'customer@email.com')}
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
                    : <><Mail size={14} /> {t('Send Email', 'ईमेल भेजें')}</>}
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

      {/* Send Invoice Modal */}
      {showSendModal && (
        <div className="modal-overlay" onClick={() => setShowSendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title d-flex align-items-center gap-2"><Send size={18} className="text-primary" /> Send Invoice to Staff</div>
              <button className="modal-close" onClick={() => setShowSendModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 15px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>
                Select present managers or drivers to instantly dispatch this invoice's task to their dashboards.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {fetchingStaff ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading staff list...</div>
                ) : (
                  <>
                    {/* Managers Section */}
                    {staffData.managers.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          💼 Managers Present
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {staffData.managers.filter(p => p._id !== user?.id && p._id !== user?._id).map(person => {
                            const isSelected = selectedStaff.includes(person._id);
                            return (
                              <div 
                                key={person._id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedStaff(selectedStaff.filter(id => id !== person._id));
                                  } else {
                                    setSelectedStaff([...selectedStaff, person._id]);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-light)',
                                  border: isSelected ? '1px solid #6366f1' : '1px solid var(--border)',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => {}} 
                                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 500, color: isSelected ? '#6366f1' : 'var(--text-dark)' }}>{person.display_name || person.username}</span>
                                </div>
                                <span className="badge" style={{ background: 'var(--primary-light)', color: '#4338ca', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>Manager</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Drivers Section */}
                    {staffData.drivers.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          🚚 Drivers Present
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {staffData.drivers.map(person => {
                            const isSelected = selectedStaff.includes(person._id);
                            const isEngaged = staffData.activeTrips?.some(t => t.driver_id === person._id);
                            return (
                              <div 
                                key={person._id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedStaff(selectedStaff.filter(id => id !== person._id));
                                  } else {
                                    if (isEngaged) {
                                      setDriverWarningModal({
                                        title: '⚠️ Driver Engaged',
                                        message: `Driver ${person.display_name || person.username} is currently engaged on an active trip.\n\nYou can still send them the next trip details, but they cannot start it until they end their current trip in the portal.`
                                      });
                                    }
                                    setSelectedStaff([...selectedStaff, person._id]);
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-light)',
                                  border: isSelected ? '1px solid #6366f1' : '1px solid var(--border)',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => {}} 
                                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: 14, fontWeight: isSelected ? 600 : 500, color: isSelected ? '#6366f1' : 'var(--text-dark)' }}>{person.display_name || person.username}</span>
                                </div>
                                <span className="badge" style={{ background: 'var(--warning-light)', color: '#d97706', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 600 }}>Driver</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {staffData.managers.length === 0 && staffData.drivers.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No staff members found.</div>
                    )}
                  </>
                )}

              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  onClick={handleSendDispatch}
                  disabled={sendingDispatch || fetchingStaff || selectedStaff.length === 0}
                  className="btn btn-primary btn-block d-inline-flex align-items-center gap-2"
                  style={{ justifyContent: 'center', background: '#6366f1', borderColor: '#6366f1' }}
                >
                  <Send size={14} /> {sendingDispatch ? 'Sending...' : 'Send Dispatch Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Escalate Modal */}
      {showEscalateModal && (
        <div className="modal-overlay" onClick={() => setShowEscalateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title d-flex align-items-center gap-2">
                <AlertTriangle size={18} className="text-warning" /> Escalate to Admin
              </div>
              <button className="modal-close" onClick={() => setShowEscalateModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 15px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 15 }}>
                Provide a reason for escalating this invoice to the Supervisor Admin. They will receive an instant notification.
              </p>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Reason for escalation..."
                value={escalateReason}
                onChange={e => setEscalateReason(e.target.value)}
                style={{ resize: 'none', marginBottom: 20 }}
              ></textarea>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowEscalateModal(false)}>{t('Cancel', 'रद्द करें')}</button>
                <button 
                  className="btn btn-warning d-inline-flex align-items-center gap-2" 
                  onClick={submitEscalate}
                  disabled={escalating || !escalateReason.trim()}
                >
                  {escalating ? <span className="spinner"></span> : <AlertTriangle size={16} />}
                  Submit Escalation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver Engaged Warning Modal */}
      {driverWarningModal && (
        <div className="modal-overlay" onClick={() => setDriverWarningModal(null)} style={{ zIndex: 99999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
                {driverWarningModal.title}
              </div>
              <button className="modal-close" onClick={() => setDriverWarningModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 14, lineHeight: '1.5', marginBottom: 20, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                {driverWarningModal.message}
              </div>
              <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setDriverWarningModal(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Customer Name Modal */}
      {showEditNameModal && (
        <div className="modal-overlay no-print">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Update Customer Name</div>
              {invoice.customer_name !== 'Walk-in Customer' && (
                <button className="modal-close" onClick={() => setShowEditNameModal(false)}><X size={18} /></button>
              )}
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, fontSize: 13, color: '#b91c1c', background: 'var(--danger-light)', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca' }}>
                Customer name is mandatory to view or print this invoice.
              </div>
              <form onSubmit={handleSaveName}>
                <div className="form-group">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Full Name *</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-muted)' }}>
                      {getPrefixOptions(editNameForm.name).map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                          <input 
                            type="radio" 
                            name="editNamePrefix" 
                            value={opt.value}
                            checked={editNameForm.prefix === opt.value}
                            onChange={e => setEditNameForm({ ...editNameForm, prefix: e.target.value })}
                            style={{ margin: 0, cursor: 'pointer' }}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <input
                      ref={editNameRef}
                      autoFocus
                      className="form-control"
                      value={editNameForm.name}
                      onChange={e => {
                        let newName = e.target.value;
                        newName = newName.split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
                        const wasH = isHindi(editNameForm.name);
                        const isH = isHindi(newName);
                        let newPrefix = editNameForm.prefix || 'Shree';
                        if (wasH !== isH) {
                          if (isH) {
                            if (newPrefix === 'Shree' || newPrefix === 'Mr.') newPrefix = 'श्री';
                            else if (newPrefix === 'Shreemati' || newPrefix === 'Mrs.') newPrefix = 'श्रीमती';
                          } else {
                            if (newPrefix === 'श्री') newPrefix = 'Shree';
                            else if (newPrefix === 'श्रीमती') newPrefix = 'Shreemati';
                          }
                        }
                        setEditNameForm({ ...editNameForm, name: newName, prefix: newPrefix });
                      }}
                      onBlur={handleEditNameBlur}
                      placeholder="Customer name"
                      style={{ flex: 1, borderRadius: 8 }}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 15 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Phone Number</label>
                  <input
                    className="form-control"
                    value={editNameForm.phone}
                    onChange={e => setEditNameForm({ ...editNameForm, phone: e.target.value.replace(/\\D/g, '') })}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    style={{ borderRadius: 8, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div className="form-group" style={{ marginTop: 15 }}>
                  <label className="form-label" style={{ marginBottom: 4 }}>Address</label>
                  <input
                    className="form-control"
                    value={editNameForm.address}
                    onChange={e => {
                      let newAddr = e.target.value;
                      newAddr = newAddr.split(' ').map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '').join(' ');
                      setEditNameForm({ ...editNameForm, address: newAddr });
                    }}
                    placeholder="e.g. Main Market, Almora"
                    style={{ borderRadius: 8, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  {invoice.customer_name !== 'Walk-in Customer' && (
                    <button type="button" className="btn btn-outline" onClick={() => setShowEditNameModal(false)}>{t('Cancel', 'रद्द करें')}</button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={savingName || !editNameForm.name.trim()}>
                    {savingName ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
