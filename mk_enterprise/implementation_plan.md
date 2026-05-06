# Role-Based Enhancements & Driver Trip Workflow

This plan outlines the steps to implement the requested role-based enhancements, strict data scoping for managers, a new simplified Driver module, and full bilingual (English/Hindi) localization.

## User Feedback Integrated
- **Driver Photo Uploads:** Cancelled. No photo uploads required.
- **Invoice Prefix Strategy:** The actual `invoice_number` stored in the database will include the short code derived from the creator's username (e.g., `BRT-INV-000001` for Manager 'Bharat' or `ADM-INV-000002` for Admin). This ensures that whatever is printed on the bill is exactly what is saved in the database, meaning you can search for `BRT-INV-000001` directly in the search bar and it will instantly find the correct record.
- **Driver Edit Rule:** Removed the strict "one edit" lock. Drivers can edit their timeline entries normally.
- **Bilingual Implementation:** Approved JSON architecture for comprehensive translations (e.g., 'Potato' -> 'Aloo').

---

### Proposed Changes

All previously proposed phases (Phases 1-8) have been fully completed, verified, and integrated successfully into the project code. 

Below are the newly planned phases addressing the next level of security, keyboard interactions, cross-manager scoping, live system tracking, and advanced billing features.

---

### Phase 9: Seamless Login Flow & Dashboard Due Entry Fixes
Refining key login page behaviors, solving dashboard creation errors, and mirroring crucial statistics on the managerial view.
- **Notification Bell on Main Dashboard:**
  - Locate the interactive notification bell (with unread count badge) prominently on the **Main Dashboard Header** (right next to the "+ New Bill" and "Order" buttons, or near the digital clock).
  - This ensures instant visibility of driver expenses, trip events, and incoming vehicle alerts as soon as any Admin or Manager loads the main app dashboard.
- **Login Keyboard Navigation:**
  - In the username field, hitting `Enter` automatically moves the cursor focus to the password field.
  - In the password field, hitting `Enter` immediately submits the form to login.
  - Ensure Supervisors are seamlessly redirected to the correct `AdminPanel` layout upon logging in.
- **Today's Pending Due Creation (404 Resolution):**
  - Diagnose and resolve the `Request failed with status code 404` error triggered during Today's Pending Due submissions on the dashboard.
  - Make the Phone Number field **completely optional**.
  - If no phone number is provided, mark it as `"Not Available"` and automatically add the entry under existing customers.
- **Manager Dashboard Mirroring:**
  - Replicate the exact stats, "Today's Pending Due" table, and dashboard cards onto the Manager level dashboards so they have identical tracking capabilities.

---

### Phase 10: Dynamic Customer, Product, & Supplier Delegation
Enabling sharing mechanics between managers while preserving strict isolation controls by default.
- **Customer Delegation ("Send Details"):**
  - Create a "Send Details" button next to customers in the Admin/Manager tables.
  - Selecting it opens a dropdown list of active managers.
  - Choosing a manager (e.g., Manager 3) instantly shares that customer's vital details (Name, Phone number, and Pending Due amount) with them.
- **Product Sharing:**
  - Implement a similar delegation system for products. Admin and managers can delegate visibility of specific products to another manager or group.
  - Products created by managers remain strictly private between that manager and Admin unless explicitly shared.
- **Supplier Scoping Rules:**
  - Suppliers created by managers are private between that manager and the Admin (Manager 1 and Manager 2 cannot see each other's suppliers).
  - If Admin creates a supplier, it automatically becomes visible to **all** managers globally.

---

### Phase 11: Level-Based Numeric Invoices & Dynamic History
Redesigning invoice numbers, mapping display names, restricting phone links, and implementing global vehicle alerts.
- **Level-Based Numeric Invoice IDs:**
  - Transition from alphanumeric serials (like `MKA-INV-00091`) to a clear, 6-digit numeric scheme starting at `100000` (e.g., `100001`, `300002`).
  - The first digit indicates the creator's level/authority:
    - `1` represents invoices created by the Admin/Supervisor.
    - `3` represents invoices created by Manager 1 (first created manager).
    - `4`, `5`, etc., represent subsequent managers sequentially.
- **Dynamic Creator Display Names:**
  - In the Invoice History table, replace the raw manager usernames in the "Creator" column with their beautiful **Display Names** dynamically.
- **Clickable Phone Number Constraints:**
  - On lists tracking pending dues, the phone number should only be clickable (for initiating a call/message) if they have a pending due on the current date and time.
  - If a customer's due is cleared in today's date, switching to a past date should render their phone number as static text (not clickable).
- **Global Incoming Vehicle Alert Broadcast:**
  - Whenever an Admin registers an incoming vehicle list, trigger a system notification broadcast to all managers and administrators immediately.

---

### Phase 12: Admin Interoperable Activity Logs, Profile History, & Invoice Dispatches
Unlocking supervisor power tools to view live logs, access profiles without logging in, and dispatch invoices directly to drivers or other managers.
- **Live Interoperable Activity Logs:**
  - Embed the live activity log directly inside the Admin Panel to easily track all interoperable actions occurring across the system.
- **Direct Admin Impersonation / Profile Access:**
  - Under the Admin Panel's team list (Managers & Drivers), clicking any account immediately opens their profile history and direct portal view as an overlay or subpage without requiring their password.
- **Settings Cleanup:**
  - Remove the redundant manager accounts management section from the Admin Settings tab, as it is already handled under the Managers tab.
- **Invoice Dispatches to Drivers:**
  - When creating an invoice (Admin or Manager level), add a "Send to Driver" toggle.
  - Selecting a driver immediately dispatches a styled invoice detail card to the driver's notification center containing:
    - Customer Name and Phone Number.
    - Route details (Starting point and Destination fetched from Admin's global list).
    - Dispatch date and time ("When").
    - Itemized lists showing quantities (individual item prices are hidden).
    - **Final price to be received** displayed prominently at the bottom.
- **Admin-Manager Invoice Queries:**
  - Admin can send a specific invoice to a manager (appears in their notification center).
  - Managers can flag or send invoices to the Admin to resolve queries.

---

## Verification Plan

### Login & Dashboard Verification
- Press `Enter` in username field and ensure focus switches to password. Press `Enter` in password field and verify login triggers.
- Submit "Today's Pending Due" with and without a phone number. Ensure no 404 error is thrown and missing numbers default to `"Not Available"`.
- Verify Manager Dashboard correctly mirrors the stats and pending due cards.

### Sharing & Scoping Verification
- Log in as Manager 1 and use "Send Details" to share a customer with Manager 3. Log in as Manager 3 and verify that the customer is now visible in their list.
- Check that suppliers created by Manager 1 are hidden from Manager 2 but visible to Admin. Verify suppliers created by Admin are visible to all managers.

### Level-Based Invoices & Phone Links
- Create an invoice as Admin and verify the invoice ID is formatted as `100XXX`. Create an invoice as Manager 1 and verify the ID is formatted as `300XXX`.
- Clear a customer's pending due. Switch to a past date in the dashboard and ensure their phone number is non-clickable, but remains clickable for current active dues.

### Activity logs & Driver Dispatches
- Access a manager's profile history directly from the Admin Panel's Managers list and verify their recent activity log is loaded correctly.
- Dispatch an invoice to a driver. Log in as the driver, check notifications, and verify the styled card displays starting point, destination, item quantities, and the final price to be received without individual item prices.
