"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ViewKey = "control" | "inventory" | "suppliers" | "logistics";
type MetricUnit = "percent" | "moneyM" | "money" | "count" | "days" | "ratio" | "ppm";

type Metric = {
  id: string;
  label: string;
  actual: number;
  target: number;
  previous: number;
  forecast: number;
  unit: MetricUnit;
  lowerBetter?: boolean;
  definition: string;
  formula: string;
  source: string;
  owner: string;
};

type ExceptionItem = {
  id: string;
  issue: string;
  severity: "Critical" | "High" | "Medium";
  impact: string;
  owner: string;
  due: string;
  rootCause: string;
  affected: string;
  recommendation: string;
  status: "Open" | "In progress" | "Escalated" | "Mitigated";
};

const viewMeta: Record<ViewKey, { label: string; eyebrow: string; title: string; description: string }> = {
  control: { label: "Control tower", eyebrow: "Executive decision cockpit", title: "Supply chain command center", description: "Protect service, cost and cash with one exception-led operating view." },
  inventory: { label: "Inventory", eyebrow: "Inventory intelligence", title: "Working capital & stock health", description: "Balance availability and cash at SKU, warehouse and product-family level." },
  suppliers: { label: "Suppliers", eyebrow: "Supplier performance", title: "Supplier risk & reliability", description: "Prioritize sourcing action using delivery, quality, cost and resilience signals." },
  logistics: { label: "Logistics", eyebrow: "Logistics performance", title: "Freight flow & delivery health", description: "Control freight cost, lane reliability and delivery exceptions across the network." },
};

const metrics: Record<ViewKey, Metric[]> = {
  control: [
    { id: "por", label: "Perfect order rate", actual: 94.8, target: 95, previous: 92.7, forecast: 95.2, unit: "percent", definition: "Orders delivered on time, in full, damage-free and with accurate documentation.", formula: "Perfect orders ÷ total orders × 100", source: "ERP orders + WMS shipments + TMS delivery events", owner: "VP Supply Chain" },
    { id: "inventory", label: "Inventory value", actual: 42.6, target: 41, previous: 44.5, forecast: 41.8, unit: "moneyM", lowerBetter: true, definition: "Total on-hand inventory valued at standard cost.", formula: "Σ on-hand quantity × standard unit cost", source: "ERP inventory ledger", owner: "Director, Planning" },
    { id: "otd", label: "On-time delivery", actual: 91.2, target: 93, previous: 89.8, forecast: 92.4, unit: "percent", definition: "Customer orders delivered on or before the committed date.", formula: "Orders delivered on time ÷ delivered orders × 100", source: "TMS proof of delivery + ERP promise date", owner: "Director, Logistics" },
    { id: "risk", label: "Orders at risk", actual: 186, target: 120, previous: 174, forecast: 148, unit: "count", lowerBetter: true, definition: "Open orders predicted to miss the customer promise date.", formula: "Count of open orders with projected date > promise date", source: "ATP engine + order backlog", owner: "S&OE Lead" },
  ],
  inventory: [
    { id: "turns", label: "Inventory turns", actual: 7.4, target: 8, previous: 6.8, forecast: 7.8, unit: "ratio", definition: "How many times average inventory is consumed in a year.", formula: "Annualized COGS ÷ average inventory", source: "Finance COGS + ERP inventory ledger", owner: "Director, Planning" },
    { id: "excess", label: "Excess stock", actual: 3.8, target: 3, previous: 4.2, forecast: 3.4, unit: "moneyM", lowerBetter: true, definition: "Inventory above maximum policy or without demand inside the planning horizon.", formula: "Σ max(on hand − policy maximum, 0) × cost", source: "ERP inventory + planning policy", owner: "Inventory COE Lead" },
    { id: "stockout", label: "Stockout rate", actual: 2.7, target: 2, previous: 3.5, forecast: 2.3, unit: "percent", lowerBetter: true, definition: "Share of active SKU-locations with zero available inventory and open demand.", formula: "Stocked-out SKU-locations ÷ active SKU-locations × 100", source: "WMS stock + demand plan", owner: "Regional Planning Lead" },
    { id: "doh", label: "Days on hand", actual: 48.3, target: 45, previous: 51.4, forecast: 46.2, unit: "days", lowerBetter: true, definition: "Estimated days current inventory will cover expected demand.", formula: "On-hand inventory ÷ average daily demand", source: "ERP inventory + consensus forecast", owner: "Director, Planning" },
  ],
  suppliers: [
    { id: "otif", label: "Supplier OTIF", actual: 89.6, target: 95, previous: 87.8, forecast: 91.4, unit: "percent", definition: "Purchase orders received on time and in the requested quantity.", formula: "OTIF receipt lines ÷ total receipt lines × 100", source: "ERP purchase orders + warehouse receipts", owner: "Chief Procurement Officer" },
    { id: "ppm", label: "Quality PPM", actual: 842, target: 650, previous: 961, forecast: 760, unit: "ppm", lowerBetter: true, definition: "Defective incoming units per million units received.", formula: "Rejected units ÷ received units × 1,000,000", source: "QMS inspections + ERP receipts", owner: "Supplier Quality Lead" },
    { id: "supplier-risk", label: "High-risk suppliers", actual: 11, target: 6, previous: 9, forecast: 8, unit: "count", lowerBetter: true, definition: "Strategic suppliers above the enterprise risk threshold.", formula: "Count where composite risk score ≥ 70", source: "Supplier risk model + third-party risk feed", owner: "Procurement Risk Lead" },
    { id: "ppv", label: "Purchase price variance", actual: 1.6, target: 0.5, previous: 2.3, forecast: 1.1, unit: "percent", lowerBetter: true, definition: "Difference between actual purchase price and standard or contracted price.", formula: "(Actual price − standard price) ÷ standard price × 100", source: "ERP purchase invoices + contract repository", owner: "Category Management Lead" },
  ],
  logistics: [
    { id: "freight", label: "Freight spend", actual: 6.9, target: 6.5, previous: 7.2, forecast: 6.7, unit: "moneyM", lowerBetter: true, definition: "Transportation cost accrued for outbound and intercompany shipments.", formula: "Base freight + fuel + accessorials + expedite fees", source: "TMS freight audit + finance accruals", owner: "Director, Logistics" },
    { id: "ota", label: "On-time arrival", actual: 90.4, target: 92, previous: 88.1, forecast: 91.5, unit: "percent", definition: "Shipments arriving within the committed delivery window.", formula: "On-time arrivals ÷ completed shipments × 100", source: "TMS milestones + proof of delivery", owner: "Transport Operations Lead" },
    { id: "cps", label: "Cost per shipment", actual: 284, target: 270, previous: 300, forecast: 276, unit: "money", lowerBetter: true, definition: "Average end-to-end freight cost per completed shipment.", formula: "Total freight spend ÷ completed shipments", source: "TMS freight audit", owner: "Logistics Finance Lead" },
    { id: "delayed", label: "Delayed shipments", actual: 74, target: 50, previous: 65, forecast: 58, unit: "count", lowerBetter: true, definition: "Active shipments projected to arrive after the committed window.", formula: "Count where projected arrival > delivery window end", source: "TMS predictive ETA", owner: "Transport Control Tower" },
  ],
};

const regionFactors: Record<string, number> = { Global: 1, "North America": 1.018, Europe: 1.006, "Asia Pacific": 0.952, "Latin America": 0.918 };
const productFactors: Record<string, number> = { "All products": 1, Consumer: 1.012, Industrial: 0.974, Healthcare: 1.021 };
const periodFactors: Record<string, number> = { "Last 6 months": 1, "Last 12 months": 0.988, "Year to date": 0.996 };

const exceptions: ExceptionItem[] = [
  { id: "PO-88421", issue: "Late controller component supply", severity: "Critical", impact: "$482K revenue", owner: "M. Chen", due: "Today · 16:00", rootCause: "Supplier line-2 yield loss reduced confirmed output by 38%.", affected: "12 SKUs · 41 customer orders · APAC", recommendation: "Approve alternate component and move 2,400 units by priority air.", status: "Escalated" },
  { id: "SHP-31084", issue: "Singapore port congestion", severity: "High", impact: "$318K revenue", owner: "J. Patel", due: "Tomorrow · 10:00", rootCause: "Berth delay and customs inspection added 4.2 days to ETA.", affected: "8 containers · 27 orders · Europe", recommendation: "Divert two containers through Port Klang and reallocate regional stock.", status: "In progress" },
  { id: "SKU-10922", issue: "Safety-stock breach", severity: "High", impact: "$196K margin", owner: "A. Wilson", due: "Tomorrow · 14:00", rootCause: "Demand exceeded consensus forecast by 24% for three consecutive weeks.", affected: "1 SKU · 3 warehouses · North America", recommendation: "Raise short-term forecast, rebalance 840 units and update safety-stock policy.", status: "Open" },
  { id: "SUP-00418", issue: "Incoming quality hold · Batch 42", severity: "Medium", impact: "$124K cost", owner: "S. Garcia", due: "21 Aug · 12:00", rootCause: "Dimension Cpk fell below 1.0 after supplier tool change.", affected: "6,200 units · 2 plants · Industrial", recommendation: "Release conforming lots after 100% sort and launch supplier 8D.", status: "In progress" },
];

const regionRows = [
  { code: "NA", name: "North America", service: 96.2, orders: 4281, margin: "$8.4M", status: "On track" },
  { code: "EU", name: "Europe", service: 93.7, orders: 3104, margin: "$6.1M", status: "On track" },
  { code: "AP", name: "Asia Pacific", service: 88.4, orders: 2891, margin: "$5.3M", status: "Watch" },
  { code: "LA", name: "Latin America", service: 84.9, orders: 1072, margin: "$1.8M", status: "At risk" },
];

const inventoryRows = [
  { id: "SKU-10922", item: "Smart controller X2", site: "Dallas DC", class: "A / X", doh: 4, value: "$184K", status: "Stockout risk" },
  { id: "SKU-31804", item: "Power module 800", site: "Rotterdam DC", class: "A / Y", doh: 118, value: "$326K", status: "Excess" },
  { id: "SKU-07211", item: "Valve assembly C", site: "Singapore DC", class: "B / Z", doh: 9, value: "$96K", status: "Watch" },
  { id: "SKU-44107", item: "Sensor pack Pro", site: "Chicago DC", class: "A / X", doh: 42, value: "$214K", status: "Healthy" },
];

const supplierRows = [
  { id: "SUP-00418", name: "Apex Components", country: "Malaysia", otif: 78.4, ppm: 1840, spend: "$4.8M", risk: "Critical" },
  { id: "SUP-00871", name: "NordWerk GmbH", country: "Germany", otif: 96.1, ppm: 310, spend: "$3.6M", risk: "Low" },
  { id: "SUP-00192", name: "Kanto Precision", country: "Japan", otif: 91.7, ppm: 620, spend: "$5.2M", risk: "Medium" },
  { id: "SUP-00604", name: "Monterrey Metals", country: "Mexico", otif: 86.5, ppm: 970, spend: "$2.9M", risk: "High" },
];

const laneRows = [
  { id: "LANE-014", lane: "Shanghai → Los Angeles", mode: "Ocean", ota: 82.1, volume: "186 FEU", cost: "$2,840/FEU", status: "At risk" },
  { id: "LANE-022", lane: "Frankfurt → Chicago", mode: "Air", ota: 94.8, volume: "92 tons", cost: "$4.18/kg", status: "On track" },
  { id: "LANE-038", lane: "Monterrey → Dallas", mode: "Road", ota: 91.3, volume: "418 loads", cost: "$1,420/load", status: "Watch" },
  { id: "LANE-047", lane: "Singapore → Rotterdam", mode: "Ocean", ota: 79.6, volume: "104 FEU", cost: "$2,510/FEU", status: "At risk" },
];

const trends: Record<ViewKey, { label: string; actual: number[]; target: number; suffix: string; insight: string }> = {
  control: { label: "Perfect order rate", actual: [88, 89, 91, 90, 93, 94.8], target: 95, suffix: "%", insight: "Service recovered while inventory fell 4.3%; expedite cost remains the main watch item." },
  inventory: { label: "Inventory turns", actual: [6.3, 6.5, 6.8, 7.0, 7.2, 7.4], target: 8, suffix: "×", insight: "Working capital improved for five consecutive months; A-class excess remains concentrated in 18 SKUs." },
  suppliers: { label: "Supplier OTIF", actual: [85.9, 86.8, 87.8, 88.4, 89.1, 89.6], target: 95, suffix: "%", insight: "Top-quartile suppliers are stable, but four strategic suppliers explain 71% of late receipts." },
  logistics: { label: "On-time arrival", actual: [86.4, 87.2, 88.1, 88.7, 89.5, 90.4], target: 92, suffix: "%", insight: "Network performance improved, but Asia–Europe ocean lanes continue to miss committed windows." },
};

function formatValue(value: number, unit: MetricUnit) {
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "moneyM") return `$${value.toFixed(1)}M`;
  if (unit === "money") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (unit === "days") return `${value.toFixed(1)} days`;
  if (unit === "ratio") return `${value.toFixed(1)}×`;
  if (unit === "ppm") return Math.round(value).toLocaleString("en-US");
  return Math.round(value).toLocaleString("en-US");
}

function adjustedMetric(metric: Metric, factor: number) {
  const directionFactor = metric.lowerBetter ? 2 - factor : factor;
  return { ...metric, actual: metric.actual * directionFactor, previous: metric.previous * directionFactor, forecast: metric.forecast * directionFactor };
}

function Delta({ metric }: { metric: Metric }) {
  const delta = metric.actual - metric.target;
  const good = metric.lowerBetter ? delta <= 0 : delta >= 0;
  const prefix = delta > 0 ? "+" : "";
  const deltaText = metric.unit === "percent" ? `${prefix}${delta.toFixed(1)} pts` : formatValue(Math.abs(delta), metric.unit);
  return <span className={good ? "target-delta good" : "target-delta bad"}>{good ? "On/above target" : "Gap to target"} · {metric.unit === "percent" ? deltaText : `${delta > 0 ? "+" : "−"}${deltaText}`}</span>;
}

function TrendChart({ view, factor }: { view: ViewKey; factor: number }) {
  const trend = trends[view];
  const values = trend.actual.map((value) => value * factor);
  const max = Math.max(trend.target, ...values) * 1.08;
  const min = Math.min(...values) * .92;
  const range = max - min || 1;
  return (
    <div className="trend-chart" role="img" aria-label={`${trend.label} increased from ${values[0].toFixed(1)}${trend.suffix} to ${values[5].toFixed(1)}${trend.suffix}; target ${trend.target}${trend.suffix}.`}>
      <div className="trend-plot">
        <div className="target-line" style={{ bottom: `${((trend.target - min) / range) * 100}%` }}><span>Target {trend.target}{trend.suffix}</span></div>
        {values.map((value, index) => (
          <div className="trend-column" key={index}><div className="trend-bar" style={{ height: `${Math.max(8, ((value - min) / range) * 100)}%` }}><span>{value.toFixed(1)}{trend.suffix}</span></div></div>
        ))}
      </div>
      <div className="trend-labels">{["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((month) => <span key={month}>{month}</span>)}</div>
    </div>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("control");
  const [region, setRegion] = useState("Global");
  const [period, setPeriod] = useState("Last 6 months");
  const [product, setProduct] = useState("All products");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");
  const [metricDetail, setMetricDetail] = useState<Metric | null>(null);
  const [exceptionDetail, setExceptionDetail] = useState<ExceptionItem | null>(null);
  const [drillDetail, setDrillDetail] = useState<Record<string, string | number> | null>(null);
  const [exceptionStatus, setExceptionStatus] = useState<Record<string, ExceptionItem["status"]>>({});
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const factor = regionFactors[region] * productFactors[product] * periodFactors[period];
  const currentMetrics = useMemo(() => metrics[view].map((metric) => adjustedMetric(metric, factor)), [view, factor]);
  const meta = viewMeta[view];
  const openCount = exceptions.filter((item) => (exceptionStatus[item.id] ?? item.status) !== "Mitigated").length;

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMetricDetail(null); setExceptionDetail(null); setDrillDetail(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (metricDetail || exceptionDetail || drillDetail) drawerCloseRef.current?.focus();
  }, [metricDetail, exceptionDetail, drillDetail]);

  function changeView(next: ViewKey) {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function exportCurrentView() {
    const filterRows = [`Dashboard,${meta.label}`, `Region,${region}`, `Product,${product}`, `Period,${period}`, "", "KPI,Actual,Target,Previous,Forecast,Status"];
    const metricRows = currentMetrics.map((m) => [m.label, formatValue(m.actual, m.unit), formatValue(m.target, m.unit), formatValue(m.previous, m.unit), formatValue(m.forecast, m.unit), (m.lowerBetter ? m.actual <= m.target : m.actual >= m.target) ? "On target" : "Gap"].join(","));
    const detailHeader = view === "control" ? "Region,Service level,Open orders,Margin,Status" : view === "inventory" ? "SKU,Item,Site,Class,DOH,Value,Status" : view === "suppliers" ? "Supplier,Name,Country,OTIF,PPM,Spend,Risk" : "Lane,Route,Mode,OTA,Volume,Cost,Status";
    const rows = view === "control" ? regionRows.map((r) => `${r.name},${r.service}%,${r.orders},${r.margin},${r.status}`) : view === "inventory" ? inventoryRows.map((r) => `${r.id},${r.item},${r.site},${r.class},${r.doh},${r.value},${r.status}`) : view === "suppliers" ? supplierRows.map((r) => `${r.id},${r.name},${r.country},${r.otif}%,${r.ppm},${r.spend},${r.risk}`) : laneRows.map((r) => `${r.id},${r.lane},${r.mode},${r.ota}%,${r.volume},${r.cost},${r.status}`);
    const blob = new Blob([[...filterRows, ...metricRows, "", detailHeader, ...rows].join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `northstar-${view}-${region.toLowerCase().replaceAll(" ", "-")}-2026-08-19.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`${meta.label} report exported with active filters`);
  }

  function renderExceptions(limit = 4) {
    return <div className="exception-list">{exceptions.slice(0, limit).map((item) => {
      const status = exceptionStatus[item.id] ?? item.status;
      return <button className="exception-row" key={item.id} onClick={() => setExceptionDetail({ ...item, status })}>
        <span className={`severity severity-${item.severity.toLowerCase()}`}>{item.severity}</span>
        <span className="exception-copy"><b>{item.issue}</b><small>{item.id} · {item.owner} · Due {item.due}</small></span>
        <span className="exception-impact"><b>{item.impact}</b><small>{status}</small></span><span className="row-arrow" aria-hidden="true">›</span>
      </button>;
    })}</div>;
  }

  function renderControl() {
    return <>
      <article className="panel panel-wide"><PanelHeader title="Service performance" subtitle={`${trends.control.label} vs. target · ${region}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart view="control" factor={factor} /><div className="insight-strip"><span>Management insight</span><p>{trends.control.insight}</p></div></article>
      <article className="panel balance-panel"><PanelHeader title="Service · Cost · Cash" subtitle="Balanced operating outcomes" /><div className="balance-list"><div><span>Service</span><b>{formatValue(currentMetrics[0].actual, currentMetrics[0].unit)}</b><small className="good">+2.1 pts vs prior</small></div><div><span>Cost</span><b>$284 / shipment</b><small className="good">−5.3% vs prior</small></div><div><span>Cash</span><b>48.3 DOH</b><small className="warn">3.3 days over target</small></div></div><div className="tradeoff-note"><b>Trade-off watch</b><p>Expedite spend is 12% above plan. Service recovery is not yet structurally sustainable.</p></div></article>
      <article className="panel panel-wide"><PanelHeader title="Regional performance" subtitle="Click a region to drill from network to orders" action={<span className="data-note">11,348 open orders</span>} /><div className="data-table control-table"><div className="table-head"><span>Region</span><span>Service</span><span>Open orders</span><span>Margin</span><span>Status</span></div>{regionRows.filter((r) => region === "Global" || r.name === region).map((row) => <button className="table-row" key={row.code} onClick={() => setDrillDetail({ Type: "Region", Region: row.name, "Service level": `${row.service}%`, "Open orders": row.orders, "Margin exposed": row.margin, "Primary driver": row.status === "At risk" ? "Carrier reliability and customs dwell" : row.status === "Watch" ? "Component constraints" : "Stable operations" })}><span className="entity"><i>{row.code}</i><b>{row.name}</b></span><span><b>{row.service}%</b><i className="progress"><i style={{ width: `${row.service}%` }} /></i></span><span>{row.orders.toLocaleString()}</span><span>{row.margin}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Priority exceptions" subtitle="Ranked by business impact" action={<span className="exception-count">{openCount} open</span>} />{renderExceptions()}<button className="panel-action" onClick={() => showToast("Exception portfolio added to the executive report")}>Add exception portfolio to report</button></article>
    </>;
  }

  function renderInventory() {
    const mix = [68, 19, 13];
    return <>
      <article className="panel panel-wide"><PanelHeader title="Inventory turns trend" subtitle={`Annualized turns vs. 8.0× target · ${product}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart view="inventory" factor={factor} /><div className="insight-strip"><span>Planning insight</span><p>{trends.inventory.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Inventory health" subtitle="$42.6M on-hand value" /><div className="health-layout"><div className="health-donut" style={{ background: `conic-gradient(var(--success) 0 ${mix[0]}%, var(--amber) ${mix[0]}% ${mix[0] + mix[1]}%, var(--danger) ${mix[0] + mix[1]}% 100%)` }}><span><b>68%</b><small>Healthy</small></span></div><div className="health-legend"><p><i className="healthy" />Healthy <b>68%</b></p><p><i className="excess" />Excess <b>19%</b></p><p><i className="risk" />At risk <b>13%</b></p></div></div><div className="policy-note"><span>Policy opportunity</span><b>$1.7M</b><small>cash release in top 18 excess SKUs</small></div></article>
      <article className="panel panel-wide"><PanelHeader title="SKU exception workbench" subtitle="ABC/XYZ segmented inventory action list" action={<span className="data-note">143 at-risk SKUs</span>} /><div className="data-table inventory-table"><div className="table-head"><span>SKU / item</span><span>Site</span><span>ABC / XYZ</span><span>DOH</span><span>Value</span><span>Status</span></div>{inventoryRows.map((row) => <button className="table-row" key={row.id} onClick={() => setDrillDetail({ Type: "SKU", SKU: row.id, Item: row.item, Site: row.site, Segment: row.class, "Days on hand": row.doh, "Inventory value": row.value, Recommendation: row.status === "Excess" ? "Cancel open PO and rebalance to two deficit sites" : row.status === "Stockout risk" ? "Expedite inbound supply and reserve stock for priority customers" : "Monitor against policy" })}><span className="entity stacked"><b>{row.item}</b><small>{row.id}</small></span><span>{row.site}</span><span className="segment-chip">{row.class}</span><span>{row.doh}</span><span>{row.value}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Working-capital bridge" subtitle="Change vs. prior period" /><div className="bridge-chart"><div><i style={{ height: "76%" }} /><b>$44.5M</b><span>Opening</span></div><div className="negative-bar"><i style={{ height: "38%" }} /><b>−$2.6M</b><span>Consumption</span></div><div className="positive-bar"><i style={{ height: "18%" }} /><b>+$0.7M</b><span>Receipts</span></div><div><i style={{ height: "68%" }} /><b>$42.6M</b><span>Closing</span></div></div><div className="tradeoff-note"><b>Service safeguard</b><p>Cash release retained a 95% projected fill rate; 12 SKUs need policy exceptions.</p></div></article>
    </>;
  }

  function renderSuppliers() {
    return <>
      <article className="panel panel-wide"><PanelHeader title="Supplier OTIF trend" subtitle="Receipt-line performance vs. 95% target" action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart view="suppliers" factor={factor} /><div className="insight-strip"><span>Sourcing insight</span><p>{trends.suppliers.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Risk concentration" subtitle="Supply impact × probability" /><div className="risk-matrix" role="img" aria-label="Supplier risk matrix: Apex Components is critical, Monterrey Metals is high risk, Kanto Precision is medium risk, NordWerk is low risk."><span className="matrix-label y">Impact</span><span className="matrix-label x">Probability</span><i className="matrix-dot critical" style={{ left: "76%", bottom: "76%" }}><b>AC</b></i><i className="matrix-dot high" style={{ left: "62%", bottom: "58%" }}><b>MM</b></i><i className="matrix-dot medium" style={{ left: "43%", bottom: "47%" }}><b>KP</b></i><i className="matrix-dot low" style={{ left: "21%", bottom: "24%" }}><b>NW</b></i></div><div className="matrix-summary"><b>$5.1M</b><span>annual spend exposed to high-risk suppliers</span></div></article>
      <article className="panel panel-wide"><PanelHeader title="Supplier scorecard" subtitle="Delivery, quality, spend and composite risk" action={<span className="data-note">126 active suppliers</span>} /><div className="data-table supplier-table"><div className="table-head"><span>Supplier</span><span>Country</span><span>OTIF</span><span>Quality PPM</span><span>Spend</span><span>Risk</span></div>{supplierRows.map((row) => <button className="table-row" key={row.id} onClick={() => setDrillDetail({ Type: "Supplier", Supplier: row.name, ID: row.id, Country: row.country, OTIF: `${row.otif}%`, "Quality PPM": row.ppm, "Annual spend": row.spend, "Required action": row.risk === "Critical" ? "Executive recovery plan, alternate source qualification and weekly review" : row.risk === "High" ? "30-day corrective action plan" : "Continue standard governance" })}><span className="entity stacked"><b>{row.name}</b><small>{row.id}</small></span><span>{row.country}</span><span><b>{row.otif}%</b></span><span>{row.ppm.toLocaleString()}</span><span>{row.spend}</span><span className={`status ${row.risk.toLowerCase()}`}>{row.risk}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Quality loss drivers" subtitle="Incoming defects by category" /><div className="horizontal-bars">{[{ n: "Dimensions", v: 42 }, { n: "Surface finish", v: 27 }, { n: "Electrical", v: 19 }, { n: "Packaging", v: 12 }].map((item) => <div key={item.n}><span>{item.n}</span><i><i style={{ width: `${item.v}%` }} /></i><b>{item.v}%</b></div>)}</div><div className="tradeoff-note"><b>Root-cause focus</b><p>Two suppliers contribute 63% of dimensional defects. Both have open 8D actions.</p></div></article>
    </>;
  }

  function renderLogistics() {
    return <>
      <article className="panel panel-wide"><PanelHeader title="On-time arrival trend" subtitle={`Predictive ETA performance vs. 92% target · ${region}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart view="logistics" factor={factor} /><div className="insight-strip"><span>Logistics insight</span><p>{trends.logistics.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Mode mix & cost" subtitle="Share of freight spend" /><div className="mode-mix">{[{ n: "Ocean", v: 44, c: "$3.0M" }, { n: "Road", v: 31, c: "$2.1M" }, { n: "Air", v: 17, c: "$1.2M" }, { n: "Parcel", v: 8, c: "$0.6M" }].map((item) => <div key={item.n}><span><b>{item.n}</b><small>{item.c}</small></span><i><i style={{ width: `${item.v}%` }} /></i><strong>{item.v}%</strong></div>)}</div><div className="policy-note"><span>Expedite opportunity</span><b>$410K</b><small>avoidable premium freight</small></div></article>
      <article className="panel panel-wide"><PanelHeader title="Lane performance" subtitle="Click a lane to inspect delay drivers and action" action={<span className="data-note">38 active lanes</span>} /><div className="data-table lane-table"><div className="table-head"><span>Lane</span><span>Mode</span><span>OTA</span><span>Volume</span><span>Unit cost</span><span>Status</span></div>{laneRows.map((row) => <button className="table-row" key={row.id} onClick={() => setDrillDetail({ Type: "Lane", Lane: row.lane, ID: row.id, Mode: row.mode, "On-time arrival": `${row.ota}%`, Volume: row.volume, "Unit cost": row.cost, Recommendation: row.status === "At risk" ? "Review carrier allocation, add milestone alert and activate alternate routing" : "Maintain allocation and monitor weekly" })}><span className="entity stacked"><b>{row.lane}</b><small>{row.id}</small></span><span>{row.mode}</span><span><b>{row.ota}%</b></span><span>{row.volume}</span><span>{row.cost}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Delay root causes" subtitle="Hours of delay contribution" /><div className="horizontal-bars delay-bars">{[{ n: "Port dwell", v: 38 }, { n: "Carrier capacity", v: 26 }, { n: "Customs", v: 21 }, { n: "Weather", v: 15 }].map((item) => <div key={item.n}><span>{item.n}</span><i><i style={{ width: `${item.v * 2}%` }} /></i><b>{item.v}h</b></div>)}</div><div className="tradeoff-note"><b>Network action</b><p>Port dwell explains the largest controllable gap. Rerouting two sailings protects 27 orders.</p></div></article>
    </>;
  }

  const activeDrawer = metricDetail || exceptionDetail || drillDetail;

  return <div className={dark ? "app dark" : "app"}>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Northstar</span></div>
      <nav><p className="nav-label">Decision cockpit</p>{(Object.keys(viewMeta) as ViewKey[]).map((key) => <button key={key} className={view === key ? "nav-item active" : "nav-item"} onClick={() => changeView(key)} aria-current={view === key ? "page" : undefined}><span className={`nav-glyph glyph-${key}`} aria-hidden="true" />{viewMeta[key].label}{key === "control" && <span className="live-dot" aria-label="Live data" />}</button>)}<p className="nav-label nav-label-spaced">Governance</p><button className="nav-item" onClick={() => showToast("Executive report workspace opened")}><span className="nav-glyph glyph-reports" aria-hidden="true" />Executive report</button><button className="nav-item" onClick={() => showToast("Metric catalog is available from every KPI info button")}><span className="nav-glyph glyph-settings" aria-hidden="true" />Metric catalog</button></nav>
      <div className="sidebar-footer"><div className="data-health"><span className="status-pulse" /><span><b>All sources healthy</b><small>Refreshed 8 min ago</small></span></div><div className="profile"><span>TC</span><span><b>Taylor Chen</b><small>Operations lead</small></span></div></div>
    </aside>

    <main id="main" className="main">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Northstar</div><div className="breadcrumbs"><span>Analytics</span><i>/</i><b>{meta.label}</b><span className="freshness"><i />Live · 8 min</span></div><div className="top-actions"><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? "Light mode" : "Dark mode"}</button><button className="primary-button" onClick={exportCurrentView}><span aria-hidden="true">↓</span>Export current view</button></div></header>
      <div className="content">
        <section className="page-heading"><div><p className="eyebrow"><span />{meta.eyebrow}</p><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="filters" aria-label="Dashboard filters"><label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}>{Object.keys(regionFactors).map((v) => <option key={v}>{v}</option>)}</select></label><label>Product family<select value={product} onChange={(e) => setProduct(e.target.value)}>{Object.keys(productFactors).map((v) => <option key={v}>{v}</option>)}</select></label><label>Period<select value={period} onChange={(e) => setPeriod(e.target.value)}>{Object.keys(periodFactors).map((v) => <option key={v}>{v}</option>)}</select></label></div></section>

        <section className="management-brief" aria-label="Management brief"><span className="brief-label">Management brief</span><div><b>{view === "control" ? "Service recovery is visible, but not yet structurally secure." : view === "inventory" ? "Cash is improving without a material service penalty." : view === "suppliers" ? "Risk is concentrated enough for targeted intervention." : "Reliability is improving; premium freight remains the margin leak."}</b><p>{view === "control" ? `${openCount} priority exceptions expose $1.12M. APAC component supply is the first action.` : view === "inventory" ? "Eighteen A-class SKUs hold $1.7M of excess while 12 policy exceptions protect customer service." : view === "suppliers" ? "Four strategic suppliers explain 71% of late receipts; alternate-source qualification is the highest-value action." : "Two ocean lanes drive 58% of late hours. Rerouting protects 27 customer orders."}</p></div><button onClick={() => showToast("Management brief added to the executive report")}>Add to report</button></section>

        <section className="metric-grid" aria-label="Key performance indicators">{currentMetrics.map((metric) => {
          const onTarget = metric.lowerBetter ? metric.actual <= metric.target : metric.actual >= metric.target;
          const movementGood = metric.lowerBetter ? metric.actual < metric.previous : metric.actual > metric.previous;
          return <article className="metric-card" key={metric.id}><div className="metric-label"><span>{metric.label}</span><button onClick={() => setMetricDetail(metric)} aria-label={`View definition for ${metric.label}`}>i</button></div><div className="metric-value"><strong>{formatValue(metric.actual, metric.unit)}</strong><span className={onTarget ? "metric-state good" : "metric-state bad"}>{onTarget ? "On target" : "Gap"}</span></div><Delta metric={metric} /><div className="metric-comparison"><span>Previous <b className={movementGood ? "good" : "bad"}>{formatValue(metric.previous, metric.unit)}</b></span><span>Forecast <b>{formatValue(metric.forecast, metric.unit)}</b></span></div></article>;
        })}</section>

        <section className={`dashboard-grid view-${view}`}>{view === "control" ? renderControl() : view === "inventory" ? renderInventory() : view === "suppliers" ? renderSuppliers() : renderLogistics()}</section>
        <footer className="dashboard-footer"><span>Northstar Supply Intelligence</span><span>Illustrative portfolio data · Metric catalog v2.1 · Aug 2026</span></footer>
      </div>
    </main>

    {activeDrawer && <div className="drawer-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { setMetricDetail(null); setExceptionDetail(null); setDrillDetail(null); } }}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><button ref={drawerCloseRef} className="drawer-close" onClick={() => { setMetricDetail(null); setExceptionDetail(null); setDrillDetail(null); }} aria-label="Close detail panel">×</button>
      {metricDetail && <><p className="drawer-eyebrow">Metric catalog</p><h2 id="drawer-title">{metricDetail.label}</h2><p className="drawer-summary">{metricDetail.definition}</p><div className="drawer-kpi"><span>Actual<strong>{formatValue(metricDetail.actual, metricDetail.unit)}</strong></span><span>Target<strong>{formatValue(metricDetail.target, metricDetail.unit)}</strong></span><span>Forecast<strong>{formatValue(metricDetail.forecast, metricDetail.unit)}</strong></span></div><dl className="definition-list"><div><dt>Formula</dt><dd>{metricDetail.formula}</dd></div><div><dt>Data source</dt><dd>{metricDetail.source}</dd></div><div><dt>Business owner</dt><dd>{metricDetail.owner}</dd></div><div><dt>Refresh cadence</dt><dd>Every 15 minutes · daily finance reconciliation</dd></div><div><dt>Data grain</dt><dd>Order line × SKU × location × event date</dd></div></dl><button className="drawer-primary" onClick={() => showToast(`${metricDetail.label} definition copied`)}>Copy metric definition</button></>}
      {exceptionDetail && <><p className="drawer-eyebrow">Exception action center</p><h2 id="drawer-title">{exceptionDetail.issue}</h2><div className="exception-meta"><span className={`severity severity-${exceptionDetail.severity.toLowerCase()}`}>{exceptionDetail.severity}</span><span>{exceptionDetail.id}</span><span>{exceptionDetail.impact}</span></div><section className="drawer-section"><h3>Root cause</h3><p>{exceptionDetail.rootCause}</p></section><section className="drawer-section"><h3>Business exposure</h3><p>{exceptionDetail.affected}</p></section><section className="drawer-section recommendation"><h3>Recommended action</h3><p>{exceptionDetail.recommendation}</p></section><dl className="definition-list compact"><div><dt>Owner</dt><dd>{exceptionDetail.owner}</dd></div><div><dt>Commitment</dt><dd>{exceptionDetail.due}</dd></div></dl><label className="status-select">Action status<select value={exceptionStatus[exceptionDetail.id] ?? exceptionDetail.status} onChange={(e) => { const status = e.target.value as ExceptionItem["status"]; setExceptionStatus((old) => ({ ...old, [exceptionDetail.id]: status })); setExceptionDetail({ ...exceptionDetail, status }); showToast(`${exceptionDetail.id} moved to ${status}`); }}><option>Open</option><option>In progress</option><option>Escalated</option><option>Mitigated</option></select></label><button className="drawer-primary" onClick={() => { setExceptionStatus((old) => ({ ...old, [exceptionDetail.id]: "Mitigated" })); setExceptionDetail(null); showToast(`${exceptionDetail.id} marked mitigated`); }}>Mark action mitigated</button></>}
      {drillDetail && <><p className="drawer-eyebrow">Drill-down · {String(drillDetail.Type)}</p><h2 id="drawer-title">{String(drillDetail.Region ?? drillDetail.Item ?? drillDetail.Supplier ?? drillDetail.Lane)}</h2><p className="drawer-summary">Network → {region} → {String(drillDetail.Type)} → operational detail</p><dl className="definition-list">{Object.entries(drillDetail).filter(([key]) => key !== "Type").map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><section className="drawer-section recommendation"><h3>Decision support</h3><p>This drill-down preserves the active {product} and {period.toLowerCase()} filter context.</p></section><button className="drawer-primary" onClick={() => showToast(`${String(drillDetail.Type)} detail added to report`)}>Add detail to report</button></>}
    </aside></div>}
    {toast && <div className="toast" role="status" aria-live="polite"><span>✓</span>{toast}</div>}
  </div>;
}
