import { readFile } from "node:fs/promises";

const schemas = {
  orders: ["order_id", "region", "product_family", "order_date", "promise_date", "ordered_qty", "delivered_qty", "damage_free", "documentation_accurate", "revenue", "status"],
  inventory: ["snapshot_date", "region", "product_family", "sku", "item_name", "warehouse", "on_hand_qty", "unit_cost", "avg_daily_demand", "max_stock_qty", "annual_cogs"],
  suppliers: ["receipt_id", "receipt_date", "region", "product_family", "supplier_id", "supplier_name", "promised_date", "ordered_qty", "received_qty", "rejected_qty", "standard_unit_price", "actual_unit_price", "risk_score"],
  shipments: ["shipment_id", "ship_date", "region", "product_family", "lane_id", "origin", "destination", "mode", "promise_date", "freight_cost", "shipment_count", "status"],
  exceptions: ["exception_id", "region", "product_family", "issue", "severity", "impact", "owner", "root_cause", "recommendation", "status"],
};

let failed = false;
for (const [name, required] of Object.entries(schemas)) {
  const path = new URL(`../public/data/${name}.csv`, import.meta.url);
  try {
    const text = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
    const [header = "", ...rows] = text.trim().split(/\r?\n/);
    const fields = header.split(",").map((field) => field.trim());
    const missing = required.filter((field) => !fields.includes(field));
    if (missing.length) { console.error(`✗ ${name}.csv: missing ${missing.join(", ")}`); failed = true; }
    else if (!rows.length) { console.error(`✗ ${name}.csv: add at least one data row`); failed = true; }
    else console.log(`✓ ${name}.csv: ${rows.length} rows, required fields present`);
  } catch (error) { console.error(`✗ ${name}.csv: ${error.message}`); failed = true; }
}

try {
  const config = JSON.parse(await readFile(new URL("../public/config/dashboard.json", import.meta.url), "utf8"));
  if (!config.company || !config.targets) throw new Error("company and targets are required");
  console.log(`✓ dashboard.json: ${config.company}, ${Object.keys(config.targets).length} KPI targets`);
} catch (error) { console.error(`✗ dashboard.json: ${error.message}`); failed = true; }

if (failed) process.exit(1);
console.log("\nData package is ready for the dashboard.");
