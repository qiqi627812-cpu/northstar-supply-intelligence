# Data dictionary

## `orders.csv`

One row per order or order line. Drives perfect order rate, on-time delivery, orders at risk and regional performance.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `order_id` | text | yes | Unique order or order-line identifier |
| `region`, `product_family` | text | yes | Shared dashboard filters |
| `order_date`, `promise_date` | date | yes | Order creation and committed delivery dates |
| `delivery_date` | date | no | Actual delivery; blank while open |
| `projected_delivery_date` | date | no | Latest predicted delivery |
| `ordered_qty`, `delivered_qty` | number | yes | Requested and delivered quantities |
| `damage_free`, `documentation_accurate` | boolean | yes | Perfect-order quality flags |
| `revenue` | number | yes | Revenue value without currency symbols |
| `status` | text | yes | `Delivered`, `Open` or `At risk` |

## `inventory.csv`

One row per SKU-location snapshot. Drives inventory value, turns, excess, stockout rate, days on hand and the SKU workbench.

Required measures are `on_hand_qty`, `unit_cost`, `avg_daily_demand`, `max_stock_qty` and `annual_cogs`. `inventory_class` can contain an ABC/XYZ label such as `A / X`.

## `suppliers.csv`

One row per purchase-order receipt. Drives supplier OTIF, quality PPM, high-risk supplier count, purchase-price variance and the supplier scorecard.

`risk_score` uses a 0–100 scale: below 45 low, 45–69 medium, 70–84 high, and 85+ critical.

## `shipments.csv`

One row per shipment batch, lane-period or freight invoice group. Drives freight spend, on-time arrival, cost per shipment, delayed shipments, mode mix and lane performance.

Use `shipment_count = 1` for shipment-level data. For aggregated rows, enter the number of shipment equivalents represented by the row.

## `exceptions.csv`

One row per management exception. Severity must be `Critical`, `High` or `Medium`; status must be `Open`, `In progress`, `Escalated` or `Mitigated`.

## KPI assumptions

Prior and forecast comparisons are illustrative baselines generated from the current actual. Replace that logic in `app/dashboard-data.ts` if you connect a historical forecast table. Targets are controlled in `public/config/dashboard.json`.
