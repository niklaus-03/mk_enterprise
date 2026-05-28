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

export function numToWords(num, isHindi = false) {
  if (!num || num === 0) return isHindi ? 'शून्य रुपये मात्र' : 'Zero Rupees Only';
  const absNum = Math.abs(num);
  const n = Math.floor(absNum);
  const paise = Math.round((absNum - n) * 100);

  if (isHindi) {
    const a = ['', 'एक', 'दो', 'तीन', 'चार', 'पांच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
      'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
      'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
      'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीसों', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
      'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
      'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
      'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
      'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी', 'अस्सी',
      'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे',
      'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'संतानवे', 'अट्ठानवे', 'निन्यानवे'];
    
    function convHi(v) {
      if (v < 100) return a[v];
      if (v < 1000) return a[Math.floor(v / 100)] + ' सौ' + (v % 100 ? ' ' + convHi(v % 100) : '');
      if (v < 100000) return convHi(Math.floor(v / 1000)) + ' हज़ार' + (v % 1000 ? ' ' + convHi(v % 1000) : '');
      if (v < 10000000) return convHi(Math.floor(v / 100000)) + ' लाख' + (v % 100000 ? ' ' + convHi(v % 100000) : '');
      return convHi(Math.floor(v / 10000000)) + ' करोड़' + (v % 10000000 ? ' ' + convHi(v % 10000000) : '');
    }
    let result = '';
    if (n > 0) result += convHi(n) + ' रुपये';
    if (paise > 0) {
      if (result) result += ' और ';
      result += convHi(paise) + ' पैसे';
    }
    return result ? result + ' मात्र' : 'शून्य रुपये मात्र';
  }

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function conv(v) {
    if (v < 20) return a[v];
    if (v < 100) return b[Math.floor(v / 10)] + (v % 10 ? ' ' + a[v % 10] : '');
    if (v < 1000) return a[Math.floor(v / 100)] + ' Hundred' + (v % 100 ? ' ' + conv(v % 100) : '');
    if (v < 100000) return conv(Math.floor(v / 1000)) + ' Thousand' + (v % 1000 ? ' ' + conv(v % 1000) : '');
    if (v < 10000000) return conv(Math.floor(v / 100000)) + ' Lakh' + (v % 100000 ? ' ' + conv(v % 100000) : '');
    return conv(Math.floor(v / 10000000)) + ' Crore' + (v % 10000000 ? ' ' + conv(v % 10000000) : '');
  }
  let result = '';
  if (n > 0) {
    result += conv(n) + ' Rupees';
  }
  if (paise > 0) {
    if (result) result += ' and ';
    result += conv(paise) + ' Paise';
  }
  return result ? result + ' Only' : 'Zero Rupees Only';
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

