import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { productListApi, productApi, managerApi } from '../utils/api';
import toast from 'react-hot-toast';
import { List, Plus, Trash2, Edit, Share2, Search, X, Package, CheckSquare, Square, AlertTriangle, Eye, User } from 'lucide-react';

export default function ProductLists() {
  const { t } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'supervisor';

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formProducts, setFormProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [listSearch, setListSearch] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [managers, setManagers] = useState([]);
  const [shareModal, setShareModal] = useState(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [shareOverrides, setShareOverrides] = useState([]);
  const [sharing, setSharing] = useState(false);
  
  const [viewListModal, setViewListModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    productListApi.getAll()
      .then(res => setLists(res))
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    productApi.getAll({}).then(setAllProducts).catch(e => console.error(e));
    if (isAdmin) {
      managerApi.getAll().then(res => setManagers(res.managers || [])).catch(e => console.error(e));
    }
  }, [load, isAdmin]);

  const openAdd = () => {
    setEditId(null);
    setFormName('');
    setFormProducts([]);
    setShowForm(true);
  };

  const openEdit = (list) => {
    setEditId(list._id);
    setFormName(list.name);
    setFormProducts(list.products.map(p => p._id));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return toast.error('List name required');
    if (formProducts.length === 0) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const payload = { name: formName.trim(), products: formProducts };
      if (editId) {
        await productListApi.update(editId, payload);
        toast.success('List updated');
      } else {
        await productListApi.create(payload);
        toast.success('List created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await productListApi.delete(deleteConfirmId);
      toast.success('List deleted');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setDeleteConfirmId(null); }
  };

  const toggleProduct = (productId) => {
    setFormProducts(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const openShare = (list) => {
    setShareModal(list);
    setSelectedManagerId('');
    // Initialize overrides mapping each product in the list
    setShareOverrides(list.products.map(p => ({
      product_id: p._id,
      is_excluded: false
    })));
  };

  const toggleShareOverride = (productId) => {
    setShareOverrides(prev => prev.map(o => 
      o.product_id === productId ? { ...o, is_excluded: !o.is_excluded } : o
    ));
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!selectedManagerId) return toast.error('Select a manager');
    setSharing(true);
    try {
      // Find if already shared to update overrides, or add new
      let newShares = [...shareModal.shares];
      const existingIdx = newShares.findIndex(s => s.manager_id?._id === selectedManagerId || s.manager_id === selectedManagerId);
      const shareObj = {
        manager_id: selectedManagerId,
        overrides: shareOverrides
      };
      
      if (existingIdx >= 0) {
        newShares[existingIdx] = shareObj;
      } else {
        newShares.push(shareObj);
      }
      
      await productListApi.share(shareModal._id, { shares: newShares });
      toast.success('List shared successfully');
      setShareModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSharing(false);
    }
  };

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredLists = lists.filter(l => 
    l.name.toLowerCase().includes(listSearch.toLowerCase())
  );

  return (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Create product groupings and share them with managers</div>
          <div className="flex gap-2">
            {showForm ? (
              <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>✕ Cancel</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Create List</button>
            )}
          </div>
        </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid #6366f1', boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.15)' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sidebar-bg)', borderBottom: '1.5px solid #e2e8f0' }}>
            <div style={{ background: editId ? 'var(--warning-light)' : 'var(--success-light)', color: editId ? '#d97706' : '#059669', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {editId ? <Edit size={16} /> : <Plus size={16} />}
            </div>
            <div className="card-title" style={{ margin: 0, fontWeight: 800 }}>
              {editId ? 'Edit Product List' : 'Create New Product List'}
            </div>
          </div>
          <div className="card-body" style={{ padding: '20px 24px' }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700 }}>List Name *</label>
              <input className="form-control" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Construction Materials" autoFocus />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                <span>Select Products ({formProducts.length} selected)</span>
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: 13, border: '1px solid #cbd5e1', borderRadius: 4, width: 200 }}
                />
              </label>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                {filteredProducts.map(p => (
                  <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={formProducts.includes(p._id)}
                      onChange={() => toggleProduct(p._id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>₹{p.price} / {p.unit}</span>
                    </div>
                  </label>
                ))}
                {filteredProducts.length === 0 && <div style={{ padding: 12, color: '#94a3b8', textAlign: 'center' }}>No products found</div>}
              </div>
            </div>

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>{t('Cancel', 'रद्द करें')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update List' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>All Item Lists</div>
            <span className="badge badge-primary">{filteredLists.length}</span>
          </div>
          <div style={{ position: 'relative', minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Search size={14} />
            </span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search lists..." 
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 13, borderRadius: 6, height: 32 }}
            />
          </div>
        </div>
        <div className="card-body no-pad">
          {loading ? (
            <div className="loading"><span className="spinner"></span></div>
          ) : lists.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ color: '#cbd5e1', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><List size={48} /></div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>No lists found</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: '800px', width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>List Name</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Items</th>
                    {isAdmin && <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Shared With</th>}
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLists.map((list) => {
                    const isOwner = list.created_by?._id === user._id || list.created_by === user._id;
                    const canEdit = isAdmin || isOwner;
                    
                    // For managers, we filter products based on overrides
                    let displayProducts = list.products;
                    if (!isAdmin) {
                      const shareConfig = list.shares.find(s => s.manager_id?._id === user._id || s.manager_id === user._id);
                      if (shareConfig) {
                        displayProducts = list.products.filter(p => {
                          const override = shareConfig.overrides.find(o => o.product_id === p._id || o.product_id?._id === p._id);
                          return !override || !override.is_excluded;
                        });
                      }
                    }

                    return (
                      <tr key={list._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--sidebar-bg)' }}>{list.name}</div>
                          {!isOwner && (
                            <div style={{ fontSize: 11, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, marginTop: 2 }}>
                              <User size={12} /> {isAdmin ? 'By:' : 'Shared by:'} {list.created_by?.display_name || list.created_by?.username}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {displayProducts.slice(0, 5).map(p => (
                              <span key={p._id} style={{ background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{p.name}</span>
                            ))}
                            {displayProducts.length > 5 && <span style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>+{displayProducts.length - 5} more</span>}
                          </div>
                        </td>
                        {isAdmin && (
                        <td style={{ padding: '10px 14px' }}>
                          {list.shares?.length > 0 ? (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {list.shares.map(s => (
                                <span key={s._id || s.manager_id?._id} style={{ fontSize: 12, background: 'var(--warning-light)', color: '#d97706', padding: '2px 6px', borderRadius: 4 }}>
                                  {s.manager_id?.display_name || s.manager_id?.username || 'Manager'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Not shared</span>
                          )}
                        </td>
                        )}
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setViewListModal({ list, displayProducts })} style={{ padding: '4px 8px' }}>
                              <Eye size={14} /> View
                            </button>
                            {canEdit && (
                              <>
                                {isAdmin && (
                                  <button className="btn btn-outline btn-sm" onClick={() => openShare(list)} style={{ color: '#3b82f6', borderColor: '#bfdbfe', padding: '4px 8px' }}>
                                    <Share2 size={14} /> Share
                                  </button>
                                )}
                                <button className="btn btn-outline btn-sm" onClick={() => openEdit(list)} style={{ padding: '4px 8px' }}>
                                  <Edit size={14} />
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(list._id)} style={{ color: '#ef4444', padding: '4px 8px' }}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {shareModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Share List: {shareModal.name}</h3>
              <button className="btn-close" onClick={() => setShareModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                Select a manager to share this list with, and toggle which products they can see.
              </p>
              <form onSubmit={handleShareSubmit}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Select Manager *</label>
                  <select 
                    className="form-control" 
                    value={selectedManagerId} 
                    onChange={e => {
                      setSelectedManagerId(e.target.value);
                      // Pre-fill existing overrides if this manager was already shared
                      const existingShare = shareModal.shares.find(s => s.manager_id?._id === e.target.value || s.manager_id === e.target.value);
                      if (existingShare) {
                        setShareOverrides(shareModal.products.map(p => {
                          const existingOverride = existingShare.overrides.find(o => o.product_id === p._id || o.product_id?._id === p._id);
                          return {
                            product_id: p._id,
                            is_excluded: existingOverride ? existingOverride.is_excluded : false
                          };
                        }));
                      } else {
                        // Reset to all included
                        setShareOverrides(shareModal.products.map(p => ({
                          product_id: p._id,
                          is_excluded: false
                        })));
                      }
                    }}
                    required
                  >
                    <option value="">-- Choose Manager --</option>
                    {managers.filter(m => m._id !== user._id).map(m => (
                      <option key={m._id} value={m._id}>{m.display_name || m.username}</option>
                    ))}
                  </select>
                </div>
                
                {selectedManagerId && (
                  <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Select Products to Share</span>
                      <div style={{ fontSize: 12, fontWeight: 'normal', color: 'var(--text-muted)' }}>Checked = Shared, Unchecked = Hidden</div>
                    </label>
                    <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
                      {shareModal.products.map(p => {
                        const override = shareOverrides.find(o => o.product_id === p._id);
                        const isShared = override ? !override.is_excluded : true;
                        return (
                          <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px', borderRadius: 6, background: isShared ? 'var(--success-light)' : 'var(--danger-light)', border: `1px solid ${isShared ? '#bbf7d0' : '#fecaca'}` }}>
                            <div onClick={() => toggleShareOverride(p._id)} style={{ color: isShared ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center' }}>
                              {isShared ? <CheckSquare size={18} /> : <Square size={18} />}
                            </div>
                            <span style={{ fontWeight: isShared ? 600 : 400, color: isShared ? '#166534' : '#991b1b' }}>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShareModal(null)}>{t('Cancel', 'रद्द करें')}</button>
                  <button type="submit" className="btn btn-primary" disabled={sharing}>
                    {sharing ? 'Saving...' : 'Save Sharing & Overrides'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ background: 'var(--danger-light)', color: '#ef4444', padding: 12, borderRadius: '50%' }}><AlertTriangle size={24} /></div>
              <div>
                <h3 style={{ margin: 0 }}>Delete List?</h3>
                <p style={{ margin: '8px 0', color: 'var(--text-muted)' }}>This action cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={() => setDeleteConfirmId(null)}>{t('Cancel', 'रद्द करें')}</button>
              <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={confirmDelete}>{t('Delete', 'हटाएं')}</button>
            </div>
          </div>
        </div>
      )}

      {viewListModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{viewListModal.list.name}</h3>
              <button className="btn-close" onClick={() => setViewListModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {viewListModal.displayProducts.length} items in this list
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead style={{ background: 'var(--bg)', borderBottom: '1.5px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>Product Name</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Base Price</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{t('Stock', 'स्टॉक')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewListModal.displayProducts.map(p => (
                      <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.name} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>({p.unit})</span></td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>₹{p.price}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: p.stock > 0 ? 'var(--success)' : 'var(--danger)' }}>{p.stock}</td>
                      </tr>
                    ))}
                    {viewListModal.displayProducts.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No items visible</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
