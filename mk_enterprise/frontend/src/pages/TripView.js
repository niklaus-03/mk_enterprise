import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tripApi } from '../utils/api';
import toast from 'react-hot-toast';
import { Truck, Car, MapPin, Package, Clock, Landmark, ArrowLeft, Play, Wallet, RefreshCw, CheckCircle, FileText, Phone, User, Download } from 'lucide-react';

export default function TripView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTrip = useCallback(() => {
    tripApi.get(id)
      .then(setTrip)
      .catch(err => {
        toast.error('Failed to load trip: ' + err.message);
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    fetchTrip();
    // Auto-refresh every 5 seconds for live tracking
    const interval = setInterval(fetchTrip, 5000);
    return () => clearInterval(interval);
  }, [fetchTrip]);

  if (loading) return <div className="text-center p-5 text-muted">Loading trip data...</div>;
  if (!trip) return null;

  const isActive = trip.status === 'active';

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1100px' }}>
      <button onClick={() => navigate(-1)} className="btn btn-light mb-3 fw-bold shadow-sm d-inline-flex align-items-center gap-2">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="row g-4 mt-1 text-start">
        {/* LEFT COLUMN - Trip Details */}
        <div className="col-md-7 col-lg-8">
          <div className="card shadow-sm mb-4 border-0">
            <div className="card-header py-3 border-bottom-0" style={{ background: isActive ? 'linear-gradient(135deg, #059669, #10b981)' : '#fff' }}>
              <h4 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '20px', color: isActive ? '#fff' : '#1e293b' }}>
                {trip.type === 'short' ? <Car size={24} /> : <Truck size={24} />}
                {trip.type.toUpperCase()} TRIP — {trip.driver_name}
                {isActive && <span className="badge bg-white text-success ms-2 px-3 py-1" style={{ fontSize: '11px', fontWeight: 800 }}>● LIVE</span>}
              </h4>
              <p className="mb-0 mt-1" style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.85)' : '#64748b' }}>
                Started: {new Date(trip.started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                {trip.vehicle_number && <> · Vehicle: <strong>{trip.vehicle_number}</strong></>}
              </p>
            </div>
            
            <div className="card-body bg-light rounded-bottom">
              {/* Cargo / Transport Invoice Section */}
              {(trip.legs || []).map((leg, idx) => (
                <div key={idx}>
                  {/* Route Header */}
                  <div className="bg-white rounded p-3 mb-3 border shadow-sm">
                    <div className="row g-3 mb-2">
                      <div className="col-sm-6">
                        <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Origin</span>
                        <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>{leg.origin}</div>
                      </div>
                      <div className="col-sm-6">
                        <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Destination</span>
                        <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>{leg.destination}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <span className={`badge ${leg.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'} px-2 py-1`} style={{ fontSize: '10px', fontWeight: 700 }}>
                        {leg.status === 'completed' ? '✓ Completed' : '● Active'}
                      </span>
                    </div>
                  </div>

                  {/* Cargo Items - Transport Invoice / Bilty Style */}
                  {leg.cargo && leg.cargo.length > 0 && (
                    <div className="mb-4">
                      <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3" style={{ fontSize: '14px' }}>
                        <Package size={16} className="text-secondary" /> 
                        {trip.transport_invoice_number ? `Transport Invoice: ${trip.transport_invoice_number}` : 'Cargo Manifest (Transport Invoice)'}
                        {trip.invoice_id && (
                          <span className="ms-auto" style={{ fontSize: '12px', fontWeight: 'normal' }}>
                            Linked Bill: <Link to={`/invoices/${trip.invoice_id._id || trip.invoice_id}`} className="text-primary text-decoration-none">#{trip.invoice_id.invoice_number || 'View'}</Link>
                          </span>
                        )}
                      </h6>
                      {leg.cargo.map((c, ci) => (
                        <div key={ci} className="bg-white rounded p-3 mb-3 border shadow-sm">
                          {/* Owner / Consignor Header */}
                          <div className="pb-2 mb-2 border-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.5px' }}>Consignor / Owner</span>
                              <div className="fw-bold text-dark mt-1 d-flex align-items-center gap-2" style={{ fontSize: '15px' }}>
                                <User size={14} className="text-secondary" />
                                {trip.invoice_id?.customer_name || c.owner_name || 'Unknown'}
                                {(trip.invoice_id?.customer_phone || c.owner_phone) && (
                                  <span className="text-muted fw-normal d-inline-flex align-items-center gap-1" style={{ fontSize: '13px' }}>
                                    <Phone size={12} /> {trip.invoice_id?.customer_phone || c.owner_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            {(trip.invoice_id?.total_weight > 0 || c.weight > 0) && (
                              <span className="badge bg-dark px-3 py-2" style={{ fontSize: '13px' }}>Total: {trip.invoice_id?.total_weight || c.weight} kg</span>
                            )}
                          </div>

                          {/* Items Table */}
                          <table className="table table-sm table-borderless mt-2 mb-0" style={{ fontSize: '13px' }}>
                            <thead className="table-light border-bottom">
                              <tr>
                                <th className="fw-bold text-secondary">Particulars</th>
                                <th className="fw-bold text-secondary text-center" width="80">Qty</th>
                                <th className="fw-bold text-secondary text-end" width="110">Weight (kg)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {c.items && c.items.length > 0 ? (
                                c.items.map((item, itemIdx) => (
                                  <tr key={itemIdx} className="border-bottom border-light">
                                    <td className="align-middle fw-medium text-dark py-2">{item.name}</td>
                                    <td className="align-middle text-center py-2">{item.quantity}</td>
                                    <td className="align-middle text-end py-2">{item.weight > 0 ? `${item.weight} kg` : '—'}</td>
                                  </tr>
                                ))
                              ) : (c.goods_types || []).length > 0 ? (
                                (c.goods_types).map((g, gi) => (
                                  <tr key={gi} className="border-bottom border-light">
                                    <td className="align-middle fw-medium text-dark py-2">{g}</td>
                                    <td className="align-middle text-center py-2">—</td>
                                    <td className="align-middle text-end py-2">—</td>
                                  </tr>
                                ))
                              ) : (
                                <tr><td colSpan="3" className="text-muted text-center py-2" style={{ fontStyle: 'italic', fontSize: '12px' }}>No items specified</td></tr>
                              )}
                            </tbody>
                            {((c.items && c.items.length > 0) || trip.invoice_id?.total_weight > 0) && (
                              <tfoot>
                                <tr>
                                  <td colSpan="2" className="text-end fw-bold pt-2" style={{ fontSize: '13px', color: '#1e40af' }}>Total Weight:</td>
                                  <td className="text-end fw-bold pt-2" style={{ fontSize: '14px', color: '#1e40af' }}>{trip.invoice_id?.total_weight || c.weight || 0} kg</td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Status & Timeline */}
        <div className="col-md-5 col-lg-4">
          <h4 className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-primary fw-bold d-flex align-items-center gap-2" style={{ fontSize: '18px' }}>
              <Landmark size={18} className="text-primary" /> Trip Overview
            </span>
            <span className={`badge ${trip.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'} px-3 py-2 rounded-pill`} style={{ fontSize: '12px', fontWeight: 800 }}>
              {trip.status.toUpperCase()}
            </span>
          </h4>

          <ul className="list-group mb-4 shadow-sm border-0">
            <li className="list-group-item border-0 border-bottom d-flex justify-content-between lh-sm py-3">
              <div>
                <h6 className="my-0 fw-bold text-dark">Total Expenses</h6>
                <small className="text-muted">Highway items logged</small>
              </div>
              <strong className="text-danger font-monospace h5 mb-0">₹{(trip.total_expenses || 0).toLocaleString('en-IN')}</strong>
            </li>
            <li className="list-group-item border-0 border-bottom d-flex justify-content-between lh-sm py-3">
              <div>
                <h6 className="my-0 fw-bold text-dark">Vehicle No.</h6>
              </div>
              <span className="font-monospace fw-bold text-primary">{trip.vehicle_number || '—'}</span>
            </li>
            <li className="list-group-item border-0 d-flex justify-content-between lh-sm py-3">
              <div>
                <h6 className="my-0 fw-bold text-dark">Driver</h6>
              </div>
              <span className="fw-bold text-dark">{trip.driver_name || '—'}</span>
            </li>
          </ul>

          {isActive && (
            <div className="alert alert-success d-flex align-items-center gap-2 py-2 mb-3" style={{ fontSize: '12px', fontWeight: 700, borderRadius: 10 }}>
              <RefreshCw size={14} className="text-success" style={{ animation: 'spin 2s linear infinite' }} />
              Auto-refreshing every 15 seconds
            </div>
          )}

          <h5 className="fw-bold text-secondary mb-3 d-flex align-items-center gap-2" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>
            <Clock size={15} /> Trip Timeline
          </h5>
          <div className="list-group shadow-sm border-0" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {(trip.timeline || []).slice().reverse().map((t, i) => {
              const renderTimelineIcon = (type) => {
                switch(type) {
                  case 'trip_start': return <Play size={16} className="text-success" />;
                  case 'expense': return <Wallet size={16} className="text-danger" />;
                  case 'reached_destination': return <MapPin size={16} className="text-warning" />;
                  case 'returning': return <RefreshCw size={16} className="text-primary" />;
                  case 'trip_end': return <CheckCircle size={16} className="text-success" />;
                  default: return <FileText size={16} className="text-secondary" />;
                }
              };
              return (
                <div key={i} className="list-group-item border-0 border-bottom d-flex gap-3 py-3 align-items-center">
                  <div style={{ background: '#f8fafc', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                    {renderTimelineIcon(t.type)}
                  </div>
                  <div className="d-flex gap-2 w-100 justify-content-between">
                    <div>
                      <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '13px' }}>
                        {t.type === 'expense' ? `${t.expense_type.toUpperCase()}: ₹${t.expense_amount}` : t.note || t.type.replace(/_/g, ' ').toUpperCase()}
                      </h6>
                      {t.expense_note && <p className="mb-0 text-muted" style={{ fontSize: '12px' }}>{t.expense_note}</p>}
                      <small className="text-muted" style={{ fontSize: '11px' }}>
                        {new Date(t.timestamp || t.createdAt || trip.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .hide-print { display: none !important; }
          body { background: white !important; }
          .container-fluid { padding: 0 !important; max-width: 100% !important; }
          .card { border: none !important; box-shadow: none !important; }
          .alert { display: none !important; }
        }
      `}</style>
    </div>
  );
}
