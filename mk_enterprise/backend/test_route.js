const http = require('http');

async function testBackend() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/invoices',
    method: 'GET'
  };

  const req = http.request(options, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error('Failed to fetch invoices, status:', res.statusCode);
        return;
      }
      const invoices = JSON.parse(data).invoices;
      if (!invoices || invoices.length === 0) return console.log('No invoices found');
      
      const invoiceId = invoices[0]._id;
      console.log('Testing share for invoice:', invoiceId);

      const postData = JSON.stringify({ staffIds: [invoiceId] });
      const postOptions = {
        hostname: 'localhost',
        port: 5000,
        path: `/api/invoices/${invoiceId}/share`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const postReq = http.request(postOptions, postRes => {
        let postResData = '';
        postRes.on('data', chunk => postResData += chunk);
        postRes.on('end', () => {
          console.log(`Status: ${postRes.statusCode}`);
          console.log(`Body: ${postResData}`);
        });
      });
      postReq.write(postData);
      postReq.end();
    });
  });
  req.end();
}
testBackend();
