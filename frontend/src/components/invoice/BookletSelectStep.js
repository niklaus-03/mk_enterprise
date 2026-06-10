import React from 'react';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function BookletSelectStep({ managers = [], onSelect, onBack }) {
  const { isAdmin } = useAuth();
  return (
    <div className="cs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '24px', padding: '16px' }}>
      {/* Header */}
      <div className="cs-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <button 
          onClick={onBack}
          className="btn btn-outline" 
          style={{ padding: '8px 12px', borderRadius: '50%', minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Select Booklet</h1>
          <p className="page-subtitle" style={{ margin: '2px 0 0 0' }}>Choose a booklet (manager) to continue</p>
        </div>
      </div>

      {/* Booklets Grid */}
      <div className="responsive-2col-grid">
        {/* All Customers Option */}
        {isAdmin && (
          <div
          onClick={() => onSelect('')}
          style={{
            background: 'var(--bg-card)',
            border: '2px solid var(--border)',
            borderRadius: '16px',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-sm)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', textAlign: 'center' }}>All Customers</span>
        </div>
        )}

        {/* Manager Options */}
        {managers.map(m => (
          <div
            key={m._id}
            onClick={() => onSelect(m._id)}
            style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--border)',
              borderRadius: '16px',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            <div style={{ background: 'var(--primary-light)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
              <BookOpen size={24} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)', textAlign: 'center' }}>{m.display_name || m.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
