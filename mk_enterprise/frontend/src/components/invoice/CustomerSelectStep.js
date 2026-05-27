import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { customerApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, UserPlus, User, Phone, MapPin, Plus } from 'lucide-react';
import { FormattedName, formatCustomerName, getPrefixOptions, applyAutoSuffix, parseCustomerName } from '../../utils/nameFormatter';

export default function CustomerSelectStep({
  customers = [],
  onSelectCustomer,
  onWalkIn,
  onBack,
  onCustomerCreated,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [prefix, setPrefix] = useState('Shree');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [balanceType, setBalanceType] = useState('due'); // 'due' or 'advance'

  const filteredCustomers = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return customers;
    return customers.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(trimmed);
      const phoneMatch = (c.phone || '').toLowerCase().includes(trimmed);
      const altPhoneMatch = c.alternate_phones && c.alternate_phones.some(ap => (ap || '').toLowerCase().includes(trimmed));
      return nameMatch || phoneMatch || altPhoneMatch;
    });
  }, [customers, searchQuery]);

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

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    const opts = getPrefixOptions(val);
    if (opts && opts.length > 0) {
      // Keep selected prefix appropriate to Hindi/English
      const currentH = /[\u0900-\u097F]/.test(val);
      if (currentH && prefix === 'Shree') {
        setPrefix('श्री');
      } else if (!currentH && prefix === 'श्री') {
        setPrefix('Shree');
      }
    }
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      toast.error('Phone number must be a 10-digit number');
      return;
    }

    setLoading(true);
    try {
      // Auto suffix with "jii" / "जी" as per project norms
      const suffixedName = applyAutoSuffix(name);
      const fullName = formatCustomerName(prefix, suffixedName);

      const balNum = parseFloat(balance) || 0;
      // If balance type is advance, it should be stored as negative balance, or based on DB design
      // Let's verify how balance is stored in Customer.js.
      // Usually, positive balance = due, negative balance = advance (or vice versa).
      // Let's store positive balance for due, negative balance for advance.
      const openingBalance = balanceType === 'advance' ? -Math.abs(balNum) : Math.abs(balNum);

      const payload = {
        name: fullName,
        phone: phone.trim(),
        address: address.trim(),
        opening_balance: openingBalance,
      };

      const newCust = await customerApi.create(payload);
      toast.success('Customer added successfully!');
      
      // Reset Form
      setName('');
      setPhone('');
      setAddress('');
      setBalance('');
      setPrefix('Shree');
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
    <div className="cs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      {/* Header */}
      <div className="cs-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <button 
          onClick={onBack}
          className="btn btn-outline" 
          style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Select Customer</h1>
          <p className="page-subtitle" style={{ margin: '2px 0 0 0' }}>Choose a customer to initiate the invoice</p>
        </div>
      </div>

      {/* Action Buttons & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search Input Box */}
        <div className="cs-search-wrap" style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control cs-search-input"
            placeholder="Search by name or phone number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '44px',
              paddingRight: searchQuery ? '40px' : '14px',
              height: '48px',
              fontSize: '15px',
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
          <span>Total Customers: {customers.length}</span>
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
            const hasBalance = customer.balance && customer.balance !== 0;
            const isAdvance = customer.balance < 0;
            const absoluteBalance = Math.abs(customer.balance || 0);

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
                    color: '#fff',
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
                    <FormattedName fullName={customer.name} />
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

      {/* Add Customer Modal */}
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
              
              {/* Name and Prefix */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Customer Name *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-control"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    style={{ width: '110px', height: '42px', borderRadius: '8px' }}
                  >
                    {getPrefixOptions(name).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter name..."
                    value={name}
                    onChange={handleNameChange}
                    required
                    style={{ flex: 1, height: '42px', borderRadius: '8px' }}
                  />
                </div>
              </div>

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
                  onChange={(e) => setAddress(e.target.value)}
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
                  <select
                    className="form-control"
                    value={balanceType}
                    onChange={(e) => setBalanceType(e.target.value)}
                    style={{ width: '120px', height: '42px', borderRadius: '8px' }}
                  >
                    <option value="due">Due (बकाया)</option>
                    <option value="advance">Advance (अग्रिम)</option>
                  </select>
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
