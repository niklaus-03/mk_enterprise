import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, User, Package, FileText, ChevronRight } from 'lucide-react';
import { customerApi, productApi, invoiceApi } from '../utils/api';
import { formatCurrency } from '../utils/helpers';

export default function MobileGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ customers: [], products: [], invoices: [] });
  const navigate = useNavigate();

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
          background: '#fff', zIndex: 9999, display: 'flex', flexDirection: 'column'
        }}>
          {/* Search Header */}
          <div style={{
            display: 'flex', alignItems: 'center', padding: '8px 12px',
            borderBottom: '1px solid #e4e6eb', gap: 12, height: 56
          }}>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#65676b', padding: 4 }}
            >
              <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <input 
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, products, invoices..."
              style={{
                flex: 1, height: 40, border: 'none', background: '#f0f2f5',
                borderRadius: 20, padding: '0 16px', fontSize: 15, outline: 'none'
              }}
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute', right: 20, background: 'none', border: 'none', 
                  color: '#65676b', padding: 4, cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search Results */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f0f2f5', padding: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#65676b' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                Searching...
              </div>
            ) : query.trim().length >= 2 && !results.customers.length && !results.products.length && !results.invoices.length ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#65676b' }}>
                No results found for "{query}"
              </div>
            ) : query.trim().length < 2 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#65676b', fontSize: 14 }}>
                Type at least 2 characters to search
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                
                {/* Customers */}
                {results.customers.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#65676b', textTransform: 'uppercase' }}>
                      Customers
                    </div>
                    {results.customers.map(c => (
                      <div 
                        key={c._id} 
                        onClick={() => { setIsOpen(false); navigate('/customers'); }}
                        style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: '#e0f2fe', color: '#0284c7', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: '#65676b' }}>{c.phone || 'No phone'} • Balance: <span style={{ color: c.balance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{formatCurrency(c.balance)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoices */}
                {results.invoices.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#65676b', textTransform: 'uppercase' }}>
                      Invoices
                    </div>
                    {results.invoices.map(i => (
                      <div 
                        key={i._id} 
                        onClick={() => { setIsOpen(false); navigate(`/invoices/${i._id}`); }}
                        style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: '#fef3c7', color: '#d97706', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>#{i.invoice_number} • {i.customer?.name}</div>
                          <div style={{ fontSize: 13, color: '#65676b' }}>{new Date(i.date).toLocaleDateString()} • <span style={{ fontWeight: 600 }}>{formatCurrency(i.grand_total)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Products */}
                {results.products.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '10px 12px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#65676b', textTransform: 'uppercase' }}>
                      Products
                    </div>
                    {results.products.map(p => (
                      <div 
                        key={p._id} 
                        onClick={() => { setIsOpen(false); navigate('/products'); }}
                        style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      >
                        <div style={{ background: '#ecfdf5', color: '#059669', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: '#050505' }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: '#65676b' }}>Stock: <span style={{ fontWeight: 600, color: p.stock_quantity <= 0 ? '#ef4444' : '#10b981' }}>{p.stock_quantity} {p.unit}</span></div>
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
