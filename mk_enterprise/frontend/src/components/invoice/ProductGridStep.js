import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { productApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, Plus, Minus, Package, ShoppingCart, Check } from 'lucide-react';

export default function ProductGridStep({
  selectedCustomer = null,
  walkInData = null,
  initialItems = [],
  onNext,
  onBack,
  onSaveDraft,
  gstEnabled = true,
}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Map of product_id -> item details
  const [selectedItems, setSelectedItems] = useState(new Map());

  // Add Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('bag');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductGst, setNewProductGst] = useState('0');

  // Load products and categories on mount
  useEffect(() => {
    productApi.getAll({ limit: 500 }).then(res => {
      const list = Array.isArray(res) ? res : (res?.products || res?.data || []);
      setProducts(list);
    }).catch(err => {
      toast.error('Failed to load products');
    });

    productApi.getCategories().then(cats => {
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch(() => {});
  }, []);

  // Initialize selectedItems from initialItems prop
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const newMap = new Map();
      initialItems.forEach(item => {
        if (item.product_id) {
          newMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            gst: parseFloat(item.gst) || 0,
            unit: item.unit || 'bag',
            stock: parseFloat(item.stock) || 0,
            weight_per_unit: item.weight_per_unit || '',
            _isNew: item._isNew || false,
          });
        }
      });
      setSelectedItems(newMap);
    }
  }, [initialItems]);

  // Handle adding product qty
  const handleAddQty = useCallback((product) => {
    const id = product._id;
    const current = selectedItems.get(id);
    const newMap = new Map(selectedItems);

    if (current) {
      newMap.set(id, { ...current, qty: current.qty + 1 });
    } else {
      newMap.set(id, {
        product_id: id,
        product_name: product.name,
        qty: 1,
        price: parseFloat(product.price) || 0,
        gst: gstEnabled ? (parseFloat(product.gst) || 0) : 0,
        unit: product.unit || 'bag',
        stock: parseFloat(product.stock) || 0,
        weight_per_unit: product.weight_per_unit || '',
        _isNew: false,
      });
    }
    setSelectedItems(newMap);
  }, [selectedItems, gstEnabled]);

  // Handle subtracting product qty
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

  // Handle direct qty change
  const handleQtyChange = useCallback((product, value) => {
    const id = product._id;
    const newQty = parseFloat(value) || 0;
    const newMap = new Map(selectedItems);

    if (newQty <= 0) {
      newMap.delete(id);
    } else {
      const current = selectedItems.get(id);
      if (current) {
        newMap.set(id, { ...current, qty: newQty });
      } else {
        newMap.set(id, {
          product_id: id,
          product_name: product.name,
          qty: newQty,
          price: parseFloat(product.price) || 0,
          gst: gstEnabled ? (parseFloat(product.gst) || 0) : 0,
          unit: product.unit || 'bag',
          stock: parseFloat(product.stock) || 0,
          weight_per_unit: product.weight_per_unit || '',
          _isNew: false,
        });
      }
    }
    setSelectedItems(newMap);
  }, [selectedItems, gstEnabled]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'none') {
          if (p.category && p.category.trim()) return false;
        } else {
          if ((p.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesCat = (p.category || '').toLowerCase().includes(query);
        return matchesName || matchesCat;
      }

      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Category product counts
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

  // Total invoice cost for selected items
  const totalCost = useMemo(() => {
    let sum = 0;
    selectedItems.forEach(item => {
      const taxable = item.qty * item.price;
      const gstAmt = gstEnabled ? (taxable * item.gst) / 100 : 0;
      sum += taxable + gstAmt;
    });
    return sum;
  }, [selectedItems, gstEnabled]);

  const totalItemsCount = useMemo(() => {
    let count = 0;
    selectedItems.forEach(item => {
      count += item.qty;
    });
    return count;
  }, [selectedItems]);

  const handleSaveDraftClick = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item');
      return;
    }
    onSaveDraft(Array.from(selectedItems.values()));
  };

  const handleNextClick = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item');
      return;
    }
    onNext(Array.from(selectedItems.values()));
  };

  // Inline Product Creation
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!newProductPrice || parseFloat(newProductPrice) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    try {
      const payload = {
        name: newProductName.trim(),
        price: parseFloat(newProductPrice) || 0,
        unit: newProductUnit,
        category: newProductCategory.trim(),
        gst: parseFloat(newProductGst) || 0,
        stock: 9999, // default large stock for custom items
      };

      const newProd = await productApi.create(payload);
      toast.success('Product added successfully!');

      // Add to product list
      setProducts(prev => [newProd, ...prev]);

      // Automatically select it with 1 quantity
      const newMap = new Map(selectedItems);
      newMap.set(newProd._id, {
        product_id: newProd._id,
        product_name: newProd.name,
        qty: 1,
        price: newProd.price,
        gst: gstEnabled ? newProd.gst : 0,
        unit: newProd.unit,
        stock: newProd.stock,
        weight_per_unit: newProd.weight_per_unit || '',
        _isNew: true,
      });
      setSelectedItems(newMap);

      // Reset Form & Close
      setNewProductName('');
      setNewProductPrice('');
      setNewProductUnit('bag');
      setNewProductCategory('');
      setNewProductGst('0');
      setShowAddProductModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to add product');
    }
  };

  const getCustomerDisplayName = () => {
    if (selectedCustomer) {
      return selectedCustomer.name;
    }
    if (walkInData) {
      return `Walk-in: ${walkInData.name || 'Anonymous'}`;
    }
    return 'Walk-in Customer';
  };

  return (
    <div className="pg-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1f2e', color: '#e2e8f0', margin: '-28px', padding: '28px', overflow: 'hidden' }}>
      
      {/* Header */}
      <div className="pg-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #242b3d', paddingBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBack}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#242b3d', color: '#e2e8f0', background: '#242b3d' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#ffffff' }}>Select Items</h1>
            <p className="page-subtitle" style={{ margin: '2px 0 0 0', color: '#94a3b8' }}>
              Customer: <strong style={{ color: '#c5a059' }}>{getCustomerDisplayName()}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowSearch(prev => !prev)}
            style={{
              padding: '10px',
              borderRadius: '12px',
              background: showSearch ? '#2563eb' : '#242b3d',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={18} />
          </button>
          
          <button
            onClick={() => setShowAddProductModal(true)}
            className="btn"
            style={{
              background: '#059669',
              color: '#ffffff',
              borderRadius: '12px',
              fontWeight: '700',
              padding: '10px 16px',
            }}
          >
            + Item
          </button>

          <button
            onClick={handleSaveDraftClick}
            className="btn"
            style={{
              background: '#475569',
              color: '#ffffff',
              borderRadius: '12px',
              fontWeight: '700',
              padding: '10px 16px',
            }}
          >
            HOLD
          </button>
        </div>
      </div>

      {/* Search Input Panel (Collapsible) */}
      {showSearch && (
        <div style={{ padding: '12px 0', borderBottom: '1px solid #242b3d', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search product by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                background: '#242b3d',
                border: '1.5px solid #334155',
                borderRadius: '10px',
                paddingLeft: '44px',
                paddingRight: '40px',
                color: '#ffffff',
                fontSize: '14px',
              }}
              autoFocus
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
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="pg-workspace" style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px 0 80px 0', gap: '20px' }}>
        
        {/* Left Sidebar - Categories */}
        <div 
          className="pg-category-sidebar" 
          style={{ 
            width: '220px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            flexShrink: 0,
            borderRight: '1px solid #242b3d',
            paddingRight: '12px',
          }}
        >
          {/* All Items */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`pg-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: selectedCategory === 'all' ? '#2563eb' : '#242b3d',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: '600',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              transition: 'all 0.2s',
            }}
          >
            <span>All Items</span>
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '10px' }}>
              {categoryCounts.all}
            </span>
          </button>

          {/* Dynamic Categories */}
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
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isActive ? '#2563eb' : '#242b3d',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>{cat}</span>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '10px' }}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* No Category */}
          {categoryCounts.none > 0 && (
            <button
              onClick={() => setSelectedCategory('none')}
              className={`pg-category-item ${selectedCategory === 'none' ? 'active' : ''}`}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: selectedCategory === 'none' ? '#2563eb' : '#242b3d',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                transition: 'all 0.2s',
              }}
            >
              <span>No Category</span>
              <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '10px' }}>
                {categoryCounts.none}
              </span>
            </button>
          )}
        </div>

        {/* Right Main Grid - Products */}
        <div 
          className="pg-product-grid" 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gridAutoRows: 'max-content',
            gap: '16px',
            alignContent: 'start',
            paddingRight: '4px',
          }}
        >
          {filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <Package size={48} style={{ strokeWidth: '1.5', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: '#ffffff' }}>No items found</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Try selecting another category or add a new custom item.</p>
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
                  onClick={() => {
                    if (qty === 0) {
                      handleAddQty(product);
                    }
                  }}
                  style={{
                    background: '#242b3d',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid #c5a059' : '2px solid transparent',
                    padding: '16px',
                    position: 'relative',
                    cursor: qty > 0 ? 'default' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    opacity: isOutOfStock && qty === 0 ? 0.45 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  
                  {/* Top: Stock Circle / Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: `1.5px solid ${isOutOfStock ? '#ef4444' : '#22c55e'}`,
                      color: isOutOfStock ? '#ef4444' : '#22c55e',
                      background: 'rgba(0,0,0,0.1)',
                    }}
                  >
                    Stock: {product.stock}
                  </div>

                  {/* Quantity Indicator in center if selected */}
                  {qty > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#c5a059',
                        color: '#1a1f2e',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '12px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      }}
                    >
                      {qty}
                    </div>
                  )}

                  {/* Center: Product Title & Unit */}
                  <div style={{ marginTop: '24px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {product.name}
                    </h3>
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Per {product.unit || 'bag'}
                    </span>
                  </div>

                  {/* Bottom: Stepper or Price */}
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    {qty > 0 ? (
                      /* Stepper controller */
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1a1f2e', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1.5px solid #334155' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubQty(product);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Minus size={13} />
                        </button>
                        
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => handleQtyChange(product, e.target.value)}
                          style={{
                            width: '40px',
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            textAlign: 'center',
                            fontWeight: '700',
                            fontSize: '13px',
                            MozAppearance: 'textfield',
                          }}
                        />

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddQty(product);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : (
                      /* Plain Price Box */
                      <div
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '6px 10px',
                          border: '1.5px dashed #334155',
                          borderRadius: '8px',
                          fontWeight: '700',
                          color: '#c5a059',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          background: 'rgba(0,0,0,0.1)',
                        }}
                      >
                        {formatCurrency(product.price)}
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
      <div 
        className="pg-bottom-bar" 
        style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: '#111827', 
          borderTop: '2px solid #242b3d', 
          padding: '16px 28px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          zIndex: 100,
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Selected Items ({totalItemsCount})</span>
          <strong style={{ fontSize: '20px', color: '#ffffff', fontFamily: 'monospace' }}>
            {formatCurrency(totalCost)}
          </strong>
        </div>

        <button
          onClick={handleNextClick}
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, #c5a059, #b48c41)',
            borderColor: 'transparent',
            boxShadow: '0 4px 14px rgba(197, 160, 89, 0.25)',
            color: '#1a1f2e',
            fontWeight: '800',
            fontSize: '15px',
            borderRadius: '12px',
            height: '46px',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          NEXT
          <Check size={18} />
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => setShowAddProductModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#242b3d',
              border: '1px solid #334155',
              borderRadius: '20px',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>Add New Custom Product</span>
              <button
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Product Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Product Name *</label>
                <input
                  type="text"
                  placeholder="Enter custom product name..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  required
                  style={{ height: '42px', borderRadius: '8px', background: '#1a1f2e', border: '1.5px solid #334155', color: '#ffffff', padding: '0 12px' }}
                />
              </div>

              {/* Price & Unit side-by-side */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    required
                    style={{ height: '42px', borderRadius: '8px', background: '#1a1f2e', border: '1.5px solid #334155', color: '#ffffff', padding: '0 12px' }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Unit</label>
                  <select
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: '#1a1f2e', border: '1.5px solid #334155', color: '#ffffff', padding: '0 12px' }}
                  >
                    <option value="bag">bag (बोरी)</option>
                    <option value="kg">kg (किलोग्राम)</option>
                    <option value="g">g (ग्राम)</option>
                    <option value="ltr">ltr (लीटर)</option>
                    <option value="ml">ml (मिलाई)</option>
                    <option value="pcs">pcs (पीस)</option>
                    <option value="box">box (डिब्बा)</option>
                    <option value="quintal">quintal (क्विंटल)</option>
                    <option value="ton">ton (टन)</option>
                    <option value="mtr">mtr (मीटर)</option>
                    <option value="dozen">dozen (दर्जन)</option>
                    <option value="pkt">pkt (पैकेट)</option>
                    <option value="strip">strip (स्ट्रिप)</option>
                  </select>
                </div>
              </div>

              {/* Category & GST side-by-side */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Category</label>
                  <input
                    type="text"
                    placeholder="Category name..."
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: '#1a1f2e', border: '1.5px solid #334155', color: '#ffffff', padding: '0 12px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>GST %</label>
                  <select
                    value={newProductGst}
                    onChange={(e) => setNewProductGst(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: '#1a1f2e', border: '1.5px solid #334155', color: '#ffffff', padding: '0 12px' }}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn btn-outline"
                  style={{ height: '40px', borderRadius: '8px', borderColor: '#334155', background: 'transparent', color: '#94a3b8' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '40px', borderRadius: '8px', background: '#059669', color: '#ffffff', border: 'none' }}
                >
                  Add Item
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
