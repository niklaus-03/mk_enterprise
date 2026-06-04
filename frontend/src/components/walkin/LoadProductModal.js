import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { walkinApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, Package, Plus, Minus, Check, Truck, Edit, CheckCircle2 } from 'lucide-react';

export default function LoadProductModal({ onClose, onSuccess, activeTrip, onEditVehicle, onStartTrip }) {
  const { t } = useApp();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);
  const [prefillBanner, setPrefillBanner] = useState(null);

  // Map of product_id -> item details
  const [selectedItems, setSelectedItems] = useState(new Map());

  // Load global products
  useEffect(() => {
    setLoading(true);
    walkinApi.getGlobalProducts().then(async (res) => {
      const list = Array.isArray(res) ? res : [];
      setProducts(list);
      
      // Extract categories
      const cats = new Set();
      list.forEach(p => {
        if (p.category) cats.add(p.category.trim());
      });
      setCategories(Array.from(cats));

      // Auto-prefill from previous trip if this is a fresh load (empty initial stock)
      if (activeTrip && (!activeTrip.initial_stock || activeTrip.initial_stock.length === 0)) {
        try {
          const prevTripData = await walkinApi.getPreviousTripRemaining();
          if (prevTripData && prevTripData.remaining_items && prevTripData.remaining_items.length > 0) {
            const prefillMap = new Map();
            let count = 0;
            prevTripData.remaining_items.forEach(item => {
              const globalProduct = list.find(p => p.name === item.product_name);
              if (globalProduct) {
                const available = parseFloat(globalProduct.stock) || 0;
                const qtyToPrefill = Math.min(item.quantity, available);
                if (qtyToPrefill > 0) {
                  prefillMap.set(globalProduct._id, {
                    product_id: globalProduct._id,
                    product_name: globalProduct.name,
                    qty: qtyToPrefill,
                    price: parseFloat(globalProduct.price) || 0,
                    unit: globalProduct.unit || 'bag',
                    stock: available,
                  });
                  count++;
                }
              }
            });
            if (count > 0) {
              setSelectedItems(prefillMap);
              setPrefillBanner(`Pre-filled with ${count} items remaining from your previous trip today.`);
            }
          }
        } catch (err) {
          console.error("Failed to fetch previous trip remaining items", err);
        }
      }

    }).catch(err => {
      toast.error('Failed to load global products');
    }).finally(() => {
      setLoading(false);
    });
  }, [activeTrip]);

  const handleAddQty = useCallback((product) => {
    const id = product._id;
    const current = selectedItems.get(id);
    const newMap = new Map(selectedItems);

    if (current) {
      if (current.qty >= product.stock) {
        toast.error(`Only ${product.stock} available in Main Store`);
        return;
      }
      newMap.set(id, { ...current, qty: current.qty + 1 });
    } else {
      if (product.stock <= 0) {
        toast.error('Out of stock in Main Store');
        return;
      }
      newMap.set(id, {
        product_id: id,
        product_name: product.name,
        qty: 1,
        price: parseFloat(product.price) || 0,
        unit: product.unit || 'bag',
        stock: parseFloat(product.stock) || 0,
      });
    }
    setSelectedItems(newMap);
  }, [selectedItems]);

  const handleSubQty = useCallback((product) => {
    const id = product._id;
    const current = selectedItems.get(id);
    if (!current) return;

    const newMap = new Map(selectedItems);
    if (current.qty <= 1) {
      newMap.delete(id);
    } else {
      newMap.set(id, { ...current, qty: current.qty - 1 });
    }
    setSelectedItems(newMap);
  }, [selectedItems]);

  const handleQtyChange = useCallback((product, value) => {
    const id = product._id;
    const newQty = parseFloat(value) || 0;
    const newMap = new Map(selectedItems);

    if (newQty <= 0) {
      newMap.delete(id);
    } else {
      if (newQty > product.stock) {
        toast.error(`Only ${product.stock} available in Main Store`);
        return;
      }
      const current = selectedItems.get(id);
      if (current) {
        newMap.set(id, { ...current, qty: newQty });
      } else {
        newMap.set(id, {
          product_id: id,
          product_name: product.name,
          qty: newQty,
          price: parseFloat(product.price) || 0,
          unit: product.unit || 'bag',
          stock: parseFloat(product.stock) || 0,
        });
      }
    }
    setSelectedItems(newMap);
  }, [selectedItems]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'none') {
          if (p.category && p.category.trim()) return false;
        } else {
          if ((p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesCat = (p.category || '').toLowerCase().includes(query);
        return matchesName || matchesCat;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts = { all: products.length, none: 0 };
    products.forEach(p => {
      const cat = (p.category || '').trim().toLowerCase();
      if (!cat) {
        counts.none = (counts.none || 0) + 1;
      } else {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const totalItemsCount = useMemo(() => {
    let count = 0;
    selectedItems.forEach(item => {
      count += item.qty;
    });
    return count;
  }, [selectedItems]);

  const handleLoadClick = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item to load');
      return;
    }
    
    setSaving(true);
    try {
      const itemsToLoad = Array.from(selectedItems.values()).map(i => ({
        product_id: i.product_id,
        qty: i.qty
      }));
      
      const res = await walkinApi.loadProducts({ items: itemsToLoad });
      
      if (res.errors && res.errors.length > 0) {
        res.errors.forEach(err => toast.error(err));
      }
      
      toast.success('Inventory loaded successfully!');
      setLoadComplete(true);
    } catch (err) {
      toast.error(err.message || 'Failed to load inventory');
    } finally {
      setSaving(false);
    }
  };

  if (loadComplete) {
    const isReload = activeTrip?.trip_started;
    
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
          <div style={{ width: 64, height: 64, background: 'var(--success-light)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={32} />
          </div>
          <h2 style={{ fontSize: '20px', color: 'var(--text)', marginBottom: '8px' }}>
            {isReload ? 'Products Loaded!' : 'Inventory Loaded!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
            {isReload 
              ? 'New supply has been successfully loaded into the vehicle.' 
              : 'Are you sure you loaded the vehicle fine ??'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!isReload && (
              <button onClick={() => { if(onStartTrip) onStartTrip(); }} className="btn btn-success" style={{ background: '#10b981', borderColor: '#10b981', padding: '12px', fontSize: '15px', fontWeight: 'bold' }}>
                <Truck size={18} style={{ marginRight: 8 }} /> Start the journey
              </button>
            )}
            <button onClick={() => { if(onSuccess) onSuccess(); else onClose(); }} className="btn btn-outline" style={{ padding: '12px', fontSize: '15px', color: 'var(--text-muted)' }}>
              {isReload ? 'Close & Continue' : 'Review It'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg)', zIndex: 1000, display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div className="pg-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #242b3d', padding: '16px 24px', flexShrink: 0, background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onClose}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--bg-hover)', color: 'var(--text)', background: 'var(--bg-hover)' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, color: 'var(--text)' }}>Load Inventory from Main Store</h1>
            <p className="page-subtitle" style={{ margin: '2px 0 0 0', color: 'var(--text-muted)' }}>
              Select items to load into your vehicle
            </p>
            {activeTrip && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Truck size={14} /> 
                <b>Vehicle:</b> {activeTrip.vehicle_number} | <b>Driver:</b> {activeTrip.driver_name} 
                {!activeTrip.trip_started && (activeTrip.vehicle_update_count || 0) < 5 && (
                  <button 
                    onClick={onEditVehicle}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: 12, padding: 0 }}
                    title={`Edit Vehicle details (Optionally, ${5 - (activeTrip.vehicle_update_count || 0)} edits left if needed)`}
                  >
                    <Edit size={12} /> Edit (Optional)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowSearch(prev => !prev)}
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: showSearch ? 'var(--primary)' : 'var(--bg-hover)',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={18} />
          </button>
        </div>
      </div>

      {prefillBanner && (
        <div style={{ background: '#dbeafe', color: '#1e40af', padding: '10px 24px', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} style={{ color: '#2563eb' }} /> {prefillBanner}
        </div>
      )}

      {/* Search Input Panel */}
      {showSearch && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #242b3d', flexShrink: 0, background: 'var(--bg)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', height: '44px', background: 'var(--bg-card)',
                border: '1.5px solid #334155', borderRadius: '10px',
                paddingLeft: '44px', paddingRight: '40px', color: 'var(--text)', fontSize: '14px',
              }}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="pg-workspace" style={{ flex: 1, overflow: 'hidden', padding: '16px 24px' }}>
        
        {/* Left Sidebar - Categories */}
        <div className="pg-category-sidebar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`pg-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
            style={{
              padding: '12px 14px', borderRadius: '10px',
              background: selectedCategory === 'all' ? 'var(--primary)' : 'var(--bg-hover)',
              color: selectedCategory === 'all' ? '#ffffff' : 'var(--text)',
              border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '600',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: '13px', transition: 'all 0.2s',
            }}
          >
            <span>All Items</span>
            <span style={{ fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text)', padding: '2px 6px', borderRadius: '10px' }}>{categoryCounts.all}</span>
          </button>

          {categories.map(cat => {
            const normalized = cat.trim().toLowerCase();
            const isActive = selectedCategory === normalized;
            const count = categoryCounts[normalized] || 0;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(normalized)}
                className={`pg-category-item ${isActive ? 'active' : ''}`}
                style={{
                  padding: '12px 14px', borderRadius: '10px',
                  background: isActive ? 'var(--primary)' : 'var(--bg-hover)',
                  color: isActive ? '#ffffff' : 'var(--text)',
                  border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '600',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '13px', transition: 'all 0.2s', marginTop: '4px'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>{cat}</span>
                <span style={{ fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text)', padding: '2px 6px', borderRadius: '10px' }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Right Main Grid - Products */}
        <div className="pg-product-grid" style={{ overflowY: 'auto' }}>
          {loading ? (
             <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '60px 20px' }}>Loading global inventory...</div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Package size={48} style={{ strokeWidth: '1.5', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text)' }}>No items found</h3>
            </div>
          ) : (
            filteredProducts.map(product => {
              const isSelected = selectedItems.has(product._id);
              const selectedItem = selectedItems.get(product._id);
              const qty = selectedItem ? selectedItem.qty : 0;
              const isOutOfStock = product.stock <= 0;

              return (
                <div
                  key={product._id}
                  className={`pg-product-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleAddQty(product)}
                  style={{
                    background: 'var(--bg-card)', borderRadius: '16px',
                    border: isSelected ? '2px solid #c5a059' : '1px solid var(--border)',
                    padding: '16px', position: 'relative', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    minHeight: '150px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    opacity: isOutOfStock && qty === 0 ? 0.45 : 1, transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                      position: 'absolute', top: '12px', left: '12px', fontSize: '11px', fontWeight: '700',
                      padding: '2px 8px', borderRadius: '12px', border: `1.5px solid ${isOutOfStock ? '#ef4444' : '#22c55e'}`,
                      color: isOutOfStock ? '#ef4444' : '#22c55e', background: 'rgba(0,0,0,0.1)',
                  }}>
                    Store Stock: {product.stock}
                  </div>

                  {qty > 0 && (
                    <div style={{
                        position: 'absolute', top: '10px', right: '10px', background: '#c5a059', color: 'var(--bg-card)',
                        width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '800', fontSize: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    }}>{qty}</div>
                  )}

                  <div style={{ marginTop: '24px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>{product.name}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: '600', marginTop: '4px' }}>₹{parseFloat(product.price).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase' }}>{product.unit}</div>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {qty > 0 ? (
                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1.5px solid #334155' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleSubQty(product); }} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '6px 8px', cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center' }}><Minus size={13} /></button>
                        <input type="number" value={qty} onChange={(e) => handleQtyChange(product, e.target.value)} style={{ width: '40px', background: 'transparent', border: 'none', color: 'var(--text)', textAlign: 'center', fontWeight: '700', fontSize: '13px' }} />
                        <button onClick={(e) => { e.stopPropagation(); handleAddQty(product); }} style={{ background: 'transparent', border: 'none', color: 'var(--text)', padding: '6px 8px', cursor: 'pointer', flex: 1, display: 'flex', justifyContent: 'center' }}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <div style={{ width: '100%', textAlign: 'center', padding: '6px 10px', border: '1.5px dashed #334155', borderRadius: '8px', fontWeight: '700', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Tap to Load
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="pg-bottom-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'var(--bg-card)', borderTop: '1px solid #242b3d' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Selected to Load</span>
          <strong style={{ fontSize: '20px', color: 'var(--text)', fontFamily: 'monospace' }}>
            {totalItemsCount} units
          </strong>
        </div>

        <button
          onClick={handleLoadClick}
          disabled={saving || selectedItems.size === 0}
          className="btn btn-primary"
          style={{
            background: saving ? 'var(--text-muted)' : '#059669',
            borderColor: 'transparent', color: 'var(--bg-card)',
            fontWeight: '800', fontSize: '15px', borderRadius: '12px',
            height: '46px', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '8px',
            opacity: selectedItems.size === 0 ? 0.5 : 1
          }}
        >
          {saving ? 'LOADING...' : 'CONFIRM LOAD'} <Check size={18} />
        </button>
      </div>
    </div>
  );
}
