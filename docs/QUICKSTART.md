# Quick start: replace data, keep the dashboard

You do not need to edit the React page or KPI formulas.

1. Copy the five blank files from `templates/`.
2. Fill them with your exports, preserving the header names.
3. Replace the matching files in `public/data/`.
4. Edit company name, refresh date and KPI targets in `public/config/dashboard.json`.
5. Run `npm run validate:data`, then `npm run dev`.

The dashboard automatically discovers regions and product families, applies the period filters, recalculates all 16 KPIs and rebuilds every detail table.

## Minimum viable setup

All five files must exist, but they can be built gradually. Start with `orders.csv` and `inventory.csv`; keep at least one valid sample row in the other files until your own exports are ready.

## Dates and numbers

- Dates use `YYYY-MM-DD`.
- Numbers must not include currency symbols or thousands separators.
- Boolean values use `true` or `false`.
- Blank actual dates mean the order or shipment is still open.
- CSV files must use UTF-8 encoding.

## Publish your version

Commit the five data files and configuration to GitHub. If the data is confidential, use anonymized or aggregated records before publishing.
