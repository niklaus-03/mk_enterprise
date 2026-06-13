import React, { useState } from 'react';
import toast from 'react-hot-toast';

const DEFAULT_UNITS = ['bag', 'kg', 'g', 'ltr', 'ml', 'pcs', 'box', 'quintal', 'ton', 'mtr', 'dozen', 'pkt', 'strip'];

export default function UnitInput({ value, onChange, placeholder = 'bag', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [customUnits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_units') || '[]'); } catch { return []; }
  });
  const allUnits = [...new Set([...DEFAULT_UNITS, ...customUnits])];

  const addCustomUnit = (unit) => {
    const trimmed = unit.trim().toLowerCase();
    if (!trimmed || allUnits.includes(trimmed)) return;
    const existing = JSON.parse(localStorage.getItem('custom_units') || '[]');
    localStorage.setItem('custom_units', JSON.stringify([...existing, trimmed]));
  };

  const filtered = value
    ? allUnits.filter(u => u.toLowerCase().includes(value.toLowerCase()))
    : allUnits;

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-control"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        disabled={disabled}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 160, overflowY: 'auto' }}>
          {filtered.map(u => (
            <div key={u}
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
              onMouseDown={() => { onChange(u); setOpen(false); }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{u}</div>
          ))}
          {value && !allUnits.includes(value.toLowerCase().trim()) && (
            <div
              style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, background: 'var(--primary-light)' }}
              onMouseDown={() => { addCustomUnit(value); onChange(value); setOpen(false); toast(`Unit "${value}" saved`, { icon: '✓' }); }}
            >+ Add "{value}" as new unit</div>
          )}
        </div>
      )}
    </div>
  );
}
