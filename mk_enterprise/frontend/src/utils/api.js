import axios from 'axios';

const baseURL =
  window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "http://192.168.1.35:5000/api";

const api = axios.create({
  baseURL,
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('shopbill_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('shopbill_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const msg = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  verifySecret: (data) => api.post('/auth/verify-secret', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  forgotPassword: (identifier) => api.post('/auth/forgot-password', { identifier }),
  checkUser: (identifier) => api.get('/auth/check-user', { params: { identifier } }),
  getRecoveryRequests: () => api.get('/auth/recovery-requests'),
  resolveRecoveryRequest: (id, new_password) => api.put(`/auth/recovery-requests/${id}/resolve`, { new_password }),
};

// ── Manager Admin (Supervisor only) ──────────────────────────────────────────────────
export const managerApi = {
  getAll: () => api.get('/auth/managers'),
  create: (data) => api.post('/auth/managers', data),
  update: (id, data) => api.put(`/auth/managers/${id}`, data),
  resetPassword: (id, new_password) => api.put(`/auth/managers/${id}/reset-password`, { new_password }),
  delete: (id) => api.delete(`/auth/managers/${id}`),
};

// ── Driver Admin (Supervisor only) ───────────────────────────────────────────────────
export const driverApi = {
  getAll: () => api.get('/auth/drivers'),
  create: (data) => api.post('/auth/drivers', data),
  update: (id, data) => api.put(`/auth/drivers/${id}`, data),
  resetPassword: (id, new_password) => api.put(`/auth/drivers/${id}/reset-password`, { new_password }),
  delete: (id) => api.delete(`/auth/drivers/${id}`),
};

// ── Recovery Requests (Supervisor only) ─────────────────────────────────────────────
export const recoveryApi = {
  getAll: () => api.get('/auth/recovery-requests'),
  resolve: (id, new_password) => api.put(`/auth/recovery-requests/${id}/resolve`, { new_password }),
};

// ── Activity Logs (Supervisor only) ──────────────────────────────────────────────────
export const activityLogApi = {
  getAll: (params) => api.get('/activity-logs', { params }),
  getByUser: (userId, params) => api.get(`/activity-logs/user/${userId}`, { params }),
};

// ── Notifications ────────────────────────────────────────────────────────────────────
export const notificationApi = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  create: (data) => api.post('/notifications', data),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ── Trips (Driver Module) ────────────────────────────────────────────────────────────
export const tripApi = {
  getAll: (params) => api.get('/trips', { params }),
  get: (id) => api.get(`/trips/${id}`),
  getGoodsTypes: () => api.get('/trips/goods-types'),
  create: (data) => api.post('/trips', data),
  addExpense: (id, data) => api.post(`/trips/${id}/expense`, data),
  markReached: (id, data) => api.post(`/trips/${id}/reached`, data),
  markCargoDelivered: (id, cargoIndex) => api.post(`/trips/${id}/cargo/${cargoIndex}/deliver`),
  addNextLeg: (id, data) => api.post(`/trips/${id}/next-leg`, data),
  endTrip: (id) => api.post(`/trips/${id}/end`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productApi = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  autocomplete: (q) => api.get('/products/autocomplete', { params: { q } }),
  getLowStock: () => api.get('/products/low-stock'),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  adjustStock: (id, data) => api.patch(`/products/${id}/stock`, data),
  delegate: (id, manager_id) => api.post(`/products/${id}/delegate`, { manager_id }),
  getCategories: () => api.get('/products/categories'),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customerApi = {
  getAll: (params) => api.get('/customers', { params }),
  getPendingDues: () => api.get('/customers/pending-dues'),
  get: (id) => api.get(`/customers/${id}`),
  getInvoices: (id) => api.get(`/customers/${id}/invoices`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  merge: (data) => api.post('/customers/merge', data),
  delegate: (id, manager_id) => api.post(`/customers/${id}/delegate`, { manager_id }),
};

// ── Product Lists ─────────────────────────────────────────────────────────────
export const productListApi = {
  getAll: () => api.get('/product-lists'),
  get: (id) => api.get(`/product-lists/${id}`),
  create: (data) => api.post('/product-lists', data),
  update: (id, data) => api.put(`/product-lists/${id}`, data),
  share: (id, data) => api.put(`/product-lists/${id}/share`, data),
  delete: (id) => api.delete(`/product-lists/${id}`),
};

// ── Customer Lists ────────────────────────────────────────────────────────────
export const customerListApi = {
  getAll: () => api.get('/customer-lists'),
  get: (id) => api.get(`/customer-lists/${id}`),
  create: (data) => api.post('/customer-lists', data),
  update: (id, data) => api.put(`/customer-lists/${id}`, data),
  share: (id, data) => api.put(`/customer-lists/${id}/share`, data),
  delete: (id) => api.delete(`/customer-lists/${id}`),
};

// ── Invoices ──────────────────────────────────────────────────────────────────
export const invoiceApi = {
  getAll: (params) => api.get('/invoices', { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  sendEmail: (id, email) => api.post(`/invoices/${id}/send-email`, { email }),
  share: (id, staffIds) => api.post(`/invoices/${id}/share`, { staffIds }),
  batchShare: (data) => api.post(`/invoices/batch-share`, data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: (date) => api.get('/dashboard', { params: date ? { date } : {} }),
  recordPayment: (data) => api.post('/dashboard/record-payment', data),
  createWalkinDue: (data) => api.post('/dashboard/walkin-due', data),
  checkPhone: (phone) => api.get('/dashboard/check-phone', { params: { phone } }),
};

// ── Deliveries ────────────────────────────────────────────────────────────────
export const deliveryApi = {
  getById: (id) => api.get(`/deliveries/${id}`),
  getAll: (params = {}) => api.get('/deliveries', {
    params: {
      ...(params.date ? { date: params.date } : {}),
      ...(params.all ? { all: 'true' } : {}),
      ...(params.status ? { status: params.status } : {}),
    }
  }),
  create: (data) => api.post('/deliveries', data),
  updateStatus: (id, status) => api.patch(`/deliveries/${id}/status`, { status }),
  updatePayment: (id, payment_status, payment_mode) => api.patch(`/deliveries/${id}/payment`, { payment_status, payment_mode }),
  update: (id, data) => api.put(`/deliveries/${id}`, data),
  delete: (id) => api.delete(`/deliveries/${id}`),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderApi = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  complete: (id) => api.patch(`/orders/${id}/complete`),
  delete: (id) => api.delete(`/orders/${id}`),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const supplierApi = {
  getAll: (q) => api.get('/suppliers', { params: q ? { q } : {} }),
  getHistory: (id, params = {}) => api.get(`/suppliers/${id}/history`, { params }),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// ── Settlements ───────────────────────────────────────────────────────────────
export const settlementApi = {
  get: (params = {}) => api.get('/settlements', {
    params: {
      ...(params.date ? { date: params.date } : {}),
      ...(params.all ? { all: 'true' } : {}),
      ...(params.party ? { party: params.party } : {}),
      ...(params.sort_amount ? { sort_amount: params.sort_amount } : {}),
      ...(params.sort_date ? { sort_date: params.sort_date } : {}),
    }
  }),
  create: (data) => api.post('/settlements', data),
  delete: (id) => api.delete(`/settlements/${id}`),
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// ── Stock Movements ───────────────────────────────────────────────────────────
export const stockApi = {
  getAll: (params) => api.get('/stock-movements', { params }),
  getToday: () => api.get('/stock-movements/today'),
  create: (data) => api.post('/stock-movements', data),
};

// ── Seed ──────────────────────────────────────────────────────────────────────
export const seedApi = {
  run: () => api.post('/seed'),
};

// ── Daily Reports ─────────────────────────────────────────────────────────────
export const dailyReportApi = {
  getAll: (params = {}) => api.get('/reports/daily', { params }),
  submit: (data) => api.post('/reports/daily', data),
  review: (id) => api.patch(`/reports/daily/${id}/review`),
};

export default api;