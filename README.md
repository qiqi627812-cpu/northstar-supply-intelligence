# Northstar Supply Intelligence

![Northstar Supply Intelligence portfolio cover](public/og.jpg)

A decision-grade supply chain control tower built to demonstrate business judgment, KPI governance, exception management, data storytelling and product-quality dashboard design.

## Executive question

> How can an operations leader protect customer service while reducing inventory and responding to supply risk early?

Northstar answers this with four connected analytical workspaces:

| Workspace | Decision supported |
| --- | --- |
| **Control tower** | Where are service, cost and cash out of balance? |
| **Inventory** | Which SKU-locations can release cash without hurting service? |
| **Suppliers** | Which partners need recovery, alternate sourcing or escalation? |
| **Logistics** | Which modes and lanes are driving cost and delivery risk? |

## What makes this more than a UI demo

- Region, product-family and period filters change KPIs and analytical trends
- Every KPI shows actual, target, prior period, forecast and target variance
- KPI information buttons open a governed metric definition, formula, source, owner and grain
- Regions, SKUs, suppliers and lanes support contextual drill-down
- Priority exceptions include root cause, business exposure, recommendation, owner, due time and mutable action status
- CSV export includes the current workspace and active filter context
- Management briefs translate analysis into a decision and recommended action
- Responsive light and dark themes include keyboard focus, screen-reader summaries and reduced-motion support

## Analytical framework

Northstar is organized around the operating trade-off between service, cost and cash.

```text
Customer service
  ├─ Perfect order rate
  ├─ On-time delivery / arrival
  └─ Fill and stockout risk

Operating cost
  ├─ Freight and expedite spend
  ├─ Cost per shipment
  ├─ Purchase price variance
  └─ Supplier quality loss

Working capital
  ├─ Inventory value
  ├─ Inventory turns
  ├─ Days on hand
  └─ Excess inventory
```

## Example management story

1. Perfect order performance is recovering, but remains just below target.
2. Inventory fell while service improved, indicating real working-capital progress.
3. Expedite spend is still above plan, so the service recovery is not yet structurally sustainable.
4. APAC component supply and two ocean lanes create the highest immediate revenue exposure.
5. Alternate-source approval, targeted rebalancing and lane rerouting are the recommended actions.

## Conceptual data model

The illustrative interface is designed around a reusable star-schema pattern:

```text
FactOrderLine       → Date, Customer, Product, Location, Order Status
FactInventoryDaily  → Date, Product, Location, Inventory Policy
FactSupplierReceipt → Date, Supplier, Product, Plant, Quality Result
FactShipmentEvent   → Date, Shipment, Lane, Carrier, Mode, Milestone
FactException       → Exception, Owner, Severity, Status, Due Date
```

Shared dimensions allow the same region, product and time filters to drive all four workspaces.

## Run locally

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify the project

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

## Suggested interview walkthrough

1. Open the **Control tower** and explain the service–cost–cash trade-off.
2. Change the region and product filters to demonstrate analytical context.
3. Open a KPI definition to explain governance and calculation logic.
4. Drill into an underperforming region, SKU, supplier or lane.
5. Open a priority exception and move it through the action workflow.
6. Export the current analytical context as evidence of a complete user journey.

## Data note

All names and numbers are intentionally fictional. The data is safe to publish in a public portfolio repository.

## License

MIT — adapt the visual system and replace the illustrative data with your own model.
