import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { customerApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, UserPlus, User, Phone, MapPin, Plus, FolderOpen, PenTool } from 'lucide-react';
import { parseCustomerName } from '../../utils/nameFormatter';
import SignatureCanvas from 'react-signature-canvas';
import Tesseract from 'tesseract.js';

export default function CustomerSelectStep({
  customers = [],
  managers = [],
  selectedManager = '',
  onManagerChange = () => {},
  onSelectCustomer,
  onWalkIn,
  onBack,
  onCustomerCreated,
  draftsCount = 0,
  onShowDrafts,
  showDrafts = false,
  draftsPanel = null,
}) {
  const { t } = useApp();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScribble, setShowScribble] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [recognizedName, setRecognizedName] = useState('');
  const sigCanvasRef = React.useRef(null);
  
  // Handle resize for responsiveness
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceType, setBalanceType] = useState('due'); // 'due' or 'advance'

  const getManagerNames = (c) => {
    const mgrs = [];
    if (c.created_by && c.created_by.role !== 'supervisor') mgrs.push(c.created_by);
    if (c.allowed_managers && c.allowed_managers.length > 0) {
      c.allowed_managers.forEach(am => {
        if (am && am.role !== 'supervisor' && !mgrs.some(m => m._id === am._id)) mgrs.push(am);
      });
    }
    if (mgrs.length === 0) return null;
    return mgrs.map(m => m.display_name || m.username).join(', ');
  };

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (selectedManager) {
      list = list.filter(c => 
        (c.created_by && (c.created_by._id === selectedManager || c.created_by === selectedManager)) || 
        (c.allowed_managers && c.allowed_managers.some(m => (m._id === selectedManager || m === selectedManager)))
      );
    }
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return list;
    return list.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(trimmed);
      const phoneMatch = (c.phone || '').toLowerCase().includes(trimmed);
      const altPhoneMatch = c.alternate_phones && c.alternate_phones.some(ap => (ap || '').toLowerCase().includes(trimmed));
      return nameMatch || phoneMatch || altPhoneMatch;
    }).sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStarts = aName.startsWith(trimmed);
      const bStarts = bName.startsWith(trimmed);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });
  }, [customers, searchQuery, selectedManager]);

  // Generate a premium dynamic color for avatar based on name string
  const getAvatarColor = (nameStr = '') => {
    const colors = [
      'linear-gradient(135deg, #3b82f6, #1d4ed8)', // Blue
      'linear-gradient(135deg, #10b981, #059669)', // Green
      'linear-gradient(135deg, #f59e0b, #d97706)', // Amber
      'linear-gradient(135deg, #ec4899, #be185d)', // Pink
      'linear-gradient(135deg, #8b5cf6, #6d28d9)', // Purple
      'linear-gradient(135deg, #f43f5e, #e11d48)', // Rose
      'linear-gradient(135deg, #06b6d4, #0891b2)', // Cyan
    ];
    let hash = 0;
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const toTitleCase = (str) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleNameChange = (e) => {
    setName(toTitleCase(e.target.value));
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!phone || phone.length !== 10) {
      toast.error('Phone number is mandatory and must be a 10-digit number');
      return;
    }

    setLoading(true);
    try {
      const balNum = parseFloat(balance) || 0;
      const openingBalance = balanceType === 'advance' ? -Math.abs(balNum) : Math.abs(balNum);

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        balance: openingBalance,
        override_creator_id: selectedManager || undefined,
      };

      const newCust = await customerApi.create(payload);
      toast.success('Customer added successfully!');
      
      // Reset Form
      setName('');
      setPhone('');
      setAddress('');
      setBalance('');
      setBalanceType('due');
      setShowAddModal(false);

      if (onCustomerCreated) {
        onCustomerCreated(newCust);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* Header & Search */}
      <div className="cs-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBack}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{t('Select Customer', 'ग्राहक चुनें')}</h1>
              {draftsCount > 0 && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onShowDrafts) onShowDrafts(); }}
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: showDrafts ? 'var(--primary)' : 'var(--primary-light)',
                    border: 'none',
                    borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    color: showDrafts ? 'var(--bg-card)' : 'var(--primary)',
                    boxShadow: showDrafts ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <FolderOpen size={14} /> Saved Drafts
                  <span style={{
                    background: showDrafts ? 'rgba(255,255,255,0.25)' : 'var(--primary)',
                    color: showDrafts ? 'var(--bg-card)' : 'white', borderRadius: 10, padding: '2px 8px', fontSize: 11, marginLeft: 4
                  }}>
                    {draftsCount}
                  </span>
                </button>
              )}
            </div>
            <p className="page-subtitle" style={{ margin: '2px 0 0 0' }}>{t('Choose a customer to initiate the invoice', 'बिल शुरू करने के लिए ग्राहक चुनें')}</p>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="cs-search-wrap" style={{ position: 'relative', flex: '1', minWidth: '280px', maxWidth: '500px', margin: '0 auto' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control cs-search-input"
            placeholder={t('Search by name or phone number...', 'नाम या फोन नंबर से खोजें...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '44px',
              paddingRight: searchQuery ? '40px' : '14px',
              height: '42px',
              fontSize: '14px',
              borderRadius: '12px',
              border: '1.5px solid var(--border)',
              width: '100%',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              transition: 'all 0.2s',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {draftsPanel}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Action buttons side-by-side */}
        <div className="cs-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-success"
            style={{
              height: '48px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
            }}
          >
            <UserPlus size={18} />
            Add Customer
          </button>
          <button
            onClick={onWalkIn}
            className="btn btn-outline"
            style={{
              height: '48px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: '1.5px solid var(--border)',
              background: 'var(--bg-card)',
            }}
          >
            <User size={18} />
            Walk-in Customer
          </button>
        </div>

        {/* Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)', padding: '0 4px' }}>
          <span>{t('Total Customers:', 'कुल ग्राहक:')} {filteredCustomers.length}</span>
          {searchQuery && <span>Found: {filteredCustomers.length}</span>}
        </div>
      </div>

      {/* Customer List */}
      <div 
        className="cs-customer-list" 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '16px', 
          paddingBottom: '20px',
          maxHeight: 'calc(100vh - 290px)'
        }}
      >
        {filteredCustomers.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <User size={48} style={{ strokeWidth: '1.5', marginBottom: '12px', opacity: 0.6 }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>No customers found</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Try searching for a different name or phone number.</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            let displayBalance = customer.balance || 0;
            if (selectedManager && customer.manager_balances) {
              const mb = customer.manager_balances.find(m => m.manager_id === selectedManager || m.manager_id?._id === selectedManager);
              displayBalance = mb ? mb.balance : 0;
            }

            const hasBalance = displayBalance !== 0;
            const isAdvance = displayBalance < 0;
            const absoluteBalance = Math.abs(displayBalance);

            // Extract first letter for avatar
            const { name: nameOnly } = parseCustomerName(customer.name);
            const firstChar = nameOnly ? nameOnly.charAt(0).toUpperCase() : 'C';

            return (
              <div
                key={customer._id}
                className="cs-customer-card"
                onClick={() => onSelectCustomer(customer)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  gap: '16px',
                  boxShadow: 'var(--shadow)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'var(--shadow)';
                }}
              >
                {/* Avatar */}
                <div
                  className="cs-avatar"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: getAvatarColor(customer.name),
                    color: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '18px',
                    flexShrink: 0,
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {firstChar}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer.name}
                  </div>
                  {customer.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <Phone size={12} />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-light)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <MapPin size={11} />
                      <span>{customer.address}</span>
                    </div>
                  )}
                    {getManagerNames(customer) && user?.role !== 'walkin_manager' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#4f46e5', marginTop: '4px', fontWeight: 600 }}>
                        <User size={10} />
                        <span>{customer.merged_by_admin ? 'Merged Account via (' + getManagerNames(customer) + ')' : (customer.added_by_admin ? 'Admin -> ' : 'By: ') + getManagerNames(customer)}</span>
                      </div>
                    )}
                </div>

                {/* Balance Badge */}
                {hasBalance && (
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: isAdvance ? 'var(--success-light)' : 'var(--danger-light)',
                      color: isAdvance ? 'var(--success)' : 'var(--danger)',
                      border: `1px solid ${isAdvance ? '#a7f3d0' : '#fecaca'}`,
                      whiteSpace: 'nowrap',
                      alignSelf: 'center',
                    }}
                  >
                    {isAdvance ? 'Advance' : 'Due'}: {formatCurrency(absoluteBalance)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Scribble Pad */}
      {showScribble && (
          <div
            className="scribble-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: isMobile ? 0 : 'auto',
              right: isMobile ? 'auto' : 0,
              width: isMobile ? '100%' : '400px',
              height: '100%',
              background: 'var(--bg-card)',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>✍️ Write Customer Name</h2>
              <button onClick={() => setShowScribble(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>✖</button>
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Write the name clearly in English or Hindi. Use BIG letters for best results.
            </p>

            {/* Drawing Canvas */}
            <div
              ref={(el) => {
                if (el && sigCanvasRef.current) {
                  const canvas = sigCanvasRef.current.getCanvas();
                  const rect = el.getBoundingClientRect();
                  canvas.width = rect.width;
                  canvas.height = rect.height;
                }
              }}
              style={{
                flex: 1,
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#ffffff',
                maxHeight: isMobile ? '300px' : '400px',
              }}
            >
              <SignatureCanvas
                ref={sigCanvasRef}
                penColor="black"
                minWidth={3}
                maxWidth={6}
                canvasProps={{
                  className: 'scribble-canvas',
                  style: { width: '100%', height: '100%', display: 'block', touchAction: 'none' },
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (sigCanvasRef.current) sigCanvasRef.current.clear();
                }}
                className="btn btn-outline"
                style={{ flex: 1, height: '44px', borderRadius: '10px', fontWeight: 600 }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!sigCanvasRef.current) return;
                  if (sigCanvasRef.current.isEmpty()) {
                    toast.error('Please write something first');
                    return;
                  }

                  // Preprocess canvas for better OCR
                  const srcCanvas = sigCanvasRef.current.getCanvas();
                  const offscreen = document.createElement('canvas');
                  const scale = 2;
                  offscreen.width = srcCanvas.width * scale;
                  offscreen.height = srcCanvas.height * scale;
                  const ctx = offscreen.getContext('2d');
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
                  ctx.drawImage(srcCanvas, 0, 0, offscreen.width, offscreen.height);
                  // Increase contrast for cleaner OCR
                  const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
                  const d = imageData.data;
                  for (let i = 0; i < d.length; i += 4) {
                    const avg = (d[i] + d[i+1] + d[i+2]) / 3;
                    const val = avg < 180 ? 0 : 255;
                    d[i] = val; d[i+1] = val; d[i+2] = val;
                  }
                  ctx.putImageData(imageData, 0, 0);
                  const dataUrl = offscreen.toDataURL('image/png');

                  setOcrLoading(true);
                  try {
                    const { data: { text } } = await Tesseract.recognize(dataUrl, 'hin+eng');
                    const cleaned = text.replace(/[^\w\s\u0900-\u097F]/g, '').trim();
                    if (cleaned) {
                      setName(toTitleCase(cleaned));
                      toast.success('Name filled in the form! Edit if needed.');
                      setShowScribble(false);
                      if (sigCanvasRef.current) sigCanvasRef.current.clear();
                    } else {
                      toast.error('Could not recognize. Please write more clearly.');
                    }
                  } catch (err) {
                    toast.error('OCR failed');
                    console.error(err);
                  } finally {
                    setOcrLoading(false);
                  }
                }}
                className="btn btn-primary"
                style={{ flex: 1, height: '44px', borderRadius: '10px', fontWeight: 600 }}
                disabled={ocrLoading}
              >
                {ocrLoading ? '⏳ Reading...' : '✅ Done'}
              </button>
            </div>
          </div>
        )}

      {showAddModal && (
        <div
          className="cs-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="cs-modal card"
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '20px',
              animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus className="brand-icon" style={{ color: 'var(--success)' }} />
                <span className="card-title" style={{ fontSize: '18px', fontWeight: '700' }}>Add New Customer</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveCustomer} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('Customer Name *', 'ग्राहक का नाम *')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowScribble(true)}
                        className="btn btn-outline"
                        style={{ height: '30px', borderRadius: '6px', padding: '0 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Write name"
                      >
                        <PenTool size={14} />
                        Write
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter name..."
                      value={name}
                      onChange={handleNameChange}
                      required
                      style={{ flex: 1, height: '42px', borderRadius: '8px' }}
                    />

              {/* Phone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Phone Number (10 digits)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13.5px', fontWeight: '600' }}>+91</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter 10-digit mobile number..."
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(val);
                    }}
                    style={{ paddingLeft: '48px', height: '42px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {/* Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Address</label>
                <textarea
                  className="form-control"
                  placeholder="Enter full address..."
                  value={address}
                  onChange={(e) => setAddress(toTitleCase(e.target.value))}
                  style={{ borderRadius: '8px', minHeight: '60px', padding: '10px' }}
                />
              </div>

              {/* Opening Balance */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Opening Balance</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="₹ 0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    style={{ flex: 1, height: '42px', borderRadius: '8px' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', fontSize: '11px', paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                      <input type="radio" name="balanceType" value="due" checked={balanceType === 'due'} onChange={(e) => setBalanceType(e.target.value)} style={{ margin: 0, width: '12px', height: '12px' }} />
                      Due (बकाया)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                      <input type="radio" name="balanceType" value="advance" checked={balanceType === 'advance'} onChange={(e) => setBalanceType(e.target.value)} style={{ margin: 0, width: '12px', height: '12px' }} />
                      Advance (अग्रिम)
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline"
                  style={{ height: '40px', borderRadius: '8px', padding: '0 16px' }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '40px', borderRadius: '8px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
