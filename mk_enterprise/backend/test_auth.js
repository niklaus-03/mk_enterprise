const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({ path: './.env' });

const token = jwt.sign({ id: '000000000000000000000000', role: 'manager' }, process.env.JWT_SECRET || 'jwt_secret_mk_enterprise_2026_super_secure');
axios.get('http://localhost:5000/api/auth/managers', { headers: { Authorization: `Bearer ${token}` } })
  .then(res => console.log("SUCCESS:", res.data))
  .catch(err => console.log("ERROR:", err.response ? err.response.data : err.message));
