const fs = require('fs');

const drPath = 'frontend/src/pages/DailyReport.js';
let drCode = fs.readFileSync(drPath, 'utf8');

if (!drCode.includes('walkinProducts')) {
  // Add state for walkin products
  drCode = drCode.replace(
    `const [openingBalance, setOpeningBalance] = useState(0);`,
    `const [openingBalance, setOpeningBalance] = useState(0);\n  const [walkinProducts, setWalkinProducts] = useState([]);`
  );

  // Load products
  drCode = drCode.replace(
    `const setts = await settlementApi.get({ date: today });
      setSettlements(setts.settlements || []);`,
    `const setts = await settlementApi.get({ date: today });
      setSettlements(setts.settlements || []);

      if (user?.role === 'walkin_manager') {
        try {
          const prods = await productApi.getAll();
          setWalkinProducts((prods || []).filter(p => p.stock > 0));
        } catch (e) { console.error('Failed to load walkin products for return', e); }
      }`
  );

  // Display unsold inventory return section
  const quickCatchUpEnd = `</div>
      </div>

      {/* ─── Section 3: Reconciliation ─── */}`;

  const unsoldSection = `</div>
      </div>

      {user?.role === 'walkin_manager' && walkinProducts.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} /> {t('Unsold Inventory Return', 'बिना बिका इन्वेंटरी रिटर्न')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('These remaining items will be unloaded and returned to the main inventory upon submission.', 'ये शेष आइटम सबमिट करने पर मुख्य इन्वेंटरी में वापस आ जाएंगे।')}
            </div>
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            {walkinProducts.map((p, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', marginBottom: 6,
                border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                  {p.stock} {p.unit || 'pcs'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section 3: Reconciliation ─── */}`;

  drCode = drCode.replace(quickCatchUpEnd, unsoldSection);
  
  fs.writeFileSync(drPath, drCode, 'utf8');
  console.log('DailyReport.js unsold products patched');
} else {
  console.log('DailyReport.js already has walkinProducts');
}
