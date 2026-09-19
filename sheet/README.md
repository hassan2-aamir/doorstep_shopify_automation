# Fulfillment sheet setup (step 0.2)

The sheet is the supplier's whole interface, and its header row is a contract with both flows. The flows
find columns **by header name**, so names must match exactly.

1. Create a Google Sheet named **Doorstep Fulfillment** and rename the first tab to **Fulfillment**.
2. Paste row 1 from `fulfillment-headers.csv` (File → Import → Upload → "Replace current sheet", or paste
   the line and use Data → Split text to columns):
   `order_id, order_number, created_at, buyer_name, buyer_email, buyer_phone, ship_address, items, status, tracking_number, carrier, notified_at`
3. View → Freeze → 1 row.
4. Format columns `order_id`, `order_number`, `buyer_phone`, `tracking_number` as **Plain text**
   (Format → Number → Plain text) so leading `+`/zeros survive.
5. Select `status` (column I) → Data → Data validation → Dropdown: `New`, `Notified`, `Cancelled`.
6. Select `carrier` (column K) → Dropdown: `DHL`, `FedEx`, `UPS`, `TCS`, `Leopards`, `Other`.
7. Fill `tracking_number` and `carrier` headers with a highlight colour and add a note
   "Supplier fills these". Grey the other headers.
8. Select columns A–I and L → Data → Protect sheets and ranges → **Show a warning** (not restrict), so the
   supplier is warned but Flow A can still write.
9. Put the sheet URL in `evidence/ids.md` and in the host app via
   `POST /api/workspace {"sheetUrl": "..."}` (or re-run `npm run seed -- --sheet <url>`).
