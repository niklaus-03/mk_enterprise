const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  const loginData = JSON.stringify({ username: 'mayank', password: '123' });
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);
  
  const token = JSON.parse(loginRes.data).token;
  if (!token) return console.log('Login failed');

  const getInvoicesRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/invoices', method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const invoices = JSON.parse(getInvoicesRes.data).invoices;
  if (!invoices || invoices.length === 0) return console.log('No invoices');
  const invoiceId = invoices[0]._id;
  
  console.log('Testing share for:', invoiceId);
  const shareData = JSON.stringify({ staffIds: [invoiceId] });
  
  const shareRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: `/api/invoices/${invoiceId}/faketest`, method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(shareData)
    }
  }, shareData);
  
  console.log('Fake Route status:', shareRes.status);
  console.log('Fake Route data:', shareRes.data);
  
  const shareRes2 = await makeRequest({
    hostname: 'localhost', port: 5000, path: `/api/invoices/${invoiceId}/share`, method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(shareData)
    }
  }, shareData);
  
  console.log('Real Route status:', shareRes2.status);
  console.log('Real Route data:', shareRes2.data);
}
run();
