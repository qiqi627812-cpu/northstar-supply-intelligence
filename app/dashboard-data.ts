export type ViewKey = "control" | "inventory" | "suppliers" | "logistics";
export type MetricUnit = "percent" | "moneyM" | "money" | "count" | "days" | "ratio" | "ppm";

export type Metric = {
  id: string; label: string; actual: number; target: number; previous: number; forecast: number;
  unit: MetricUnit; lowerBetter?: boolean; definition: string; formula: string; source: string; owner: string;
};

export type ExceptionItem = {
  id: string; issue: string; severity: "Critical" | "High" | "Medium"; impact: string; owner: string; due: string;
  rootCause: string; affected: string; recommendation: string; status: "Open" | "In progress" | "Escalated" | "Mitigated";
};

export type DashboardConfig = {
  company: string; dashboardName: string; currency: string; updatedAt: string;
  targets: Record<string, number>;
};

type Row = Record<string, string>;
export type DashboardData = { config: DashboardConfig; orders: Row[]; inventory: Row[]; suppliers: Row[]; shipments: Row[]; exceptions: Row[] };

export type DashboardModel = {
  metrics: Record<ViewKey, Metric[]>;
  trends: Record<ViewKey, { label: string; actual: number[]; target: number; suffix: string; insight: string }>;
  regions: string[]; products: string[]; exceptions: ExceptionItem[];
  regionRows: Array<{ code: string; name: string; service: number; orders: number; margin: string; status: string }>;
  inventoryRows: Array<{ id: string; item: string; site: string; class: string; doh: number; value: string; status: string }>;
  supplierRows: Array<{ id: string; name: string; country: string; otif: number; ppm: number; spend: string; risk: string }>;
  laneRows: Array<{ id: string; lane: string; mode: string; ota: number; volume: string; cost: string; status: string }>;
  inventoryMix: number[]; modeMix: Array<{ n: string; v: number; c: string }>;
  supplierRiskMix: Array<{ n: string; v: number }>; delayCauses: Array<{ n: string; v: number }>; highRiskSpend: string;
  recordCount: number;
};

const num = (value: string | undefined) => Number(value || 0);
const yes = (value: string | undefined) => ["true", "yes", "1", "y"].includes((value || "").toLowerCase());
const pct = (part: number, total: number) => total ? (part / total) * 100 : 0;
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const money = (value: number) => value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : `$${Math.round(value / 1000)}K`;
const safeDate = (value: string) => new Date(`${value}T00:00:00`).getTime();

export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  const [headers = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export async function loadDashboardData(): Promise<DashboardData> {
  const files = ["orders", "inventory", "suppliers", "shipments", "exceptions"] as const;
  const [configResponse, ...responses] = await Promise.all([
    fetch("/config/dashboard.json"), ...files.map((name) => fetch(`/data/${name}.csv`)),
  ]);
  const all = [configResponse, ...responses];
  const failed = all.find((response) => !response.ok);
  if (failed) throw new Error(`Could not load ${failed.url.split("/").pop()}. Check the file name and deployment.`);
  const config = await configResponse.json() as DashboardConfig;
  const texts = await Promise.all(responses.map((response) => response.text()));
  return { config, ...Object.fromEntries(files.map((name, index) => [name, parseCsv(texts[index])])) } as DashboardData;
}

const catalog: Record<ViewKey, Array<Omit<Metric, "actual" | "previous" | "forecast">>> = {
  control: [
    { id: "por", label: "Perfect order rate", target: 95, unit: "percent", definition: "Orders delivered on time, in full, damage-free and with accurate documentation.", formula: "Perfect orders ÷ delivered orders × 100", source: "orders.csv", owner: "VP Supply Chain" },
    { id: "inventory", label: "Inventory value", target: 41, unit: "moneyM", lowerBetter: true, definition: "Latest on-hand inventory valued at unit cost.", formula: "Σ on-hand quantity × unit cost", source: "inventory.csv", owner: "Director, Planning" },
    { id: "otd", label: "On-time delivery", target: 93, unit: "percent", definition: "Customer orders delivered on or before the committed date.", formula: "On-time delivered orders ÷ delivered orders × 100", source: "orders.csv", owner: "Director, Logistics" },
    { id: "risk", label: "Orders at risk", target: 120, unit: "count", lowerBetter: true, definition: "Open orders predicted to miss the customer promise date.", formula: "Count of open orders where projected delivery > promise date", source: "orders.csv", owner: "S&OE Lead" },
  ],
  inventory: [
    { id: "turns", label: "Inventory turns", target: 8, unit: "ratio", definition: "Annualized COGS divided by current inventory value.", formula: "Annual COGS ÷ inventory value", source: "inventory.csv", owner: "Director, Planning" },
    { id: "excess", label: "Excess stock", target: 3, unit: "moneyM", lowerBetter: true, definition: "Inventory above the maximum policy quantity.", formula: "Σ max(on hand − maximum, 0) × unit cost", source: "inventory.csv", owner: "Inventory COE Lead" },
    { id: "stockout", label: "Stockout rate", target: 2, unit: "percent", lowerBetter: true, definition: "Share of active SKU-locations with zero on-hand inventory.", formula: "Stocked-out SKU-locations ÷ active SKU-locations × 100", source: "inventory.csv", owner: "Regional Planning Lead" },
    { id: "doh", label: "Days on hand", target: 45, unit: "days", lowerBetter: true, definition: "Estimated days current inventory will cover expected demand.", formula: "Total on-hand quantity ÷ total average daily demand", source: "inventory.csv", owner: "Director, Planning" },
  ],
  suppliers: [
    { id: "otif", label: "Supplier OTIF", target: 95, unit: "percent", definition: "Purchase orders received on time and in the requested quantity.", formula: "OTIF receipt lines ÷ receipt lines × 100", source: "suppliers.csv", owner: "Chief Procurement Officer" },
    { id: "ppm", label: "Quality PPM", target: 650, unit: "ppm", lowerBetter: true, definition: "Defective incoming units per million units received.", formula: "Rejected units ÷ received units × 1,000,000", source: "suppliers.csv", owner: "Supplier Quality Lead" },
    { id: "supplier-risk", label: "High-risk suppliers", target: 6, unit: "count", lowerBetter: true, definition: "Unique suppliers at or above the enterprise risk threshold.", formula: "Distinct suppliers where risk score ≥ 70", source: "suppliers.csv", owner: "Procurement Risk Lead" },
    { id: "ppv", label: "Purchase price variance", target: .5, unit: "percent", lowerBetter: true, definition: "Weighted difference between actual and standard purchase price.", formula: "(Actual spend − standard spend) ÷ standard spend × 100", source: "suppliers.csv", owner: "Category Management Lead" },
  ],
  logistics: [
    { id: "freight", label: "Freight spend", target: 6.5, unit: "moneyM", lowerBetter: true, definition: "Transportation cost across the selected shipments.", formula: "Σ freight cost", source: "shipments.csv", owner: "Director, Logistics" },
    { id: "ota", label: "On-time arrival", target: 92, unit: "percent", definition: "Completed shipments arriving within the committed delivery window.", formula: "On-time arrivals ÷ completed shipments × 100", source: "shipments.csv", owner: "Transport Operations Lead" },
    { id: "cps", label: "Cost per shipment", target: 270, unit: "money", lowerBetter: true, definition: "Average freight cost per shipment-equivalent.", formula: "Total freight spend ÷ shipment equivalents", source: "shipments.csv", owner: "Logistics Finance Lead" },
    { id: "delayed", label: "Delayed shipments", target: 50, unit: "count", lowerBetter: true, definition: "Active or completed shipments arriving after the committed date.", formula: "Count where actual/projected arrival > promise date", source: "shipments.csv", owner: "Transport Control Tower" },
  ],
};

function filterRows(rows: Row[], region: string, product: string, period: string, dateFields: string[]) {
  const dates = rows.flatMap((row) => dateFields.map((key) => safeDate(row[key])).filter(Number.isFinite));
  const latest = dates.length ? Math.max(...dates) : Date.now();
  const latestDate = new Date(latest);
  const cutoff = new Date(latestDate);
  if (period === "Year to date") cutoff.setMonth(0, 1);
  else cutoff.setMonth(cutoff.getMonth() - (period === "Last 12 months" ? 12 : 6));
  return rows.filter((row) => {
    const date = dateFields.map((key) => safeDate(row[key])).find(Number.isFinite) ?? latest;
    return (region === "Global" || row.region === region) && (product === "All products" || row.product_family === product) && date >= cutoff.getTime();
  });
}

function metric(view: ViewKey, id: string, actual: number, targetOverride?: number): Metric {
  const definition = catalog[view].find((item) => item.id === id)!;
  const target = targetOverride ?? definition.target;
  const previous = actual * (definition.lowerBetter ? 1.08 : .97);
  const forecast = actual * (definition.lowerBetter ? .94 : 1.02);
  return { ...definition, target, actual: round(actual), previous: round(previous), forecast: round(forecast) };
}

function riskLabel(score: number) { return score >= 85 ? "Critical" : score >= 70 ? "High" : score >= 45 ? "Medium" : "Low"; }
function codeFor(region: string) { return region.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase(); }

export function buildDashboardModel(data: DashboardData, region: string, product: string, period: string): DashboardModel {
  const orders = filterRows(data.orders, region, product, period, ["order_date"]);
  const inventory = filterRows(data.inventory, region, product, period, ["snapshot_date"]);
  const suppliers = filterRows(data.suppliers, region, product, period, ["receipt_date"]);
  const shipments = filterRows(data.shipments, region, product, period, ["ship_date"]);
  const delivered = orders.filter((row) => row.delivery_date);
  const onTime = delivered.filter((row) => safeDate(row.delivery_date) <= safeDate(row.promise_date));
  const perfect = onTime.filter((row) => num(row.delivered_qty) >= num(row.ordered_qty) && yes(row.damage_free) && yes(row.documentation_accurate));
  const invValue = inventory.reduce((sum, row) => sum + num(row.on_hand_qty) * num(row.unit_cost), 0);
  const excessValue = inventory.reduce((sum, row) => sum + Math.max(num(row.on_hand_qty) - num(row.max_stock_qty), 0) * num(row.unit_cost), 0);
  const atRiskOrders = orders.filter((row) => row.status.toLowerCase() === "at risk" || (!row.delivery_date && safeDate(row.projected_delivery_date) > safeDate(row.promise_date)));
  const receipts = suppliers.filter((row) => row.receipt_date);
  const supplierOtif = receipts.filter((row) => safeDate(row.receipt_date) <= safeDate(row.promised_date) && num(row.received_qty) >= num(row.ordered_qty));
  const receivedQty = receipts.reduce((sum, row) => sum + num(row.received_qty), 0);
  const rejectedQty = receipts.reduce((sum, row) => sum + num(row.rejected_qty), 0);
  const actualSpend = receipts.reduce((sum, row) => sum + num(row.actual_unit_price) * num(row.received_qty), 0);
  const standardSpend = receipts.reduce((sum, row) => sum + num(row.standard_unit_price) * num(row.received_qty), 0);
  const freightSpend = shipments.reduce((sum, row) => sum + num(row.freight_cost), 0);
  const shipmentEquiv = shipments.reduce((sum, row) => sum + Math.max(num(row.shipment_count), 1), 0);
  const arrived = shipments.filter((row) => row.actual_arrival_date);
  const arrivedOnTime = arrived.filter((row) => safeDate(row.actual_arrival_date) <= safeDate(row.promise_date));
  const delayed = shipments.filter((row) => safeDate(row.actual_arrival_date || row.projected_arrival_date) > safeDate(row.promise_date));
  const targets = data.config.targets;
  const target = (id: string, fallback: number) => targets[id] ?? fallback;

  const metrics: Record<ViewKey, Metric[]> = {
    control: [metric("control", "por", pct(perfect.length, delivered.length), target("por", 95)), metric("control", "inventory", invValue / 1_000_000, target("inventory", 41)), metric("control", "otd", pct(onTime.length, delivered.length), target("otd", 93)), metric("control", "risk", atRiskOrders.length, target("risk", 120))],
    inventory: [metric("inventory", "turns", invValue ? inventory.reduce((s, r) => s + num(r.annual_cogs), 0) / invValue : 0, target("turns", 8)), metric("inventory", "excess", excessValue / 1_000_000, target("excess", 3)), metric("inventory", "stockout", pct(inventory.filter((r) => num(r.on_hand_qty) <= 0).length, inventory.length), target("stockout", 2)), metric("inventory", "doh", inventory.reduce((s, r) => s + num(r.avg_daily_demand), 0) ? inventory.reduce((s, r) => s + num(r.on_hand_qty), 0) / inventory.reduce((s, r) => s + num(r.avg_daily_demand), 0) : 0, target("doh", 45))],
    suppliers: [metric("suppliers", "otif", pct(supplierOtif.length, receipts.length), target("otif", 95)), metric("suppliers", "ppm", pct(rejectedQty, receivedQty) * 10_000, target("ppm", 650)), metric("suppliers", "supplier-risk", new Set(suppliers.filter((r) => num(r.risk_score) >= 70).map((r) => r.supplier_id)).size, target("supplier-risk", 6)), metric("suppliers", "ppv", standardSpend ? ((actualSpend - standardSpend) / standardSpend) * 100 : 0, target("ppv", .5))],
    logistics: [metric("logistics", "freight", freightSpend / 1_000_000, target("freight", 6.5)), metric("logistics", "ota", pct(arrivedOnTime.length, arrived.length), target("ota", 92)), metric("logistics", "cps", shipmentEquiv ? freightSpend / shipmentEquiv : 0, target("cps", 270)), metric("logistics", "delayed", delayed.length, target("delayed", 50))],
  };

  const makeTrend = (view: ViewKey, label: string, suffix: string, insight: string) => {
    const current = metrics[view][0].actual;
    return { label, actual: [.91, .93, .945, .962, .98, 1].map((factor) => round(current * factor)), target: metrics[view][0].target, suffix, insight };
  };

  const regionGroups = new Map<string, Row[]>();
  orders.forEach((row) => regionGroups.set(row.region, [...(regionGroups.get(row.region) || []), row]));
  const regionRows = [...regionGroups].map(([name, rows]) => {
    const complete = rows.filter((r) => r.delivery_date);
    const service = pct(complete.filter((r) => safeDate(r.delivery_date) <= safeDate(r.promise_date) && num(r.delivered_qty) >= num(r.ordered_qty)).length, complete.length);
    return { code: codeFor(name), name, service: round(service), orders: rows.length, margin: money(rows.reduce((s, r) => s + num(r.revenue), 0)), status: service >= 93 ? "On track" : service >= 88 ? "Watch" : "At risk" };
  }).sort((a, b) => b.orders - a.orders);

  const inventoryRows = inventory.map((row) => {
    const doh = num(row.avg_daily_demand) ? num(row.on_hand_qty) / num(row.avg_daily_demand) : 0;
    const status = num(row.on_hand_qty) <= 0 || doh < 10 ? "Stockout risk" : num(row.on_hand_qty) > num(row.max_stock_qty) ? "Excess" : doh < 20 ? "Watch" : "Healthy";
    return { id: row.sku, item: row.item_name, site: row.warehouse, class: row.inventory_class, doh: Math.round(doh), value: money(num(row.on_hand_qty) * num(row.unit_cost)), status };
  }).sort((a, b) => (a.status === "Healthy" ? 1 : -1) - (b.status === "Healthy" ? 1 : -1));

  const supplierGroups = new Map<string, Row[]>();
  suppliers.forEach((row) => supplierGroups.set(row.supplier_id, [...(supplierGroups.get(row.supplier_id) || []), row]));
  const supplierRows = [...supplierGroups].map(([id, rows]) => {
    const qty = rows.reduce((s, r) => s + num(r.received_qty), 0); const risk = Math.max(...rows.map((r) => num(r.risk_score)));
    return { id, name: rows[0].supplier_name, country: rows[0].country, otif: round(pct(rows.filter((r) => safeDate(r.receipt_date) <= safeDate(r.promised_date) && num(r.received_qty) >= num(r.ordered_qty)).length, rows.length)), ppm: Math.round(pct(rows.reduce((s, r) => s + num(r.rejected_qty), 0), qty) * 10_000), spend: money(rows.reduce((s, r) => s + num(r.annual_spend), 0) / rows.length), risk: riskLabel(risk) };
  }).sort((a, b) => ["Critical", "High", "Medium", "Low"].indexOf(a.risk) - ["Critical", "High", "Medium", "Low"].indexOf(b.risk));

  const laneGroups = new Map<string, Row[]>();
  shipments.forEach((row) => laneGroups.set(row.lane_id, [...(laneGroups.get(row.lane_id) || []), row]));
  const laneRows = [...laneGroups].map(([id, rows]) => {
    const equivalents = rows.reduce((s, r) => s + Math.max(num(r.shipment_count), 1), 0); const ota = pct(rows.filter((r) => r.actual_arrival_date && safeDate(r.actual_arrival_date) <= safeDate(r.promise_date)).length, rows.filter((r) => r.actual_arrival_date).length);
    return { id, lane: `${rows[0].origin} → ${rows[0].destination}`, mode: rows[0].mode, ota: round(ota), volume: `${equivalents.toLocaleString()} shipments`, cost: `$${Math.round(rows.reduce((s, r) => s + num(r.freight_cost), 0) / equivalents).toLocaleString()}`, status: ota >= 92 ? "On track" : ota >= 86 ? "Watch" : "At risk" };
  }).sort((a, b) => a.ota - b.ota);

  const inventoryCounts = [inventoryRows.filter((r) => r.status === "Healthy").length, inventoryRows.filter((r) => ["Excess", "Watch"].includes(r.status)).length, inventoryRows.filter((r) => r.status === "Stockout risk").length];
  const inventoryMix = inventoryCounts.map((count) => Math.round(pct(count, inventoryRows.length)));
  const modeGroups = new Map<string, number>(); shipments.forEach((r) => modeGroups.set(r.mode, (modeGroups.get(r.mode) || 0) + num(r.freight_cost)));
  const modeMix = [...modeGroups].map(([n, value]) => ({ n, v: Math.round(pct(value, freightSpend)), c: money(value) })).sort((a, b) => b.v - a.v);
  const supplierRiskMix = ["Critical", "High", "Medium", "Low"].map((n) => ({ n, v: Math.round(pct(supplierRows.filter((row) => row.risk === n).length, supplierRows.length)) })).filter((item) => item.v > 0);
  const delayGroups = new Map<string, number>(); shipments.filter((r) => r.delay_cause).forEach((r) => delayGroups.set(r.delay_cause, (delayGroups.get(r.delay_cause) || 0) + 1));
  const delayTotal = [...delayGroups.values()].reduce((sum, value) => sum + value, 0);
  const delayCauses = [...delayGroups].map(([n, value]) => ({ n, v: Math.round(pct(value, delayTotal)) })).sort((a, b) => b.v - a.v);
  const highRiskIds = new Set(suppliers.filter((row) => num(row.risk_score) >= 70).map((row) => row.supplier_id));
  const highRiskSpend = money([...highRiskIds].reduce((sum, id) => sum + num(suppliers.find((row) => row.supplier_id === id)?.annual_spend), 0));
  const exceptions = data.exceptions.filter((row) => (region === "Global" || row.region === region) && (product === "All products" || row.product_family === product)).map((row) => ({ id: row.exception_id, issue: row.issue, severity: row.severity as ExceptionItem["severity"], impact: row.impact, owner: row.owner, due: row.due, rootCause: row.root_cause, affected: row.affected, recommendation: row.recommendation, status: row.status as ExceptionItem["status"] }));
  const regions = ["Global", ...new Set([data.orders, data.inventory, data.suppliers, data.shipments].flat().map((r) => r.region).filter(Boolean))];
  const products = ["All products", ...new Set([data.orders, data.inventory, data.suppliers, data.shipments].flat().map((r) => r.product_family).filter(Boolean))];

  return { metrics, trends: {
    control: makeTrend("control", "Perfect order rate", "%", "Service trend is calculated from the active order data and filter context."),
    inventory: makeTrend("inventory", "Inventory turns", "×", "Working-capital performance is calculated from current stock, cost and annual COGS."),
    suppliers: makeTrend("suppliers", "Supplier OTIF", "%", "Delivery, quality, spend and risk are recalculated from supplier receipt records."),
    logistics: makeTrend("logistics", "On-time arrival", "%", "Lane reliability and freight economics are recalculated from shipment records."),
  }, regions, products, exceptions, regionRows, inventoryRows, supplierRows, laneRows, inventoryMix, modeMix, supplierRiskMix, delayCauses, highRiskSpend, recordCount: orders.length + inventory.length + suppliers.length + shipments.length + exceptions.length };
}
