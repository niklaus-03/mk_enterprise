import React, { useEffect, useState } from 'react';
import { orderApi } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/helpers';
import { FileSpreadsheet, Phone, AlertTriangle, Calendar, CreditCard, Trash2, Plus, FileText, Inbox } from 'lucide-react';

const fc = formatCurrency;

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const getToday = () =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getAll();
      setOrders(Array.isArray(res) ? res : (res?.orders || []));
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const filteredOrders = orders.filter(order => {
    const today = getToday();
    const d = order.delivery_date?.slice(0, 10) || '';
    if (filter === 'today') return d === today;
    if (filter === 'upcoming') return d > today;
    return true;
  });

  const handleComplete = async (id) => {
    try {
      await orderApi.complete(id);
      toast.success('Order marked complete');
      loadOrders();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await orderApi.delete(id);
      toast.success('Order deleted');
      loadOrders();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const counts = {
    today: orders.filter(o => o.delivery_date?.slice(0, 10) === getToday()).length,
    upcoming: orders.filter(o => (o.delivery_date?.slice(0, 10) || '') > getToday()).length,
    all: orders.length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: 6 }}><FileSpreadsheet size={22} className="text-primary" /> Orders</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Track and manage customer orders
          </div>
        </div>
        <button
          className="btn btn-primary d-inline-flex align-items-center gap-1"
          style={{ boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
          onClick={() => navigate('/orders/new')}
        >
          <Plus size={14} /> Create Order
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 18,
        background: 'var(--border)', borderRadius: 12, padding: '4px 5px',
        width: 'fit-content',
      }}>
        {[
          { key: 'today', label: "Today", icon: <Calendar size={13} />, count: counts.today },
          { key: 'upcoming', label: "Upcoming", icon: <Calendar size={13} />, count: counts.upcoming },
          { key: 'all', label: "All", icon: <FileSpreadsheet size={13} />, count: counts.all },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 9, border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              background: filter === tab.key ? 'var(--bg-card)' : 'transparent',
              color: filter === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: filter === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: filter === tab.key ? 'var(--primary)' : '#d1d5db',
                color: filter === tab.key ? 'var(--bg-card)' : '#6b7280',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="loading"><span className="spinner" style={{ width: 28, height: 28 }}></span></div>
      ) : filteredOrders.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: 'var(--bg-card)', borderRadius: 14, border: '1.5px dashed #d1d5db',
        }}>
          <Inbox size={40} className="text-muted" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 16 }}>No orders found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {filter === 'today' ? "No orders due today" : filter === 'upcoming' ? "No upcoming orders" : "No orders yet"}
          </div>
          <button
            className="btn btn-primary d-inline-flex align-items-center gap-1"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/orders/new')}
          >
            <Plus size={14} /> Create First Order
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}>
          {filteredOrders.map(order => {
            const isOverdue = order.delivery_date?.slice(0, 10) < getToday();
            const isToday = order.delivery_date?.slice(0, 10) === getToday();
            const advanceTotal = order.advance_paid || 0;
            const orderTotal = order.items?.reduce((s, i) => s + ((i.price || 0) * (i.qty || 0)), 0) || 0;

            return (
              <div
                key={order._id}
                style={{
                  background: 'var(--bg-card)',
                  border: `1.5px solid ${isOverdue ? '#fca5a5' : isToday ? '#93c5fd' : '#e5e7eb'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                {/* Card top strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: isOverdue ? 'var(--danger-light)' : isToday ? 'var(--primary-light)' : 'var(--bg)',
                  borderBottom: '1px solid #f3f4f6',
                  flexWrap: 'wrap', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>
                        {order.customer_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={11} /> {order.customer_phone || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {isOverdue && (
                      <span style={{
                        background: 'var(--danger-light)', color: '#dc2626',
                        fontSize: 11, fontWeight: 700, padding: '3px 9px',
                        borderRadius: 8, border: '1px solid #fca5a5',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}><AlertTriangle size={11} /> Overdue</span>
                    )}
                    {isToday && (
                      <span style={{
                        background: 'var(--primary-light)', color: 'var(--primary)',
                        fontSize: 11, fontWeight: 700, padding: '3px 9px',
                        borderRadius: 8, border: '1px solid #bfdbfe',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}><Calendar size={11} /> Due Today</span>
                    )}
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: '#374151',
                      background: 'var(--border)', padding: '3px 10px', borderRadius: 8,
                    }}>
                      {order.delivery_date
                        ? (() => {
                            const cleanDate = order.delivery_date.substring(0, 10);
                            const parsed = new Date(cleanDate + 'T00:00:00');
                            return isNaN(parsed.getTime())
                              ? '—'
                              : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                          })()
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>
                    Items
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {order.items?.map((item, idx) => (
                      <div key={idx} style={{
                        background: 'var(--bg)', border: '1px solid #e5e7eb',
                        borderRadius: 8, padding: '5px 12px',
                        fontSize: 13, fontWeight: 600, color: '#374151',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>{item.product_name}</span>
                        <span style={{
                          background: '#e5e7eb', color: '#374151',
                          borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                        }}>×{item.qty}</span>
                        {item.price > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace' }}>
                            ₹{(item.price * item.qty).toFixed(0)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Advance + Notes row */}
                  {(advanceTotal > 0 || order.notes) && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                      {advanceTotal > 0 && (
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          background: 'var(--success-light)', color: '#16a34a',
                          padding: '4px 10px', borderRadius: 8, border: '1px solid #86efac',
                          display: 'inline-flex', alignItems: 'center', gap: 4
                        }}>
                          <CreditCard size={12} /> Advance: ₹{advanceTotal.toFixed(2)}
                          {order.advance_mode && ` (${order.advance_mode.toUpperCase()})`}
                        </div>
                      )}
                      {order.notes && (
                        <div style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={12} /> {order.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex', gap: 8, padding: '10px 16px',
                  borderTop: '1px solid #f3f4f6', flexWrap: 'wrap',
                  background: 'var(--bg-hover)',
                }}>
                  <button
                    className="btn btn-primary btn-sm d-inline-flex align-items-center justify-content-center gap-1"
                    onClick={() => navigate(`/invoices/new?orderId=${order._id}`)}
                    style={{ flex: 1, minWidth: 140 }}
                  >
                    <FileText size={13} /> Generate Invoice
                  </button>
                  <button
                    className="btn btn-outline btn-sm d-inline-flex align-items-center justify-content-center gap-1"
                    onClick={() => handleDelete(order._id)}
                    style={{ color: 'var(--danger)', borderColor: '#fca5a5' }}
                  >
                    <Trash2 size={13} />{t('Delete', 'हटाएं')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}