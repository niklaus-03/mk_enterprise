import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { productApi, productListApi } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { ArrowLeft, Search, X, Plus, Minus, Package, ShoppingCart, Check, PenTool, Scale, Sparkles, AlertTriangle, Trash2, FolderOpen } from 'lucide-react';
import UnitInput from '../shared/UnitInput';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../utils/api';

export default function ProductGridStep({
  selectedCustomer = null,
  walkInData = null,
  initialItems = [],
  selectedManager = null,
  onNext,
  onBack,
  onSaveDraft,
  onConvertToOrder,
  onCancel,
  gstEnabled = true,
  draftsCount = 0,
  onShowDrafts,
}) {
  const { t, settings } = useApp();
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

  const emptyForm = {
    name: '', price: '', gst: '0', unit: 'bag', stock: '0',
    weight_per_unit: '', suggested_price: '', custom_low_stock: '', supplier_base_price: 0, last_delivery_final_price: 0, is_active: true,
    has_loose: false, loose_stock: '0', loose_unit: '', loose_conversion_factor: '', loose_price: ''
  };
  const [form, setForm] = useState(emptyForm);
  const [nameFocused, setNameFocused] = useState(false);
  const [priceCalculated, setPriceCalculated] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(null);

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
          const isLoose = item.is_loose;
          const current = newMap.get(item.product_id) || {
            product_id: item.product_id,
            product_name: item.product_name || item.name,
            qty: 0,
            price: 0,
            gst: parseFloat(item.gst) || 0,
            unit: 'bag',
            stock: parseFloat(item.stock) || 0,
            weight_per_unit: item.weight_per_unit || '',
            _isNew: item._isNew || false,
            loose_qty: 0,
            show_loose_stepper: false,
            has_loose: item.has_loose || isLoose, // best effort guess until products load
          };

          if (isLoose) {
            current.loose_qty = parseFloat(item.qty) || 0;
            current.loose_price = parseFloat(item.price) || 0;
            current.loose_unit = item.unit || 'pkt';
            current.show_loose_stepper = true;
          } else {
            current.qty = parseFloat(item.qty) || 0;
            current.price = parseFloat(item.price) || 0;
            current.unit = item.unit || 'bag';
          }
          
          newMap.set(item.product_id, current);
        }
      });
      setSelectedItems(newMap);
    }
  }, [initialItems]);

  // Handle adding product qty
  const handleAddQty = useCallback((product, isLoose = false) => {
    const id = product._id;
    const current = selectedItems.get(id);
    const newMap = new Map(selectedItems);

    if (current) {
      if (isLoose) {
        newMap.set(id, { ...current, loose_qty: (parseFloat(current.loose_qty) || 0) + 1, show_loose_stepper: true });
      } else {
        newMap.set(id, { ...current, qty: (parseFloat(current.qty) || 0) + 1 });
      }
    } else {
      newMap.set(id, {
        product_id: id,
        product_name: product.name,
        qty: isLoose ? 0 : 1,
        price: parseFloat(product.price) || 0,
        gst: gstEnabled ? (parseFloat(product.gst) || 0) : 0,
        unit: product.unit || 'bag',
        stock: parseFloat(product.stock) || 0,
        weight_per_unit: product.weight_per_unit || '',
        has_loose: product.has_loose,
        loose_price: parseFloat(product.loose_price) || 0,
        loose_unit: product.loose_unit || 'pkt',
        loose_name: product.loose_name || '',
        loose_stock: parseFloat(product.loose_stock) || 0,
        loose_conversion_factor: parseFloat(product.loose_conversion_factor) || 1,
        loose_qty: isLoose ? 1 : 0,
        show_loose_stepper: isLoose,
        _isNew: false,
      });
    }
    setSelectedItems(newMap);
  }, [selectedItems, gstEnabled]);

  // Handle subtracting product qty
  const handleSubQty = useCallback((product, isLoose = false) => {
    const id = product._id;
    const current = selectedItems.get(id);
    if (!current) return;

    const newMap = new Map(selectedItems);
    if (isLoose) {
      const parsed = parseFloat(current.loose_qty) || 0;
      if (parsed <= 1 && (parseFloat(current.qty) || 0) <= 0) {
        newMap.delete(id);
      } else if (parsed <= 1) {
        newMap.set(id, { ...current, loose_qty: 0, show_loose_stepper: false });
      } else {
        newMap.set(id, { ...current, loose_qty: Math.max(0, parsed - 1) });
      }
    } else {
      const parsedQty = parseFloat(current.qty) || 0;
      if (parsedQty <= 1 && (!current.show_loose_stepper && (parseFloat(current.loose_qty) || 0) <= 0)) {
        newMap.delete(id);
      } else {
        newMap.set(id, { ...current, qty: Math.max(0, parsedQty - 1) });
      }
    }
    setSelectedItems(newMap);
  }, [selectedItems]);

  // Handle direct qty change
  const handleQtyChange = useCallback((product, value, isLoose = false) => {
    let cleanValue = value;
    if (typeof cleanValue === 'string') {
      cleanValue = cleanValue.replace(/^0+(?=\d)/, '');
    }

    const id = product._id;
    const newMap = new Map(selectedItems);

    let current = selectedItems.get(id);
    if (!current) {
        current = {
          product_id: id,
          product_name: product.name,
          qty: 0,
          price: parseFloat(product.price) || 0,
          gst: gstEnabled ? (parseFloat(product.gst) || 0) : 0,
          unit: product.unit || 'bag',
          stock: parseFloat(product.stock) || 0,
          weight_per_unit: product.weight_per_unit || '',
          has_loose: product.has_loose,
          loose_price: parseFloat(product.loose_price) || 0,
          loose_unit: product.loose_unit || 'pkt',
          loose_name: product.loose_name || '',
          loose_stock: parseFloat(product.loose_stock) || 0,
          loose_conversion_factor: parseFloat(product.loose_conversion_factor) || 1,
          loose_qty: 0,
          show_loose_stepper: isLoose,
          _isNew: false,
        };
    }
    
    if (isLoose) {
       current = { ...current, loose_qty: cleanValue, show_loose_stepper: true };
    } else {
       current = { ...current, qty: cleanValue };
    }
    
    newMap.set(id, current);
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
      const taxable = (item.qty || 0) * item.price;
      const gstAmt = gstEnabled ? (taxable * item.gst) / 100 : 0;
      sum += taxable + gstAmt;
      
      if (item.loose_qty > 0) {
        const looseTaxable = item.loose_qty * (item.loose_price || 0);
        const looseGstAmt = gstEnabled ? (looseTaxable * item.gst) / 100 : 0;
        sum += looseTaxable + looseGstAmt;
      }
    });
    return sum;
  }, [selectedItems, gstEnabled]);

  const totalItemsCount = useMemo(() => {
    let count = 0;
    selectedItems.forEach(item => {
      count += (item.qty || 0);
      if (item.loose_qty > 0) count += item.loose_qty;
    });
    return count;
  }, [selectedItems]);

  const getExpandedItems = () => {
    const expanded = [];
    for (const item of selectedItems.values()) {
      if ((item.qty || 0) > 0) {
        expanded.push({ ...item, is_loose: false, loose_qty: undefined });
      }
      if ((item.loose_qty || 0) > 0) {
        expanded.push({
          ...item,
          product_name: item.loose_name ? `${item.product_name} (${item.loose_name})` : `${item.product_name} (Loose)`,
          is_loose: true,
          qty: item.loose_qty,
          price: item.loose_price,
          unit: item.loose_unit,
          loose_qty: undefined
        });
      }
    }
    return expanded;
  };

  const handleSaveDraftClick = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item');
      return;
    }
    onSaveDraft(getExpandedItems());
  };

  const handleNextClick = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item');
      return;
    }

    let hasError = false;
    for (const item of selectedItems.values()) {
      // Auto-Open Box Prompt
      if (item.has_loose && (item.loose_qty || 0) > (item.loose_stock || 0)) {
        const neededPackets = item.loose_qty - item.loose_stock;
        const conversionFactor = item.loose_conversion_factor || 1;
        const boxesNeeded = Math.ceil(neededPackets / conversionFactor);

        const confirmed = await new Promise((resolve) => {
          setConfirmPrompt({
            title: 'Insufficient loose stock',
            message: `Insufficient loose stock for ${item.product_name}.\n\nDo you want to auto-open ${boxesNeeded} ${item.unit}(s) to get more packets?`,
            onConfirm: () => { setConfirmPrompt(null); resolve(true); },
            onCancel: () => { setConfirmPrompt(null); resolve(false); }
          });
        });

        if (confirmed) {
          try {
            await productApi.openBox(item.product_id, { qty: boxesNeeded });
            // Update local state to reflect the opened boxes
            item.stock -= boxesNeeded;
            item.loose_stock += (boxesNeeded * conversionFactor);
            toast.success(`Opened ${boxesNeeded} ${item.unit}(s) of ${item.product_name}`);
          } catch (err) {
            toast.error(`Failed to open box for ${item.product_name}: ${err.message}`);
            hasError = true;
          }
        } else {
          hasError = true;
        }
      }

      if (user?.role === 'walkin_manager') {
        if ((item.qty || 0) > item.stock) {
          toast.error(`Insufficient bulk amount selected in ${item.product_name}`, { position: 'top-center' });
          hasError = true;
        }
      }
    }
    
    if (hasError) return;

    onNext(getExpandedItems());
  };

  // Inline Product Creation
  const [saving, setSaving] = useState(false);

  const calcSuggestedPrice = () => {
    const base = parseFloat(form.supplier_base_price) || 0;
    const weight = parseFloat(form.weight_per_unit) || 0;
    const quintalCharge = parseFloat(settings?.tax_per_quintal) || 0;
    const gst = parseFloat(form.gst) || 0;

    if (!base) return toast.error('Enter base price first');

    const quintalAdj = weight > 0 && quintalCharge > 0
      ? (weight / 100) * quintalCharge
      : 0;
    const beforeGST = base + quintalAdj;
    const gstAmt = (beforeGST * gst) / 100;
    const suggested = parseFloat((beforeGST + gstAmt).toFixed(2));

    setForm(f => ({ ...f, suggested_price: String(suggested) }));
    setPriceCalculated(true);
    toast.success(`Suggested price: ₹${suggested}`, { duration: 2000 });
  };

  const handleAddProductSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) return toast.error('Product name required');
    if (!form.price || parseFloat(form.price) <= 0) return toast.error('Valid base price required');
    
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        gst: parseFloat(form.gst) || 0,
        unit: form.unit || 'bag',
        stock: parseFloat(form.stock) || 0,
        weight_per_unit: parseFloat(form.weight_per_unit) || 0,
        suggested_price: parseFloat(form.suggested_price) || 0,
        custom_low_stock: form.custom_low_stock !== '' ? parseFloat(form.custom_low_stock) : null,
        is_active: form.is_active,
        has_loose: form.has_loose,
        loose_stock: parseFloat(form.loose_stock) || 0,
        loose_price: parseFloat(form.loose_price) || 0,
        loose_unit: form.loose_unit,
        loose_conversion_factor: parseFloat(form.loose_conversion_factor) || 0,
        override_creator_id: selectedManager || undefined,
      };

      const newProd = await productApi.create(payload);
      toast.success('Product added successfully!');

      setProducts(prev => [newProd, ...prev]);

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

      setForm(emptyForm);
      setShowAddProductModal(false);
    } catch (err) {
      toast.error(err.message || 'Failed to add product');
    } finally {
      setSaving(false);
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
            <h1 className="page-title" style={{ margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {t('Select Items', 'सामान चुनें')}
              {draftsCount > 0 && (
                <button
                  type="button"
                  onClick={onShowDrafts}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--border)', border: '1.5px solid var(--border)',
                    borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                    transition: 'all 0.15s', height: 'fit-content',
                  }}
                >
                  <FolderOpen size={12} /> Drafts
                  <span style={{
                    background: 'var(--primary)', color: 'var(--bg-card)',
                    borderRadius: 10, padding: '1px 6px', fontSize: 10,
                  }}>
                    {draftsCount}
                  </span>
                </button>
              )}
            </h1>
            <p className="page-subtitle" style={{ margin: '2px 0 0 0', color: 'var(--text-muted)' }}>
              Customer: <strong style={{ color: 'var(--primary)' }}>{getCustomerDisplayName()}</strong>
            </p>
          </div>
        </div>

        {/* Persistent Search Bar in Header */}
        <div className="hide-on-mobile" style={{ flex: 1, margin: '0 32px', position: 'relative', maxWidth: '600px' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '46px',
              background: 'var(--bg-hover)',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
              paddingLeft: '44px',
              paddingRight: '40px',
              color: 'var(--text)',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Buttons Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

          <button
            onClick={() => setShowAddProductModal(true)}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              borderRadius: '10px',
              fontWeight: '800',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.4)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #34d399 0%, #10b981 100%)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            }}
          >
            <span style={{ fontSize: '18px', fontWeight: '900', lineHeight: 1 }}>+</span> 
            <span style={{ letterSpacing: '0.3px' }}>Item</span>
          </button>

          {onConvertToOrder && (
            <button
              onClick={onConvertToOrder}
              className="btn"
              style={{
                background: 'var(--info)',
                color: 'var(--bg-card)',
                borderRadius: '12px',
                fontWeight: '700',
                padding: '10px 16px',
              }}
            >
              CREATE ORDER
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                background: 'var(--danger-light)', border: '1.5px solid #fecaca',
                color: '#dc2626', transition: 'all 0.15s', height: 'fit-content',
              }}
            >
              <Trash2 size={14} />{t('Cancel Bill', 'बिल रद्द करें')}
            </button>
          )}

          <button
            onClick={handleSaveDraftClick}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              color: '#ffffff',
              borderRadius: '10px',
              fontWeight: '800',
              padding: '10px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              boxShadow: '0 4px 15px rgba(100, 116, 139, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(100, 116, 139, 0.4)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(100, 116, 139, 0.3)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
            }}
          >
            SAVE DRAFT
          </button>
        </div>
      </div>

        {/* Mobile Search (Collapsible) */}
        <div className="hide-on-desktop" style={{ width: '100%', marginTop: '12px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '44px',
              background: 'var(--bg-hover)',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              paddingLeft: '44px',
              paddingRight: '40px',
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

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
              background: selectedCategory === 'all' ? '#3b82f6' : 'var(--bg-hover)',
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
              const qty = selectedItem ? (selectedItem.qty || 0) : 0;
              const looseQty = selectedItem ? (selectedItem.loose_qty || 0) : 0;
              const totalQty = (parseFloat(qty) || 0) + (parseFloat(looseQty) || 0);
              const isOutOfStock = product.stock <= 0 && (!product.has_loose || product.loose_stock <= 0);

              return (
                <div
                  key={product._id}
                  className={`pg-product-card ${(qty > 0 || looseQty > 0) ? 'selected' : ''}`}
                  onClick={() => {
                    handleAddQty(product);
                  }}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: (qty > 0 || looseQty > 0) ? '2px solid var(--primary)' : '1px solid var(--border)',
                    padding: '16px',
                    position: 'relative',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '150px',
                    boxShadow: (qty > 0 || looseQty > 0) ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    opacity: isOutOfStock && totalQty === 0 ? 0.45 : 1,
                    transition: 'all 0.2s ease',
                  }}
                >
                  
                  {/* Top: Stock Circle / Badge */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: isOutOfStock ? 'var(--danger)' : 'var(--success)',
                      color: isOutOfStock ? 'var(--danger)' : 'var(--success)',
                      background: isOutOfStock ? 'var(--danger-light)' : 'var(--success-light)',
                      transition: 'all 0.3s'
                    }}
                  >
                    {(() => {
                      if (product.has_loose && (looseQty > 0 || selectedItem?.show_loose_stepper) && qty === 0) {
                        return `${t('Stock:', 'स्टॉक:')} ${product.loose_stock} ${product.loose_unit}`;
                      } else if (qty > 0 && (looseQty === 0 && !selectedItem?.show_loose_stepper)) {
                        return `${t('Stock:', 'स्टॉक:')} ${product.stock} ${product.unit}`;
                      } else {
                        return `${t('Stock:', 'स्टॉक:')} ${product.stock} ${product.unit} ${product.has_loose ? `+ ${product.loose_stock} ${product.loose_unit}` : ''}`;
                      }
                    })()}
                  </div>

                  {/* Quantity Indicator in center if selected */}
                  {totalQty > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        background: 'var(--primary)',
                        color: 'var(--bg-card)',
                        width: 'auto',
                        minWidth: '24px',
                        padding: '0 6px',
                        height: '24px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '12px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {totalQty}
                    </div>
                  )}

                  {/* Center: Product Title & Unit */}
                  <div style={{ marginTop: '24px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', transition: 'all 0.3s' }}>
                      {(product.has_loose && (looseQty > 0 || selectedItem?.show_loose_stepper) && qty === 0) ? (product.loose_name || 'Loose') : product.name}
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.3s' }}>
                      {(product.has_loose && (looseQty > 0 || selectedItem?.show_loose_stepper) && qty === 0) ? product.loose_unit : `${product.unit} ${product.weight_per_unit > 0 ? `(${product.weight_per_unit}kg)` : ''}`}
                    </div>
                  </div>

                  {/* Bottom: Stepper and Price */}
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    
                    {/* Bulk Stepper */}
                    {(qty > 0 || !product.has_loose) ? (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1.5px solid var(--border)' }}
                      >
                        <div style={{ padding: '0 8px', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', width: '35px', textAlign: 'center' }}>{product.unit}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubQty(product, false);
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
                          onChange={(e) => handleQtyChange(product, e.target.value, false)}
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
                            handleAddQty(product, false);
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

                    {/* Loose Settings */}
                    {product.has_loose && selectedItem?.show_loose_stepper && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '10px', width: '100%', overflow: 'hidden', border: '1.5px dashed var(--primary)' }}
                      >
                        <div style={{ padding: '0 8px', fontSize: '10px', fontWeight: 800, color: 'var(--primary)', width: 'auto', minWidth: '35px', maxWidth: '80px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.loose_unit}</div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubQty(product, true);
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
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Minus size={13} />
                        </button>
                        
                        <input
                          type="number"
                          value={looseQty}
                          onChange={(e) => handleQtyChange(product, e.target.value, true)}
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
                            handleAddQty(product, true);
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
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                    
                    {/* Add Loose Button (shown when no loose qty yet) */}
                    {product.has_loose && (!selectedItem || !selectedItem.show_loose_stepper) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddQty(product, true);
                        }}
                        style={{
                           width: '100%',
                           padding: '6px',
                           borderRadius: '10px',
                           border: '1.5px dashed var(--primary)',
                           background: 'transparent',
                           color: 'var(--primary)',
                           fontSize: '11px',
                           fontWeight: '700',
                           cursor: 'pointer'
                        }}
                      >
                        + ADD {product.loose_name ? product.loose_name.toUpperCase() : 'LOOSE'} ({product.loose_unit})
                      </button>
                    )}

                    {/* Always show Price Box (editable if selected and not temp_manager) */}
                    {editingPriceFor === product._id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: 'var(--bg-card)', borderRadius: '12px', border: '1.5px solid var(--primary)', zIndex: 10, position: 'relative', boxShadow: 'var(--shadow-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input 
                            type="text"
                            inputMode="decimal"
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
                            style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '6px 2px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', background: 'var(--bg-hover)', color: 'var(--text)', outline: 'none' }}
                          />
                          {gstEnabled && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>+</span>}
                          {gstEnabled && (
                            <select
                              value={tempGst !== '' ? tempGst : (selectedItem ? selectedItem.gst : product.gst)}
                              onChange={e => setTempGst(e.target.value)}
                              style={{ width: '42px', flexShrink: 0, textAlign: 'center', padding: '6px 0px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', background: 'var(--bg-hover)', color: 'var(--text)', outline: 'none', cursor: 'pointer', appearance: 'none' }}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          )}
                          {gstEnabled && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>=</span>}
                          {gstEnabled && (
                            <input 
                              type="text"
                              inputMode="decimal"
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
                              style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '6px 2px', border: '1.5px solid var(--primary)', borderRadius: '6px', fontSize: '12px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 'bold', outline: 'none' }}
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
                          style={{ width: '100%', padding: '6px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
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
                          border: (qty > 0 && user?.role !== 'temp_manager') ? '1.5px solid var(--primary)' : '1.5px dashed var(--border)',
                          borderRadius: '8px',
                          fontWeight: '700',
                          color: (qty > 0 && user?.role !== 'temp_manager') ? 'var(--primary)' : 'var(--text-muted)',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          background: (qty > 0 && user?.role !== 'temp_manager') ? 'var(--primary-light)' : 'var(--bg-hover)',
                          cursor: (qty > 0 && user?.role !== 'temp_manager') ? 'pointer' : 'default',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={(qty > 0 && user?.role !== 'temp_manager') ? "Click to edit price" : ""}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                          <div>
                            {formatCurrency(selectedItem ? selectedItem.price : product.price)} <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>/ {product.unit}</span>
                            {(totalQty > 0 && user?.role !== 'temp_manager') && (
                              <PenTool size={10} style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'baseline' }} />
                            )}
                          </div>
                          {product.has_loose && (
                            <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                              {product.loose_name ? product.loose_name : 'Loose'}: {formatCurrency(product.loose_price)} <span style={{opacity: 0.8}}>/ {product.loose_unit}</span>
                            </div>
                          )}
                        </div>
                        {(gstEnabled && (selectedItem ? selectedItem.gst : product.gst) > 0) && (
                          <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 'bold', marginTop: '4px' }}>
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
          style={{
            background: 'linear-gradient(135deg, #4f8cf6, #3b82f6)',
            border: 'none',
            boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
            color: '#fff',
            fontWeight: '800',
            fontSize: '16px',
            letterSpacing: '0.5px',
            borderRadius: '14px',
            height: '52px',
            padding: '0 40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.45)';
          }}
        >
          NEXT
          <Check size={20} />
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.60)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            overflowY: 'auto'
          }}
          onMouseDown={() => setShowAddProductModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--sidebar-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '16px', color: 'var(--text)' }}>
                <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}><Package size={18} /></span>
                <span>Add New Custom Product</span>
              </div>
              <button
                onClick={() => setShowAddProductModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddProductSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px' }}>
                {/* Product Name */}
                <div style={{ gridColumn: 'span 12', position: 'relative' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Product Name *</label>
                  <input
                    className="form-control"
                    placeholder="Enter custom product name..."
                    value={form.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const capitalized = val.replace(/\b[a-zA-Z]/g, c => c.toUpperCase());
                      setForm(f => ({ ...f, name: capitalized }));
                    }}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setTimeout(() => setNameFocused(false), 200)}
                    required
                    autoFocus
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.2s' }}
                  />
                  {nameFocused && form.name && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                      background: 'var(--bg-card)', border: '1px solid var(--border)', 
                      borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      display: Array.from(new Set(products.map(p => p.name))).filter(name => name.toLowerCase().includes(form.name.toLowerCase()) && name.toLowerCase() !== form.name.toLowerCase()).length > 0 ? 'block' : 'none'
                    }}>
                      {Array.from(new Set(products.map(p => p.name)))
                        .filter(name => name.toLowerCase().includes(form.name.toLowerCase()) && name.toLowerCase() !== form.name.toLowerCase())
                        .map(name => (
                          <div 
                            key={name}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: 'var(--text)' }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm(f => ({ ...f, name }));
                              setNameFocused(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {name}
                          </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unit */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Unit</label>
                  <UnitInput value={form.unit} onChange={v => setForm(f => ({ ...f, unit: v }))} />
                </div>

                {/* Weight per Unit */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Weight per Unit (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 50"
                    value={form.weight_per_unit}
                    onChange={(e) => { setForm(f => ({ ...f, weight_per_unit: e.target.value })); setPriceCalculated(false); }}
                    className="form-control"
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>Used for quintal price calculation</div>
                </div>

                {/* Final Selling Price */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Final Selling Price ₹ *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => { setForm(f => ({ ...f, price: e.target.value })); setPriceCalculated(false); }}
                    onFocus={e => { if (form.price === '0') setForm(f => ({ ...f, price: '' })); }}
                    onBlur={e => { if (form.price === '') setForm(f => ({ ...f, price: '0' })); }}
                    className="form-control"
                    required
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>

                {/* GST % */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>GST %</label>
                  <select
                    value={form.gst}
                    onChange={(e) => { setForm(f => ({ ...f, gst: e.target.value })); setPriceCalculated(false); }}
                    className="form-control"
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                {/* Suggested Final Price */}
                <div style={{ gridColumn: 'span 12' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px' }}>
                    <span>Suggested Final Price ₹</span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, borderColor: '#6366f1', color: '#6366f1', background: '#f5f3ff', borderRadius: 6, fontWeight: 600 }}
                      onClick={calcSuggestedPrice}
                    >
                      <Sparkles size={11} fill="#6366f1" /> Calculate
                    </button>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Auto-calculated or manual"
                    value={form.suggested_price}
                    onChange={(e) => { setForm(f => ({ ...f, suggested_price: e.target.value })); setPriceCalculated(true); }}
                    className="form-control"
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Formula: Base + (Weight ÷ 100 × Quintal Charge) + GST.
                  </div>
                </div>

                {/* Current Stock */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Current Stock</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.stock}
                    onChange={e => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                        val = val.replace(/^0+/, '');
                      }
                      if (val === '') val = '0';
                      setForm(f => ({ ...f, stock: val }));
                    }}
                    onFocus={e => { if (form.stock === '0') setForm(f => ({ ...f, stock: '' })); }}
                    onBlur={e => { if (form.stock === '') setForm(f => ({ ...f, stock: '0' })); }}
                    className="form-control"
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>

                {/* Custom Low Stock Alert */}
                <div style={{ gridColumn: 'span 6' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', display: 'block' }}>Custom Low Stock Alert</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={`Global: ${settings?.low_stock_threshold || 10}`}
                    value={form.custom_low_stock}
                    onChange={(e) => setForm(f => ({ ...f, custom_low_stock: e.target.value }))}
                    className="form-control"
                    style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>Leave blank to use global threshold ({settings?.low_stock_threshold || 10})</div>
                </div>

                {/* Sell in Loose Toggle */}
                <div style={{ gridColumn: 'span 12', marginTop: 8 }}>
                  <div style={{ background: form.has_loose ? '#f5f3ff' : 'var(--bg-hover)', border: form.has_loose ? '1.5px solid #8b5cf6' : '1px solid var(--border)', padding: '16px', borderRadius: '12px', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: form.has_loose ? '#8b5cf6' : '#94a3b8', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <Scale size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: form.has_loose ? '#6d28d9' : 'var(--text)', fontSize: 14 }}>
                            Sell in loose quantities?
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Enable this to track both bulk stock and opened loose stock.
                          </div>
                        </div>
                      </div>
                      
                      {/* Toggle Switch */}
                      <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, margin: 0, cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={form.has_loose}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setForm(f => ({ ...f, has_loose: checked }));
                          }}
                          style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: form.has_loose ? '#8b5cf6' : '#cbd5e1', transition: '.4s', borderRadius: 24 }}>
                          <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: form.has_loose ? 22 : 3, bottom: 3, backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                        </span>
                      </label>
                    </div>

                    {/* Loose Settings */}
                    {form.has_loose && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #c4b5fd', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 4, display: 'block' }}>Loose Unit</label>
                          <UnitInput value={form.loose_unit} onChange={v => setForm(f => ({ ...f, loose_unit: v }))} placeholder="e.g. pkt" />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 4, display: 'block' }}>Items per Box (Factor)</label>
                          <input type="number" min="1" className="form-control" placeholder={`e.g. 50 (if 1 ${form.unit || 'box'} = 50 loose units)`} value={form.loose_conversion_factor} onChange={e => setForm(f => ({ ...f, loose_conversion_factor: e.target.value }))} style={{ borderRadius: 8, borderColor: '#c4b5fd' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 4, display: 'block' }}>Current Loose Stock</label>
                          <input type="number" min="0" className="form-control" placeholder="Current loose stock" value={form.loose_stock} onChange={e => setForm(f => ({ ...f, loose_stock: e.target.value }))} style={{ borderRadius: 8, borderColor: '#c4b5fd' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 4, display: 'block' }}>Loose Selling Price (₹)</label>
                          <input type="number" min="0" step="0.01" className="form-control" placeholder="Price per unit" value={form.loose_price} onChange={e => setForm(f => ({ ...f, loose_price: e.target.value }))} style={{ borderRadius: 8, borderColor: '#c4b5fd' }} />
                        </div>
                        
                        {form.loose_price && form.loose_conversion_factor && form.supplier_base_price > 0 && 
                         (parseFloat(form.loose_price) * parseFloat(form.loose_conversion_factor) < parseFloat(form.supplier_base_price)) && (
                          <div style={{ gridColumn: 'span 2', marginTop: 4, padding: '8px 12px', background: '#fef3c7', color: '#b45309', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
                            ⚠️ Warning: Your loose selling price total is lower than the bulk cost price (₹{form.supplier_base_price})!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn btn-outline"
                  style={{ display: 'inline-flex', alignItems: 'center', height: '40px', borderRadius: '8px', borderColor: 'var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', height: '40px', borderRadius: '8px', background: '#059669', color: '#ffffff', border: 'none' }}
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text)' }}>{confirmPrompt.title}</h3>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{confirmPrompt.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={confirmPrompt.onCancel} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--bg-hover)', color: 'var(--text)', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
              <button onClick={confirmPrompt.onConfirm} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>OK</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
