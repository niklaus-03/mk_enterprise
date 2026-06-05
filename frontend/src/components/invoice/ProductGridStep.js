import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { productApi, productListApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, Plus, Minus, Package, ShoppingCart, Check, PenTool } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../utils/api';

export default function ProductGridStep({
  selectedCustomer = null,
  walkInData = null,
  initialItems = [],
  onNext,
  onBack,
  onSaveDraft,
  onConvertToOrder,
  onCancel,
  gstEnabled = true,
}) {
  const { t } = useApp();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [itemLists, setItemLists] = useState([]);

  // Map of product_id -> item details
  const [selectedItems, setSelectedItems] = useState(new Map());
  const [editingPriceFor, setEditingPriceFor] = useState(null);
  const [tempPrice, setTempPrice] = useState('');
  const [tempGst, setTempGst] = useState('');

  // Add Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('bag');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductGst, setNewProductGst] = useState('0');
  const [newProductWeight, setNewProductWeight] = useState('');

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

    productListApi.getAll().then(lists => {
      setItemLists(Array.isArray(lists) ? lists : []);
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

  const handlePriceChange = useCallback((productId, newPrice, newGst) => {
    const current = selectedItems.get(productId);
    if (!current) return;
    const newMap = new Map(selectedItems);
    const updates = { price: parseFloat(newPrice) || 0 };
    if (newGst !== undefined) updates.gst = parseFloat(newGst) || 0;
    newMap.set(productId, { ...current, ...updates });
    setSelectedItems(newMap);
  }, [selectedItems]);

  // Filter products by category, item list and search
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Category / Item List filter      // 2) Handle Item Lists vs Unmarked vs Categories
      if (selectedCategory.startsWith('list_')) {
        const listId = selectedCategory.replace('list_', '');
        const list = itemLists.find(l => l._id === listId);
        if (list && list.products) {
          const listProductIds = list.products.map(prod => prod._id);
          if (!listProductIds.includes(p._id)) return false;
        } else {
          return false;
        }
      } else if (selectedCategory === 'unmarked') {
        const allListProductIds = new Set();
        itemLists.forEach(l => l.products?.forEach(prod => allListProductIds.add(prod._id)));
        if (allListProductIds.has(p._id)) return false;
      } else if (selectedCategory !== 'all') {
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
  }, [products, selectedCategory, searchQuery, itemLists]);

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

  // Item List product counts
  const itemListCounts = useMemo(() => {
    const counts = {};
    const allListProductIds = new Set();
    itemLists.forEach(l => {
      counts[l._id] = 0;
      l.products?.forEach(prod => allListProductIds.add(prod._id));
    });
    let unmarkedCount = 0;
    products.forEach(p => {
      let inAnyList = false;
      itemLists.forEach(l => {
        if (l.products?.map(prod => prod._id).includes(p._id)) {
          counts[l._id]++;
          inAnyList = true;
        }
      });
      if (!inAnyList) unmarkedCount++;
    });
    return { ...counts, unmarked: unmarkedCount };
  }, [products, itemLists]);

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

    if (user?.role === 'walkin_manager') {
      let hasError = false;
      for (const item of selectedItems.values()) {
        if (item.qty > item.stock) {
          toast.error(`Insufficient amount selected in ${item.product_name}`, { position: 'top-center' });
          notificationApi.create({
            title: "Stock Override Attempt",
            message: `${user?.username} tried to invoice ${item.qty} of ${item.product_name} but only has ${item.stock} in vehicle.`,
            type: "warning"
          }).catch(err => console.error('Notification failed', err));
          hasError = true;
        }
      }
      if (hasError) return;
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
        weight_per_unit: parseFloat(newProductWeight) || 0,
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
      setNewProductWeight('');
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
    <div className="pg-container">
      
      {/* Header */}
      <div className="pg-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #242b3d', paddingBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBack}
            className="btn btn-outline" 
            style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--bg-hover)', color: 'var(--text)', background: 'var(--bg-hover)' }}
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title" style={{ margin: 0, color: 'var(--text)' }}>{t('Select Items', 'सामान चुनें')}</h1>
            <p className="page-subtitle" style={{ margin: '2px 0 0 0', color: 'var(--text-muted)' }}>
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
          
          <button
            onClick={() => setShowAddProductModal(true)}
            className="btn"
            style={{
              background: '#059669',
              color: 'var(--bg-card)',
              borderRadius: '12px',
              fontWeight: '700',
              padding: '10px 16px',
            }}
          >
            + Item
          </button>

          {onConvertToOrder && (
            <button
              onClick={onConvertToOrder}
              className="btn"
              style={{
                background: '#3b82f6',
                color: 'var(--bg-card)',
                borderRadius: '12px',
                fontWeight: '700',
                padding: '10px 16px',
              }}
            >
              CREATE ORDER
            </button>
          )}

          <button
            onClick={handleSaveDraftClick}
            className="btn"
            style={{
              background: 'var(--text-muted)',
              color: 'var(--bg-card)',
              borderRadius: '12px',
              fontWeight: '700',
              padding: '10px 16px',
            }}
          >
            SAVE DRAFT
          </button>
        </div>
      </div>

      {/* Search Input Panel (Collapsible) */}
      {showSearch && (
        <div style={{ padding: '12px 0', borderBottom: '1px solid #242b3d', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                background: 'var(--bg-hover)',
                border: '1.5px solid #334155',
                borderRadius: '10px',
                paddingLeft: '44px',
                paddingRight: '40px',
                color: 'var(--text)',
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
                  color: 'var(--text-muted)',
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
      <div className="pg-workspace">
        
        {/* Left Sidebar - Categories */}
        <div className="pg-category-sidebar">
          {/* All Items */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`pg-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: selectedCategory === 'all' ? 'var(--primary)' : 'var(--bg-hover)',
              color: selectedCategory === 'all' ? '#ffffff' : 'var(--text)',
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
            <span>{t('All Items', 'सभी सामान')}</span>
            <span style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '10px' }}>
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
                  background: isActive ? 'var(--primary)' : 'var(--bg-hover)',
                  color: isActive ? '#ffffff' : 'var(--text)',
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
                <span style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '10px' }}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Item Lists */}
          {itemLists.length > 0 && (
            <div style={{ marginTop: '8px', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', paddingLeft: '4px' }}>
              Item Lists
            </div>
          )}
          {itemLists.map(list => {
            const isActive = selectedCategory === `list_${list._id}`;
            const count = itemListCounts[list._id] || 0;
            return (
              <button
                key={list._id}
                onClick={() => setSelectedCategory(`list_${list._id}`)}
                className={`pg-category-item ${isActive ? 'active' : ''}`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isActive ? 'var(--primary)' : 'var(--bg-hover)',
                  color: isActive ? '#ffffff' : 'var(--text)',
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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>{list.name}</span>
                <span style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '10px' }}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* Unmarked Items */}
          <button
            onClick={() => setSelectedCategory('unmarked')}
            className={`pg-category-item ${selectedCategory === 'unmarked' ? 'active' : ''}`}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: selectedCategory === 'unmarked' ? 'var(--primary)' : 'var(--bg-hover)',
              color: selectedCategory === 'unmarked' ? '#ffffff' : 'var(--text)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: '600',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              transition: 'all 0.2s',
              marginTop: itemLists.length > 0 ? '0' : '8px'
            }}
          >
            <span>{t('Unmarked', 'अनमार्क')}</span>
            <span style={{ fontSize: '11px', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '10px' }}>
              {itemListCounts.unmarked}
            </span>
          </button>
        </div>

        {/* Right Main Grid - Products */}
        <div className="pg-product-grid">
          {filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Package size={48} style={{ strokeWidth: '1.5', marginBottom: '12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text)' }}>No items found</h3>
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
                    handleAddQty(product);
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid #c5a059' : '1px solid var(--border)',
                    padding: '16px',
                    position: 'relative',
                    cursor: 'pointer',
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
                    {t('Stock:', 'स्टॉक:')} {product.stock}
                  </div>

                  {/* Quantity Indicator in center if selected */}
                  {qty > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: '#c5a059',
                        color: 'var(--bg-card)',
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
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {product.name}
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      {product.unit} {product.weight_per_unit > 0 ? `(${product.weight_per_unit}kg)` : ''}
                    </div>
                  </div>

                  {/* Bottom: Stepper and Price */}
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {qty > 0 ? (
                      /* Stepper controller */
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1.5px solid #334155' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubQty(product);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text)',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
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
                            color: 'var(--text)',
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
                            color: 'var(--text)',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    ) : null}

                    {/* Always show Price Box (editable if selected and not temp_manager) */}
                    {editingPriceFor === product._id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'var(--bg-card)', borderRadius: '12px', border: '1.5px solid #c5a059', zIndex: 10, position: 'relative', boxShadow: '0 4px 12px rgba(197, 160, 89, 0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', padding: '0 4px' }}>
                          <span style={{ flex: 1, textAlign: 'center' }}>Base</span>
                          {gstEnabled && <span style={{ flex: 1, textAlign: 'center' }}>GST %</span>}
                          {gstEnabled && <span style={{ flex: 1, textAlign: 'center' }}>Final</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input 
                            type="number"
                            autoFocus
                            placeholder="Base"
                            value={tempPrice !== '' ? tempPrice : (selectedItem ? selectedItem.price : product.price)}
                            onChange={e => setTempPrice(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                handlePriceChange(product._id, tempPrice, tempGst);
                                setEditingPriceFor(null);
                                setTempPrice('');
                                setTempGst('');
                              }
                            }}
                            style={{ flex: 1, width: 0, textAlign: 'center', padding: '6px 4px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-hover)', color: 'var(--text)', outline: 'none' }}
                          />
                          {gstEnabled && (
                            <select
                              value={tempGst !== '' ? tempGst : (selectedItem ? selectedItem.gst : product.gst)}
                              onChange={e => setTempGst(e.target.value)}
                              style={{ flex: 1, width: 0, textAlign: 'center', padding: '6px 0', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-hover)', color: 'var(--text)', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          )}
                          {gstEnabled && (
                            <input 
                              type="number"
                              placeholder="Final"
                              value={
                                tempPrice !== '' 
                                  ? ((parseFloat(tempPrice) || 0) * (1 + (tempGst !== '' ? parseFloat(tempGst) : (selectedItem ? selectedItem.gst : product.gst)) / 100)).toFixed(2) 
                                  : ((selectedItem ? selectedItem.price : product.price) * (1 + (tempGst !== '' ? parseFloat(tempGst) : (selectedItem ? selectedItem.gst : product.gst)) / 100)).toFixed(2)
                              }
                              onChange={e => {
                                const final = parseFloat(e.target.value) || 0;
                                const currentGst = tempGst !== '' ? parseFloat(tempGst) : (selectedItem ? selectedItem.gst : product.gst);
                                const base = final / (1 + currentGst / 100);
                                setTempPrice(base.toFixed(2));
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handlePriceChange(product._id, tempPrice, tempGst);
                                  setEditingPriceFor(null);
                                  setTempPrice('');
                                  setTempGst('');
                                }
                              }}
                              style={{ flex: 1, width: 0, textAlign: 'center', padding: '6px 4px', border: '1.5px solid #c5a059', borderRadius: '6px', fontSize: '13px', background: 'rgba(197, 160, 89, 0.05)', color: '#c5a059', fontWeight: 'bold', outline: 'none' }}
                            />
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                             e.stopPropagation();
                             handlePriceChange(
                               product._id, 
                               tempPrice !== '' ? tempPrice : (selectedItem ? selectedItem.price : product.price),
                               tempGst !== '' ? tempGst : (selectedItem ? selectedItem.gst : product.gst)
                             );
                             setEditingPriceFor(null);
                             setTempPrice('');
                             setTempGst('');
                          }}
                          style={{ width: '100%', padding: '8px', background: '#c5a059', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2px', transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                          SAVE
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (qty > 0 && user?.role !== 'temp_manager') {
                            setEditingPriceFor(product._id);
                            setTempPrice(selectedItem ? selectedItem.price : product.price);
                            setTempGst(selectedItem ? selectedItem.gst : product.gst);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          padding: '6px 10px',
                          border: (qty > 0 && user?.role !== 'temp_manager') ? '1.5px solid #c5a059' : '1.5px dashed #334155',
                          borderRadius: '8px',
                          fontWeight: '700',
                          color: (qty > 0 && user?.role !== 'temp_manager') ? '#c5a059' : '#c5a059',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          background: (qty > 0 && user?.role !== 'temp_manager') ? 'rgba(197, 160, 89, 0.1)' : 'rgba(0,0,0,0.1)',
                          cursor: (qty > 0 && user?.role !== 'temp_manager') ? 'pointer' : 'default',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={(qty > 0 && user?.role !== 'temp_manager') ? "Click to edit price" : ""}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {formatCurrency(selectedItem ? selectedItem.price : product.price)}
                          {(qty > 0 && user?.role !== 'temp_manager') && (
                            <PenTool size={10} style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'baseline' }} />
                          )}
                        </div>
                        {(gstEnabled && (selectedItem ? selectedItem.gst : product.gst) > 0) && (
                          <div style={{ fontSize: '10px', color: '#059669', fontWeight: 'bold', marginTop: '4px' }}>
                            + {selectedItem ? selectedItem.gst : product.gst}% GST = {formatCurrency((selectedItem ? selectedItem.price : product.price) * (1 + (selectedItem ? selectedItem.gst : product.gst) / 100))}
                          </div>
                        )}
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
      <div className="pg-bottom-bar">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Selected Items ({totalItemsCount})</span>
          <strong style={{ fontSize: '20px', color: 'var(--text)', fontFamily: 'monospace' }}>
            {formatCurrency(totalCost)}
          </strong>
        </div>

        <button
          onClick={handleNextClick}
          className="btn btn-primary"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'transparent',
            boxShadow: '0 4px 14px rgba(197, 160, 89, 0.25)',
            color: 'var(--text)',
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
            backgroundcolor: 'var(--text)',
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
              background: 'var(--bg-hover)',
              border: '1px solid #334155',
              borderRadius: '20px',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>Add New Custom Product</span>
              <button
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Product Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Product Name *</label>
                <input
                  type="text"
                  placeholder="Enter custom product name..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  required
                  style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px' }}
                />
              </div>

              {/* Price & Unit side-by-side */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Base Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    required
                    style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
                  />
                </div>
                
                {gstEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Final Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProductPrice ? (parseFloat(newProductPrice) * (1 + parseFloat(newProductGst || 0) / 100)).toFixed(2) : ''}
                      onChange={(e) => {
                        const final = parseFloat(e.target.value) || 0;
                        const base = final / (1 + parseFloat(newProductGst || 0) / 100);
                        setNewProductPrice(base ? base.toFixed(2) : '');
                      }}
                      style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #c5a059', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Category & GST side-by-side */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Category</label>
                  <input
                    type="text"
                    placeholder="Category name..."
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>GST %</label>
                  <select
                    value={newProductGst}
                    onChange={(e) => setNewProductGst(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Unit & Weight per Unit */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Unit</label>
                  <select
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>Weight / Unit (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 50 for a 50kg bag"
                    value={newProductWeight}
                    onChange={(e) => setNewProductWeight(e.target.value)}
                    style={{ height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1.5px solid #334155', color: 'var(--text)', padding: '0 12px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn btn-outline"
                  style={{ height: '40px', borderRadius: '8px', borderColor: 'var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '40px', borderRadius: '8px', background: '#059669', color: 'var(--bg-card)', border: 'none' }}
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
