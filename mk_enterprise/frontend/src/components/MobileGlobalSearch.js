import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, User, Package, FileText, ChevronRight, Clock } from 'lucide-react';
import { customerApi, productApi, invoiceApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import useBackButton from '../hooks/useBackButton';

export default function MobileGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ customers: [], products: [], invoices: [] });
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem('mk_recent_searches');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const navigate = useNavigate();

  useBackButton(isOpen, () => setIsOpen(false));

  const handleRecentAdd = (item) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(r => r.id !== item.id);
      const updated = [item, ...filtered].slice(0, 7);
      localStorage.setItem('mk_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecent = (e, id) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('mk_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults({ customers: [], products: [], invoices: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults({ customers: [], products: [], invoices: [] });
        return;
      }

      setLoading(true);
      try {
        const [custRes, prodRes, invRes] = await Promise.all([
          customerApi.getAll({ search: query, limit: 5 }),
          productApi.getAll({ search: query, limit: 5 }),
          invoiceApi.getAll({ search: query, limit: 5 })
        ]);

        setResults({
          customers: custRes.customers || custRes || [],
          products: prodRes.products || prodRes || [],
          invoices: invRes.invoices || invRes || []
        });
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        style={{ 
          background: '#f0f2f5', border: 'none', borderRadius: '50%', 
          width: 36, height: 36, display: 'flex', alignItems: 'center', 
          justifyContent: 'center', cursor: 'pointer', color: '#050505'
        }}
      >
        <Search size={20} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-card)', zIndex: 9999, display: 'flex', flexDirection: 'column'
        }}>
          {/* Search Header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '8px 12px',
            borderBottom: '1px solid var(--border)', gap: 12, height: 56
          }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <input 
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, products, invoices..."
              style={{
                flex: 1, height: 40, border: 'none', background: 'var(--bg)',
                borderRadius: 20, padding: '0 16px', fontSize: 15, outline: 'none', color: 'var(--text)'
              }}
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: 20, background: 'none', border: 'none', 
                  color: 'var(--text-muted)', padding: 4, cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search Results */}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                Searching...
              </div>
            ) : query.trim().length >= 2 && !results.customers.length && !results.products.length && !results.invoices.length ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No results found for "{query}"
              </div>
            ) : query.trim().length < 2 ? (
              <div style={{ padding: 12 }}>
                {recentSearches.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginLeft: 4 }}>Recent</div>
                    {recentSearches.map(r => (
                      <div 
                        key={r.id} 
                        style={{ padding: '12px 16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', borderRadius: 8 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }} onClick={() => handleRecentClick(r)}>
                          <div style={{ color: 'var(--text-muted)', width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
                            <Clock size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{r.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.subtitle}</div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => removeRecent(e, r.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 8, cursor: 'pointer' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                
                {/* Customers */}
                {results.customers.length > 0 && (
                  <div style={{ background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Customers
                    </div>
                    {results.customers.map(c => (
                      <div 
                        key={c._id} 
                        onClick={() => { 
                          handleRecentAdd({ id: c._id, title: c.name, subtitle: c.phone || 'Customer', path: '/customers', state: { highlightCustomerId: c._id } });
                          window.history.back(); setTimeout(() => { navigate('/customers', { state: { highlightCustomerId: c._id } }); }, 50);
                        }}
                        style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: 'var(--primary-light)', color: '#0284c7', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.phone || 'No phone'} • Balance: <span style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{formatCurrency(c.balance)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoices */}
                {results.invoices.length > 0 && (
                  <div style={{ background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Invoices
                    </div>
                    {results.invoices.map(i => (
                      <div 
                        key={i._id} 
                        onClick={() => { 
                          handleRecentAdd({ id: i._id, title: `Invoice #${i.invoice_number}`, subtitle: i.customer?.name || 'Customer', path: `/invoices/${i._id}`, state: null });
                          window.history.back(); setTimeout(() => { navigate(`/invoices/${i._id}`); }, 50);
                        }}
                        style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: 'var(--warning-light)', color: '#d97706', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>#{i.invoice_number} • {i.customer?.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(i.date).toLocaleDateString()} • <span style={{ fontWeight: 600 }}>{formatCurrency(i.grand_total)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Products */}
                {results.products.length > 0 && (
                  <div style={{ background: 'var(--bg-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Products
                    </div>
                    {results.products.map(p => (
                      <div 
                        key={p._id} 
                        onClick={() => { 
                          handleRecentAdd({ id: p._id, title: p.name, subtitle: `Stock: ${p.stock_quantity} ${p.unit}`, path: '/products', state: { highlightProductId: p._id, searchQuery: p.name } });
                          window.history.back(); setTimeout(() => { navigate('/products', { state: { highlightProductId: p._id, searchQuery: p.name } }); }, 50);
                        }}
                        style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: 'var(--success-light)', color: '#059669', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Stock: <span style={{ fontWeight: 600, color: p.stock_quantity <= 0 ? 'var(--danger)' : 'var(--success)' }}>{p.stock_quantity} {p.unit}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
