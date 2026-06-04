const fs = require('fs');
let content = fs.readFileSync('src/pages/Customers.js', 'utf8');

// 1. Hide Add Customer button
content = content.replace(
  ') : (\n              <button className="btn btn-primary" onClick={openAdd}',
  ") : user?.role !== 'temp_manager' && (\n              <button className=\"btn btn-primary\" onClick={openAdd}"
);

// 2. Mobile View: Hide History, Show New Bill, Hide Edit/Delete
content = content.replace(
  '<Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 6, padding: \'5px 12px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                        <FileText size={13} /> See History <ArrowRight size={12} />\n                      </Link>',
  '{user?.role !== \'temp_manager\' && (\n                        <Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 6, padding: \'5px 12px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                          <FileText size={13} /> See History <ArrowRight size={12} />\n                        </Link>\n                      )}'
);

content = content.replace(
  '<button className="btn btn-outline btn-sm" onClick={() => setShareModal(c)}',
  '{user?.role === \'temp_manager\' && (\n                          <Link to={`/invoices/new?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 6, padding: \'5px 12px\', fontSize: 12, borderRadius: 6, fontWeight: 600, color: \'#16a34a\', borderColor: \'#bbf7d0\' }}>\n                            <FileText size={13} /> New Bill\n                          </Link>\n                        )}\n                        <button className="btn btn-outline btn-sm" onClick={() => setShareModal(c)}'
);

content = content.replace(
  '<button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} title="Edit"',
  '{user?.role !== \'temp_manager\' && (\n                          <>\n                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} title="Edit"'
);

content = content.replace(
  '<Trash2 size={14} />\n                        </button>',
  '<Trash2 size={14} />\n                        </button>\n                          </>\n                        )}'
);

// 3. Desktop View: Hide Bills, Show New Bill, Hide Edit/Delete
content = content.replace(
  '<Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 4, padding: \'5px 10px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                              <FileText size={12} /> Bills\n                            </Link>',
  '{user?.role === \'temp_manager\' && (\n                              <Link to={`/invoices/new?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 4, padding: \'5px 10px\', fontSize: 12, borderRadius: 6, fontWeight: 600, color: \'#16a34a\', borderColor: \'#bbf7d0\' }}>\n                                <FileText size={12} /> New Bill\n                              </Link>\n                            )}\n                            {user?.role !== \'temp_manager\' && (\n                              <Link to={`/invoices?customer_id=${c._id}`} className="btn btn-outline btn-sm" style={{ display: \'inline-flex\', alignItems: \'center\', gap: 4, padding: \'5px 10px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                                <FileText size={12} /> Bills\n                              </Link>\n                            )}'
);

content = content.replace(
  '<button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ display: \'inline-flex\', alignItems: \'center\', gap: 4, padding: \'5px 10px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                              <Edit size={12} />{t(\'Edit\', \'संपादित करें\')}</button>',
  '{user?.role !== \'temp_manager\' && (\n                              <>\n                                <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)} style={{ display: \'inline-flex\', alignItems: \'center\', gap: 4, padding: \'5px 10px\', fontSize: 12, borderRadius: 6, fontWeight: 600 }}>\n                                  <Edit size={12} />{t(\'Edit\', \'संपादित करें\')}</button>'
);

content = content.replace(
  '<button className="btn btn-ghost btn-sm" style={{ color: \'#ef4444\', padding: \'6px\', borderRadius: 6 }} onClick={() => handleDelete(c)} title="Delete">\n                              <Trash2 size={14} />\n                            </button>',
  '<button className="btn btn-ghost btn-sm" style={{ color: \'#ef4444\', padding: \'6px\', borderRadius: 6 }} onClick={() => handleDelete(c)} title="Delete">\n                              <Trash2 size={14} />\n                            </button>\n                              </>\n                            )}'
);

fs.writeFileSync('src/pages/Customers.js', content);
console.log("File Customers.js updated via node");
