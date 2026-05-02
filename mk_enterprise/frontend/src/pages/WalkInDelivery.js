import React, { useState } from 'react';

export default function WalkInDelivery() {
  const [deliveries, setDeliveries] = useState([
    { id: 'WD-1001', customer: 'Walk-in Cash', items: 3, amount: 4500, time: '10:30 AM', status: 'Completed' },
    { id: 'WD-1002', customer: 'Raju Traders', items: 12, amount: 18200, time: '11:15 AM', status: 'Pending Pickup' },
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🚶 Walk-in Delivery</h1>
          <p className="page-subtitle">Manage counter sales and direct pickups</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '12px 20px', borderRadius: 'var(--radius-lg)' }}>
          + New Walk-in Order
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">🛍️</div>
          <div className="stat-value">24</div>
          <div className="stat-label">Today's Walk-ins</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">₹</div>
          <div className="stat-value">₹45,200</div>
          <div className="stat-label">Counter Revenue</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-icon">⏳</div>
          <div className="stat-value">4</div>
          <div className="stat-label">Pending Pickups</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="card-title" style={{ fontSize: 16 }}>Recent Walk-in Deliveries</h2>
        </div>
        <div className="card-body no-pad">
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Time</th>
                  <th className="tc">Items</th>
                  <th className="tr">Amount</th>
                  <th className="tc">Status</th>
                  <th className="tc">Action</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id}>
                    <td className="mono font-bold" style={{ color: 'var(--primary-dark)' }}>{d.id}</td>
                    <td style={{ fontWeight: 600 }}>{d.customer}</td>
                    <td>{d.time}</td>
                    <td className="tc">{d.items}</td>
                    <td className="tr mono" style={{ fontWeight: 600 }}>₹{d.amount.toLocaleString()}</td>
                    <td className="tc">
                      <span className={`badge ${d.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="tc">
                      <button className="btn btn-sm btn-outline">View</button>
                    </td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan="7" className="tc" style={{ padding: '40px 0', color: 'var(--text-muted)' }}>
                      No walk-in deliveries today.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
