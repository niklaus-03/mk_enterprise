// Frontend IST time formatting utilities

export function formatIST(dateStr) {
  if (!dateStr) return '—';
  // If already formatted string (from backend), return as-is
  if (typeof dateStr === 'string' && dateStr.includes('/')) return dateStr;
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).replace(',', '');
  } catch { return dateStr; }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
}

export function formatCurrency(n) {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function numToWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (!num || num === 0) return 'Zero Rupees Only';
  const n = Math.floor(Math.abs(num));
  function conv(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + conv(n % 100) : '');
    if (n < 100000) return conv(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + conv(n % 1000) : '');
    if (n < 10000000) return conv(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + conv(n % 100000) : '');
    return conv(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + conv(n % 10000000) : '');
  }
  return conv(n) + ' Rupees Only';
}

// Hindi translations — comprehensive
export const hi = {
  // Navigation
  dashboard: 'डैशबोर्ड', products: 'उत्पाद', customers: 'ग्राहक',
  invoices: 'बिल', newBill: 'नया बिल', settings: 'सेटिंग्स',
  stockMovements: 'स्टॉक मूवमेंट', logout: 'लॉगआउट',
  // Dashboard
  totalSales: 'कुल बिक्री', todaySales: 'आज की बिक्री',
  pendingDues: 'बकाया राशि', lowStock: 'कम स्टॉक',
  todayInvoices: 'आज के बिल', allTimePending: 'कुल बकाया',
  // Actions
  save: 'सहेजें', cancel: 'रद्द करें', delete: 'हटाएं', edit: 'संपादित करें',
  add: 'जोड़ें', search: 'खोजें', print: 'प्रिंट करें', back: 'वापस',
  create: 'बनाएं', update: 'अपडेट करें', confirm: 'पुष्टि करें',
  // Admin Panel
  adminPanel: 'एडमिन पैनल', managers: 'मैनेजर', drivers: 'ड्राइवर',
  recovery: 'पासवर्ड रिकवरी', activityLog: 'गतिविधि लॉग',
  addManager: 'मैनेजर जोड़ें', addDriver: 'ड्राइवर जोड़ें',
  resetPassword: 'पासवर्ड रीसेट', deleteUser: 'उपयोगकर्ता हटाएं',
  active: 'सक्रिय', inactive: 'निष्क्रिय',
  // Driver Module
  shortTrip: 'छोटी यात्रा', longTrip: 'लंबी यात्रा',
  history: 'इतिहास', startTrip: 'यात्रा शुरू करें',
  endTrip: 'यात्रा समाप्त', reachedDestination: 'गंतव्य पहुँचे',
  origin: 'शुरुआत', destination: 'गंतव्य', cargo: 'माल',
  ownerName: 'मालिक का नाम', ownerPhone: 'मालिक का फ़ोन',
  goodsType: 'माल का प्रकार', expense: 'खर्च', totalExpenses: 'कुल खर्च',
  fuel: 'ईंधन', toll: 'टोल', challan: 'चालान', service: 'सर्विस',
  food: 'खाना', other: 'अन्य',
  tripTimeline: 'यात्रा टाइमलाइन', tripStarted: 'यात्रा शुरू',
  tripCompleted: 'यात्रा पूर्ण', nextLeg: 'अगला चरण',
  // Goods Types
  fruitsVeg: 'फल-सब्जी', goods: 'सामान', paint: 'पेंट',
  tile: 'टाइल', cement: 'सीमेंट', hardware: 'हार्डवेयर सरिया',
  beverages: 'पेय पदार्थ', booking: 'बुकिंग', others: 'अन्य',
  // Products
  productName: 'उत्पाद का नाम', price: 'कीमत', stock: 'स्टॉक',
  unit: 'इकाई', gst: 'जीएसटी',
  // Customers
  customerName: 'ग्राहक का नाम', phone: 'फ़ोन', address: 'पता',
  balance: 'शेष राशि', due: 'बकाया', advance: 'अग्रिम',
  // Invoice
  invoiceNumber: 'बिल नंबर', subtotal: 'उप-कुल', discount: 'छूट',
  total: 'कुल', amountReceived: 'प्राप्त राशि', balanceDue: 'शेष बकाया',
  walkInCustomer: 'वॉक-इन ग्राहक', signature: 'हस्ताक्षर',
  // Notifications
  notifications: 'सूचनाएं', markAllRead: 'सब पढ़ा हुआ',
  noNotifications: 'कोई सूचना नहीं', unread: 'अपठित',
  // Settings
  language: 'भाषा', theme: 'थीम', businessName: 'व्यापार का नाम',
  enableSignature: 'हस्ताक्षर सक्षम करें', lowStockThreshold: 'कम स्टॉक सीमा',
  // Suppliers
  suppliers: 'आपूर्तिकर्ता', vehicles: 'वाहन',
  // Time
  today: 'आज', yesterday: 'कल', thisWeek: 'इस सप्ताह', thisMonth: 'इस महीने',
};

