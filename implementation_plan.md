# Backend Implementation Plan: Phase 9-12 Scoping & Activity Integration

This plan outlines the changes required to implement the complete backend functionality for Phases 9 through 12, fix existing notification/database bugs, and integrate systemic auditing (Activity Logging) across all business resources.

---

## Existing Bugs & Unfinished Backend Work

During a comprehensive analysis of the existing codebase, the following bugs and gaps were discovered in the backend:

1. **Critical Notification Mismatches in Trips Route (`backend/routes/trips.js`):**
   * **Field Name Bug:** Notifications are saved using a `user_id` field, but the `Notification` model defines it as `recipient_id`.
   * **Enum Value Mismatch (Type):** Type is saved as `'system'`, but `'system'` is not present in the `Notification` schema's enum. It should be `'trip_started'`, `'trip_completed'`, or `'general'`.
   * **Enum Value Mismatch (Priority):** Priority is saved as `'normal'`, but `'normal'` is not in the schema enum (`['low', 'medium', 'high', 'urgent']`). It should be `'medium'`.
   * *Impact:* These entries fail validation or do not return correctly when the user queries `/api/notifications`.

2. **Dormant Activity Logs (`backend/routes/activityLogs.js`):**
   * The file exports a powerful `logActivity` helper, but it is **never** imported or called anywhere else in the application routes. All administrative and data manipulation operations currently occur without being audited.

3. **Incomplete Supplier Scoping (Phase 10):**
   * The `Supplier` model has no `created_by` field, and the `/api/suppliers` route has no ownership filters. Managers can currently see and manage all suppliers globally.

4. **Missing Customer & Product Delegation (Phase 10):**
   * While models support `allowed_managers`, there are no API endpoints to trigger customer or product delegation.

5. **Incomplete Invoice Generation Transition (Phase 11):**
   * The `Invoice` pre-save hook still generates alphanumeric codes like `ADM-INV-00001` or `BRT-INV-00001` instead of the level-based 6-digit numeric invoice schemes.

---

## User Review Required

> [!IMPORTANT]
> **Level-Based Invoice Mapping:**
> Confirm the mapping of manager index to invoice ranges. We plan to query the sequential index of active managers in the system to determine the prefix digit (e.g. Creator sequence is 1st manager -> `300000+`, 2nd manager -> `400000+`, etc.).
> 
> **Walk-in Phone Match Behavior:**
> When submitting Today's Pending Dues, if the phone number is provided and matches an existing registered customer, we will link the entry to that customer's ledger rather than creating a new `customer_id: null` walk-in invoice. If no phone is provided, it defaults to `"Not Available"`.

---

## Proposed Changes

### 1. Notification Model & Core Routes

#### [MODIFY] [Notification.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/models/Notification.js)
* Add `'driver_dispatch'` and `'vehicle_incoming'` to the notification type enum to cleanly represent these business actions.

#### [MODIFY] [trips.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/trips.js)
* Fix the `Notification.create` queries:
  * Replace `user_id` with `recipient_id`.
  * Update `type` to `'trip_started'` or `'trip_completed'`.
  * Update `priority` to `'medium'`.
* Call `logActivity` when a driver starts or completes a trip.

---

### 2. Business Audit Logs Integration (Activity Logging)

#### [MODIFY] [invoices.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/invoices.js)
* Import and invoke `logActivity` for the following:
  * Creating a new invoice (`action: 'create'`, `entity_type: 'Invoice'`).
  * Editing an invoice (`action: 'update'`, `entity_type: 'Invoice'`).
  * Cancelling an invoice (`action: 'delete'`, `entity_type: 'Invoice'`).

#### [MODIFY] [products.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/products.js)
* Invoke `logActivity` for creating, updating, soft-deleting, and manually adjusting product stocks.

#### [MODIFY] [customers.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/customers.js)
* Invoke `logActivity` for creating, updating, and soft-deleting customers.

---

### 3. Manager Scoping & Sharing (Phase 10)

#### [MODIFY] [Supplier.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/models/Supplier.js)
* Add `created_by` field (referencing the `Admin` model) to track supplier ownership.

#### [MODIFY] [suppliers.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/suppliers.js)
* Populate `created_by = req.user.id` when a supplier is created.
* Implement the scope filtering on `GET /`:
  * Supervisors (Admin) can retrieve all active suppliers.
  * Managers can retrieve suppliers where `created_by === manager_id` OR created by a `supervisor` account (visible globally).
* Call `logActivity` on creation, edits, and deletions.

#### [NEW] [Delegate Endpoints]
Add endpoints inside existing routes to support manual delegation:
* **Customer Delegation (`POST /api/customers/:id/delegate`):**
  * Push `manager_id` to the customer's `allowed_managers` array.
  * Initialize their ledger entry inside the customer's `manager_balances`.
* **Product Delegation (`POST /api/products/:id/delegate`):**
  * Push `manager_id` to the product's `allowed_managers` array.

---

### 4. Level-Based Invoice Numbers (Phase 11)

#### [MODIFY] [Invoice.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/models/Invoice.js)
* Redesign the `invoiceSchema.pre('save')` auto-increment generator:
  1. Determine the creator's level digit:
     * If created by a `supervisor`, digit = `1`.
     * If created by a `manager`, locate their sequential activation order among managers. The first manager gets digit = `3`, the second gets `4`, and so on.
  2. Query the counts of existing invoices created by this user or level.
  3. Format the invoice number as a 6-digit numeric string (e.g. `100001`, `300002`).

---

### 5. Broadcasts, Today's Pending Dues, & Driver Dispatches

#### [MODIFY] [dashboard.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/dashboard.js)
* **Phone Lookup & Optional Field on Dues:**
  * In `POST /walkin-due`, if `phone` is provided, search if a registered customer exists with that phone.
  * If they exist, add the pending due directly to their manager balance rather than creating a `customer_id: null` invoice.
  * If no phone is provided, set the phone number to `"Not Available"` and proceed with creating a walk-in invoice entry.

#### [MODIFY] [deliveries.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/deliveries.js)
* **Incoming Vehicle Alert Broadcast:**
  * When a new delivery is posted in `POST /`, query all non-driver team accounts.
  * Create a bulk list of `Notification` instances to alert them that a vehicle is registered.

#### [MODIFY] [invoices.js](file:///c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/routes/invoices.js) (Driver Invoice Dispatch)
* Add a `send_to_driver` conditional handler inside invoice creation:
  * If `true`, fetch route details (starting and ending destinations) from the global system list.
  * Create a custom styled `'driver_dispatch'` notification targeted to the selected `driver_id`. The message includes item quantities (with prices removed) and the final price to be received.

---

## Verification Plan

### Automated API Verification Tests
* **Trips Notification Fix:**
  * Start a trip via `/api/trips` and check that the resulting notification is stored with the field `recipient_id`, `type: 'trip_started'`, and `priority: 'medium'`.
  * Confirm that a `GET /api/notifications` returns this notification.
* **Activity Logs Verification:**
  * Perform actions like creating an invoice or adjusting a product stock, then call `/api/activity-logs` as supervisor to ensure the action was recorded with appropriate entity descriptions.
* **Supplier Scoping Verification:**
  * Create supplier A as Manager 1 and supplier B as Manager 2. Create supplier C as Admin.
  * Manager 1 `GET /api/suppliers` must return A and C (B must be omitted). Manager 2 must see B and C.
* **Delegation Verification:**
  * Call `POST /api/customers/:id/delegate` to share with Manager 2. Ensure Manager 2 can now query and access the customer.
* **Level-Based Invoices:**
  * Create an invoice as Admin. The invoice ID must start with `1` (e.g. `100001`). Create an invoice as Manager 1. The ID must start with `3` (e.g. `300001`).
* **Today's Due Phone Matching:**
  * Call `POST /api/dashboard/walkin-due` with a phone matching a registered customer. Confirm their balance increases, and no blank customer ID invoice is added.
