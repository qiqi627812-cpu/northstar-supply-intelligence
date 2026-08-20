# ERP / WMS / TMS field mapping

Use this as a practical crosswalk when preparing exports. Names differ by system, so map by business meaning rather than exact label.

| Template file | Template field | Common source | Typical source labels |
| --- | --- | --- | --- |
| orders | `order_id` | ERP | Sales Order, SO Number, Customer Order |
| orders | `promise_date` | ERP / OMS | Requested Delivery Date, Confirmed Date |
| orders | `delivery_date` | TMS / ERP | POD Date, Actual Delivery Date |
| orders | `ordered_qty` | ERP | Order Quantity, Requested Quantity |
| orders | `delivered_qty` | ERP / WMS | Shipped Quantity, Delivered Quantity |
| inventory | `on_hand_qty` | WMS / ERP | On Hand, Unrestricted Stock, Available Stock |
| inventory | `unit_cost` | ERP / Finance | Standard Cost, Moving Average Cost |
| inventory | `avg_daily_demand` | Planning | Forecast per Day, Daily Run Rate |
| inventory | `max_stock_qty` | Planning | Order-up-to Level, Maximum Policy |
| suppliers | `promised_date` | ERP / SRM | PO Due Date, Confirmed Receipt Date |
| suppliers | `receipt_date` | WMS / ERP | Goods Receipt Date, GR Posting Date |
| suppliers | `rejected_qty` | QMS | Rejected Units, Nonconforming Quantity |
| suppliers | `risk_score` | SRM / manual | Composite Risk, Supplier Risk Index |
| shipments | `promise_date` | TMS / ERP | Delivery Window End, Committed Arrival |
| shipments | `freight_cost` | TMS / Finance | Freight Audit Amount, Accrued Transport Cost |
| shipments | `shipment_count` | TMS | Loads, Containers, Shipment Equivalents |
| exceptions | `recommendation` | S&OE / manual | Recovery Action, Recommended Decision |

If one source cannot provide a field, create it in Power Query, SQL, Python or your ETL layer before exporting the CSV.
