# 🏪 ShopBill Pro v2 — Business Billing & Management

A complete **cloud-enabled** billing and business management system for Indian shops.
Built with **React + Node.js + MongoDB Atlas**. Features GST invoicing, OTP authentication, split payments, stock tracking, and professional invoice printing.

---

## ✅ Feature Checklist

| Feature | Status |
|---------|--------|
| 🔐 Secure Admin Login (JWT) | ✅ |
| 📲 OTP Password Reset (Twilio / Console) | ✅ |
| 📦 Product Management with manual GST rates | ✅ |
| 👥 Customer Management with balance tracking | ✅ |
| 🧾 GST Invoicing (CGST + SGST split) | ✅ |
| 💰 Previous customer balance on invoice | ✅ |
| 💳 Split payments (Cash, UPI, Online, Others) | ✅ |
| 🔍 Autocomplete product search in billing | ✅ |
| ✏️ Edit invoices from history | ✅ |
| 🔄 Return & defective item handling | ✅ |
| 🖨️ Professional print-ready invoice (Indian format) | ✅ |
| 📱 QR code for UPI payment on invoice | ✅ |
| 🕐 IST time on all invoices (UTC+5:30) | ✅ |
| 📊 Dashboard with sales, dues, low stock | ✅ |
| 📦 Stock movement tracking (vehicle, driver) | ✅ |
| 🌐 Hindi language support | ✅ |
| 🔁 GST toggle ON/OFF | ✅ |
| 💸 Discount toggle ON/OFF | ✅ |
| ☁️ MongoDB Atlas (cloud database) | ✅ |
| 🌍 Deployable online (Render + Vercel) | ✅ |

---

## 📁 Folder Structure

```
shopbill-pro/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example           ← Copy to .env and fill values
│   ├── config/
│   │   └── db.js              ← MongoDB Atlas connection
│   ├── middleware/
│   │   └── auth.js            ← JWT verification
│   ├── models/
│   │   ├── Admin.js           ← Single admin with bcrypt
│   │   ├── OTP.js             ← Auto-expiring OTP (5 min TTL)
│   │   ├── Product.js
│   │   ├── Customer.js
│   │   ├── Invoice.js         ← Split payments, returns, IST
│   │   ├── StockMovement.js
│   │   └── Setting.js
│   ├── routes/
│   │   ├── auth.js            ← login, send-otp, verify-otp, reset-password
│   │   ├── products.js        ← CRUD + autocomplete
│   │   ├── customers.js       ← CRUD + pending dues
│   │   ├── invoices.js        ← Create/Edit/Delete (MongoDB transactions)
│   │   ├── dashboard.js       ← IST-aware stats
│   │   ├── settings.js
│   │   ├── stockMovements.js
│   │   └── seed.js            ← Sample data + admin setup
│   └── utils/
│       ├── timeUtils.js       ← IST conversion (UTC+5:30)
│       └── otpUtils.js        ← Twilio SMS / console fallback
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js             ← Routing, sidebar, protected routes
        ├── App.css            ← Complete stylesheet
        ├── index.js
        ├── context/
        │   ├── AuthContext.js ← JWT login state
        │   └── AppContext.js  ← Settings, language
        ├── utils/
        │   ├── api.js         ← All API calls with JWT interceptor
        │   └── helpers.js     ← IST formatting, currency, numToWords, Hindi
        └── pages/
            ├── Login.js
            ├── ForgotPassword.js   ← 3-step: Mobile → OTP → New Password
            ├── Dashboard.js
            ├── Products.js
            ├── Customers.js
            ├── NewInvoice.js       ← Autocomplete, split payments, prev balance
            ├── EditInvoice.js      ← Returns, defectives, adjustments
            ├── InvoiceView.js      ← QR code, GST summary, IST, print
            ├── Invoices.js
            ├── StockMovements.js
            └── Settings.js
```

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** v18+ → https://nodejs.org
- **MongoDB Atlas** account (free) → https://cloud.mongodb.com

---

### Step 1 — MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com → Create free account
2. Create a new **Cluster** (free M0 tier)
3. Go to **Database Access** → Add database user (username + password)
4. Go to **Network Access** → Add IP Address → Allow from anywhere (`0.0.0.0/0`)
5. Go to **Clusters** → **Connect** → **Connect your application**
6. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/shopbill?retryWrites=true&w=majority
   ```

---

### Step 2 — Backend Setup

```bash
cd shopbill-pro/backend

# Copy and edit environment file
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_MOBILE

# Install dependencies
npm install

# Start server
npm start
```

The backend will start on **http://localhost:5000**

**Create admin and sample data (run once):**
```bash
curl -X POST http://localhost:5000/api/seed
```

---

### Step 3 — Frontend Setup

```bash
cd shopbill-pro/frontend

# Install dependencies
npm install

# Start development server
npm start
```

The app opens at **http://localhost:3000**

---

### Step 4 — Login

Open http://localhost:3000 → Login with:
- **Username**: `admin` (or whatever you set in `ADMIN_USERNAME`)
- **Password**: `Admin@123` (or whatever you set in `ADMIN_PASSWORD`)

---

## 🌐 OTP / SMS Configuration

### Option A — Twilio (for real SMS)
1. Sign up at https://twilio.com
2. Get your Account SID, Auth Token, and a Twilio phone number
3. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
   ```

### Option B — Development Mode (no Twilio)
If Twilio is not configured, the OTP is printed in the **backend console** (terminal). You can copy it from there for testing. The API response also returns `dev_otp` in non-production mode.

---

## ☁️ Deployment Guide (Online Access)

### Deploy Backend → Render.com (Free)

1. Push your code to GitHub
2. Go to https://render.com → New Web Service
3. Connect your GitHub repo
4. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables (all from your `.env` file)
6. Deploy → Copy the URL (e.g. `https://shopbill-api.onrender.com`)

### Deploy Frontend → Vercel.com (Free)

1. Go to https://vercel.com → New Project → Import your repo
2. Set:
   - **Root Directory**: `frontend`
   - **Framework**: Create React App
3. Add Environment Variable:
   ```
   REACT_APP_API_URL=https://shopbill-api.onrender.com
   ```
4. Deploy → Your app is live at `https://shopbill-pro.vercel.app`

### Update CORS on Backend
In your Render environment variables, set:
```
FRONTEND_URL=https://shopbill-pro.vercel.app
```

---

## 🖨️ Invoice Printing

1. Open any invoice → Click **Print Invoice**
2. Browser print dialog opens
3. Buttons and sidebar are automatically hidden
4. **Tip**: In print dialog, set:
   - Paper size: A4
   - Margins: Minimum
   - "Background graphics": Enabled (for colored table headers)

---

## 🕐 IST Time

All timestamps are stored in UTC (MongoDB standard) but **displayed in IST (UTC+5:30)** everywhere — invoices, dashboard, stock movements. This is guaranteed regardless of where your server is deployed (India, US, etc.).

---

## 📋 API Reference

### Auth (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with username + password |
| POST | /api/auth/send-otp | Send OTP to registered mobile |
| POST | /api/auth/verify-otp | Verify OTP → get reset token |
| POST | /api/auth/reset-password | Reset password with reset token |
| GET | /api/auth/me | Get current admin info |
| PUT | /api/auth/change-password | Change password (requires auth) |

### All other routes require `Authorization: Bearer <token>` header

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | /api/products | List / create |
| GET | /api/products/autocomplete?q=sugar | Autocomplete search |
| GET/PUT/DELETE | /api/products/:id | Get / update / delete |
| PATCH | /api/products/:id/stock | Manual stock adjustment |
| GET/POST | /api/customers | List / create |
| GET/PUT/DELETE | /api/customers/:id | Get / update / delete |
| GET/POST | /api/invoices | List (paginated) / create |
| GET/PUT/DELETE | /api/invoices/:id | Get / edit / cancel |
| GET | /api/dashboard | Full dashboard stats |
| GET/PUT | /api/settings | Get / update settings |
| GET/POST | /api/stock-movements | List / create |
| POST | /api/seed | Load sample data |

---

## 🔐 Security Notes

- Passwords are hashed with **bcrypt** (12 rounds) — never stored in plain text
- JWT tokens expire in **7 days** (configurable)
- OTPs expire in **5 minutes** (MongoDB TTL index)
- Failed login attempts are tracked — account locked after **5 wrong attempts** for 15 minutes
- OTP verification allows max **5 attempts** before invalidation
- All protected routes require valid JWT token

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| MongoDB connection failed | Check `MONGODB_URI` in `.env`; ensure IP whitelist in Atlas |
| OTP not received via SMS | Check Twilio credentials; use console OTP in dev mode |
| Login says "invalid credentials" | Run `POST /api/seed` first to create admin |
| CORS error on frontend | Set `FRONTEND_URL` in backend `.env` to your frontend URL |
| Invoice time is wrong | Backend uses IST conversion — verify `timeUtils.js` is in place |
| Stock not deducting | Ensure MongoDB replica set is enabled (Atlas M0 supports transactions) |

---

*Built with ❤️ for Indian small businesses.*
*IST-accurate · GST-compliant · Offline-capable · Cloud-ready*
