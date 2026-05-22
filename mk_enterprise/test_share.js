const axios = require('axios');

async function testShare() {
  try {
    const api = axios.create({ baseURL: 'http://localhost:5000/api' });
    
    // login to get token
    const loginRes = await api.post('/auth/login', { username: 'mayank', password: '123' });
    const token = loginRes.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Get an invoice
    const invoicesRes = await api.get('/invoices');
    const invoiceId = invoicesRes.data.invoices[0]._id;
    console.log("Invoice ID:", invoiceId);

    // Call share
    const shareRes = await api.post(`/invoices/${invoiceId}/share`, { staffIds: [invoiceId] });
    console.log("Share response:", shareRes.data);
  } catch (err) {
    if (err.response) {
      console.error("Error:", err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
  }
}

testShare();
