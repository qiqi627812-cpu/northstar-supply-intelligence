"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildDashboardModel, loadDashboardData, type DashboardData, type ExceptionItem, type Metric, type MetricUnit, type ViewKey } from "./dashboard-data";

const viewMeta: Record<ViewKey, { label: string; eyebrow: string; title: string; description: string }> = {
  control: { label: "Control tower", eyebrow: "Executive decision cockpit", title: "Supply chain command center", description: "Protect service, cost and cash with one exception-led operating view." },
  inventory: { label: "Inventory", eyebrow: "Inventory intelligence", title: "Working capital & stock health", description: "Balance availability and cash at SKU, warehouse and product-family level." },
  suppliers: { label: "Suppliers", eyebrow: "Supplier performance", title: "Supplier risk & reliability", description: "Prioritize sourcing action using delivery, quality, cost and resilience signals." },
  logistics: { label: "Logistics", eyebrow: "Logistics performance", title: "Freight flow & delivery health", description: "Control freight cost, lane reliability and delivery exceptions across the network." },
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

function Delta({ metric }: { metric: Metric }) {
  const delta = metric.actual - metric.target;
  const good = metric.lowerBetter ? delta <= 0 : delta >= 0;
  const prefix = delta > 0 ? "+" : "";
  const deltaText = metric.unit === "percent" ? `${prefix}${delta.toFixed(1)} pts` : formatValue(Math.abs(delta), metric.unit);
  return <span className={good ? "target-delta good" : "target-delta bad"}>{good ? "On/above target" : "Gap to target"} · {metric.unit === "percent" ? deltaText : `${delta > 0 ? "+" : "−"}${deltaText}`}</span>;
}

function TrendChart({ trend }: { trend: { label: string; actual: number[]; target: number; suffix: string } }) {
  const values = trend.actual;
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataError, setDataError] = useState("");
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const model = useMemo(() => data ? buildDashboardModel(data, region, product, period) : null, [data, region, product, period]);
  const meta = viewMeta[view];

  useEffect(() => {
    loadDashboardData().then(setData).catch((error: Error) => setDataError(error.message));
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMetricDetail(null); setExceptionDetail(null); setDrillDetail(null); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (metricDetail || exceptionDetail || drillDetail) drawerCloseRef.current?.focus();
  }, [metricDetail, exceptionDetail, drillDetail]);

  if (dataError) return <main className="data-state"><div><span>Data connection issue</span><h1>The template could not read its CSV files.</h1><p>{dataError}</p><p>Run <b>npm run validate:data</b> to identify the field or file that needs attention.</p></div></main>;
  if (!data || !model) return <main className="data-state"><div><span>Northstar template</span><h1>Loading your supply-chain data…</h1><p>Reading orders, inventory, suppliers, shipments and exceptions.</p></div></main>;

  const { metrics, trends, exceptions, regionRows, inventoryRows, supplierRows, laneRows, inventoryMix, modeMix, supplierRiskMix, delayCauses, highRiskSpend, regions, products } = model;
  const currentMetrics = metrics[view];
  const openCount = exceptions.filter((item) => (exceptionStatus[item.id] ?? item.status) !== "Mitigated").length;

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
    link.download = `northstar-${view}-${region.toLowerCase().replaceAll(" ", "-")}.csv`;
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
      <article className="panel panel-wide"><PanelHeader title="Service performance" subtitle={`${trends.control.label} vs. target · ${region}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart trend={trends.control} /><div className="insight-strip"><span>Management insight</span><p>{trends.control.insight}</p></div></article>
      <article className="panel balance-panel"><PanelHeader title="Service · Cost · Cash" subtitle="Balanced operating outcomes" /><div className="balance-list"><div><span>Service</span><b>{formatValue(metrics.control[0].actual, metrics.control[0].unit)}</b><small className="good">calculated from orders.csv</small></div><div><span>Cost</span><b>{formatValue(metrics.logistics[2].actual, metrics.logistics[2].unit)} / shipment</b><small className="good">calculated from shipments.csv</small></div><div><span>Cash</span><b>{formatValue(metrics.inventory[3].actual, metrics.inventory[3].unit)}</b><small className="warn">calculated from inventory.csv</small></div></div><div className="tradeoff-note"><b>Template logic</b><p>Every outcome in this panel recalculates when the source CSVs or filters change.</p></div></article>
      <article className="panel panel-wide"><PanelHeader title="Regional performance" subtitle="Click a region to drill from network to orders" action={<span className="data-note">{regionRows.reduce((sum, row) => sum + row.orders, 0).toLocaleString()} orders</span>} /><div className="data-table control-table"><div className="table-head"><span>Region</span><span>Service</span><span>Orders</span><span>Revenue</span><span>Status</span></div>{regionRows.map((row) => <button className="table-row" key={row.code} onClick={() => setDrillDetail({ Type: "Region", Region: row.name, "Service level": `${row.service}%`, Orders: row.orders, Revenue: row.margin, "Primary driver": row.status === "At risk" ? "Carrier reliability and customs dwell" : row.status === "Watch" ? "Component constraints" : "Stable operations" })}><span className="entity"><i>{row.code}</i><b>{row.name}</b></span><span><b>{row.service}%</b><i className="progress"><i style={{ width: `${row.service}%` }} /></i></span><span>{row.orders.toLocaleString()}</span><span>{row.margin}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Priority exceptions" subtitle="Ranked by business impact" action={<span className="exception-count">{openCount} open</span>} />{renderExceptions()}<button className="panel-action" onClick={() => showToast("Exception portfolio added to the executive report")}>Add exception portfolio to report</button></article>
    </>;
  }

  function renderInventory() {
    const mix = inventoryMix;
    return <>
      <article className="panel panel-wide"><PanelHeader title="Inventory turns trend" subtitle={`Annualized turns vs. ${trends.inventory.target.toFixed(1)}× target · ${product}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart trend={trends.inventory} /><div className="insight-strip"><span>Planning insight</span><p>{trends.inventory.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Inventory health" subtitle={`${formatValue(metrics.control[1].actual, "moneyM")} on-hand value`} /><div className="health-layout"><div className="health-donut" style={{ background: `conic-gradient(var(--success) 0 ${mix[0]}%, var(--amber) ${mix[0]}% ${mix[0] + mix[1]}%, var(--danger) ${mix[0] + mix[1]}% 100%)` }}><span><b>{mix[0]}%</b><small>Healthy</small></span></div><div className="health-legend"><p><i className="healthy" />Healthy <b>{mix[0]}%</b></p><p><i className="excess" />Excess / watch <b>{mix[1]}%</b></p><p><i className="risk" />At risk <b>{mix[2]}%</b></p></div></div><div className="policy-note"><span>Policy opportunity</span><b>{formatValue(metrics.inventory[1].actual, "moneyM")}</b><small>stock above maximum policy</small></div></article>
      <article className="panel panel-wide"><PanelHeader title="SKU exception workbench" subtitle="ABC/XYZ segmented inventory action list" action={<span className="data-note">{inventoryRows.filter((row) => row.status !== "Healthy").length} exceptions</span>} /><div className="data-table inventory-table"><div className="table-head"><span>SKU / item</span><span>Site</span><span>ABC / XYZ</span><span>DOH</span><span>Value</span><span>Status</span></div>{inventoryRows.map((row) => <button className="table-row" key={`${row.id}-${row.site}`} onClick={() => setDrillDetail({ Type: "SKU", SKU: row.id, Item: row.item, Site: row.site, Segment: row.class, "Days on hand": row.doh, "Inventory value": row.value, Recommendation: row.status === "Excess" ? "Cancel open PO and rebalance to deficit sites" : row.status === "Stockout risk" ? "Expedite inbound supply and reserve stock for priority customers" : "Monitor against policy" })}><span className="entity stacked"><b>{row.item}</b><small>{row.id}</small></span><span>{row.site}</span><span className="segment-chip">{row.class}</span><span>{row.doh}</span><span>{row.value}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Working-capital bridge" subtitle="Current model vs. previous-period baseline" /><div className="bridge-chart"><div><i style={{ height: "76%" }} /><b>{formatValue(metrics.control[1].previous, "moneyM")}</b><span>Opening</span></div><div className="negative-bar"><i style={{ height: "38%" }} /><b>{formatValue(Math.abs(metrics.control[1].previous - metrics.control[1].actual), "moneyM")}</b><span>Net change</span></div><div className="positive-bar"><i style={{ height: "18%" }} /><b>{inventoryRows.length}</b><span>SKU-sites</span></div><div><i style={{ height: "68%" }} /><b>{formatValue(metrics.control[1].actual, "moneyM")}</b><span>Closing</span></div></div><div className="tradeoff-note"><b>Service safeguard</b><p>{inventoryRows.filter((row) => row.status === "Stockout risk").length} SKU-sites require protection while the excess-stock program releases cash.</p></div></article>
    </>;
  }

  function renderSuppliers() {
    return <>
      <article className="panel panel-wide"><PanelHeader title="Supplier OTIF trend" subtitle={`Receipt-line performance vs. ${trends.suppliers.target}% target`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart trend={trends.suppliers} /><div className="insight-strip"><span>Sourcing insight</span><p>{trends.suppliers.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Risk concentration" subtitle="Composite supplier-risk distribution" /><div className="risk-matrix" role="img" aria-label="Supplier risk map generated from the current data."><span className="matrix-label y">Impact</span><span className="matrix-label x">Probability</span>{supplierRows.slice(0, 4).map((row, index) => { const level = ["Low", "Medium", "High", "Critical"].indexOf(row.risk); const position = 20 + level * 18; return <i key={row.id} className={`matrix-dot ${row.risk.toLowerCase()}`} style={{ left: `${Math.min(82, position + index * 3)}%`, bottom: `${Math.min(82, position)}%` }} title={`${row.name}: ${row.risk}`}><b>{row.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2)}</b></i>; })}</div><div className="matrix-summary"><b>{highRiskSpend}</b><span>annual spend exposed to high-risk suppliers</span></div></article>
      <article className="panel panel-wide"><PanelHeader title="Supplier scorecard" subtitle="Delivery, quality, spend and composite risk" action={<span className="data-note">{supplierRows.length} active suppliers</span>} /><div className="data-table supplier-table"><div className="table-head"><span>Supplier</span><span>Country</span><span>OTIF</span><span>Quality PPM</span><span>Spend</span><span>Risk</span></div>{supplierRows.map((row) => <button className="table-row" key={row.id} onClick={() => setDrillDetail({ Type: "Supplier", Supplier: row.name, ID: row.id, Country: row.country, OTIF: `${row.otif}%`, "Quality PPM": row.ppm, "Annual spend": row.spend, "Required action": row.risk === "Critical" ? "Executive recovery plan, alternate source qualification and weekly review" : row.risk === "High" ? "30-day corrective action plan" : "Continue standard governance" })}><span className="entity stacked"><b>{row.name}</b><small>{row.id}</small></span><span>{row.country}</span><span><b>{row.otif}%</b></span><span>{row.ppm.toLocaleString()}</span><span>{row.spend}</span><span className={`status ${row.risk.toLowerCase()}`}>{row.risk}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Supplier risk mix" subtitle="Share of suppliers by risk tier" /><div className="horizontal-bars">{supplierRiskMix.map((item) => <div key={item.n}><span>{item.n}</span><i><i style={{ width: `${item.v}%` }} /></i><b>{item.v}%</b></div>)}</div><div className="tradeoff-note"><b>Root-cause focus</b><p>{supplierRows.filter((row) => ["Critical", "High"].includes(row.risk)).length} suppliers require formal recovery or alternate-source action.</p></div></article>
    </>;
  }

  function renderLogistics() {
    return <>
      <article className="panel panel-wide"><PanelHeader title="On-time arrival trend" subtitle={`Predictive ETA performance vs. ${trends.logistics.target}% target · ${region}`} action={<span className="chart-legend"><i />Actual <i className="target-key" />Target</span>} /><TrendChart trend={trends.logistics} /><div className="insight-strip"><span>Logistics insight</span><p>{trends.logistics.insight}</p></div></article>
      <article className="panel"><PanelHeader title="Mode mix & cost" subtitle="Share of freight spend" /><div className="mode-mix">{modeMix.map((item) => <div key={item.n}><span><b>{item.n}</b><small>{item.c}</small></span><i><i style={{ width: `${item.v}%` }} /></i><strong>{item.v}%</strong></div>)}</div><div className="policy-note"><span>Data source</span><b>{modeMix.length} modes</b><small>calculated from shipments.csv</small></div></article>
      <article className="panel panel-wide"><PanelHeader title="Lane performance" subtitle="Click a lane to inspect delay drivers and action" action={<span className="data-note">{laneRows.length} active lanes</span>} /><div className="data-table lane-table"><div className="table-head"><span>Lane</span><span>Mode</span><span>OTA</span><span>Volume</span><span>Unit cost</span><span>Status</span></div>{laneRows.map((row) => <button className="table-row" key={row.id} onClick={() => setDrillDetail({ Type: "Lane", Lane: row.lane, ID: row.id, Mode: row.mode, "On-time arrival": `${row.ota}%`, Volume: row.volume, "Unit cost": row.cost, Recommendation: row.status === "At risk" ? "Review carrier allocation, add milestone alert and activate alternate routing" : "Maintain allocation and monitor weekly" })}><span className="entity stacked"><b>{row.lane}</b><small>{row.id}</small></span><span>{row.mode}</span><span><b>{row.ota}%</b></span><span>{row.volume}</span><span>{row.cost}</span><span className={`status ${row.status.toLowerCase().replaceAll(" ", "-")}`}>{row.status}</span></button>)}</div></article>
      <article className="panel"><PanelHeader title="Delay root causes" subtitle="Share of delayed shipment records" /><div className="horizontal-bars delay-bars">{delayCauses.map((item) => <div key={item.n}><span>{item.n}</span><i><i style={{ width: `${item.v}%` }} /></i><b>{item.v}%</b></div>)}</div><div className="tradeoff-note"><b>Network action</b><p>{delayCauses[0]?.n || "No delay cause"} is the largest recorded contributor in the active filter context.</p></div></article>
    </>;
  }

  const activeDrawer = metricDetail || exceptionDetail || drillDetail;

  return <div className={dark ? "app dark" : "app"}>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>{data.config.company}</span></div>
      <nav><p className="nav-label">Decision cockpit</p>{(Object.keys(viewMeta) as ViewKey[]).map((key) => <button key={key} className={view === key ? "nav-item active" : "nav-item"} onClick={() => changeView(key)} aria-current={view === key ? "page" : undefined}><span className={`nav-glyph glyph-${key}`} aria-hidden="true" />{viewMeta[key].label}{key === "control" && <span className="live-dot" aria-label="Live data" />}</button>)}<p className="nav-label nav-label-spaced">Governance</p><button className="nav-item" onClick={() => showToast("Executive report workspace opened")}><span className="nav-glyph glyph-reports" aria-hidden="true" />Executive report</button><button className="nav-item" onClick={() => showToast("Metric catalog is available from every KPI info button")}><span className="nav-glyph glyph-settings" aria-hidden="true" />Metric catalog</button></nav>
      <div className="sidebar-footer"><div className="data-health"><span className="status-pulse" /><span><b>5 CSV sources healthy</b><small>{model.recordCount} filtered records</small></span></div><div className="profile"><span>BI</span><span><b>Reusable template</b><small>Replace data, keep design</small></span></div></div>
    </aside>

    <main id="main" className="main">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>{data.config.company}</div><div className="breadcrumbs"><span>Analytics</span><i>/</i><b>{meta.label}</b><span className="freshness"><i />CSV data connected</span></div><div className="top-actions"><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? "Light mode" : "Dark mode"}</button><button className="primary-button" onClick={exportCurrentView}><span aria-hidden="true">↓</span>Export current view</button></div></header>
      <div className="content">
        <section className="page-heading"><div><p className="eyebrow"><span />{meta.eyebrow}</p><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="filters" aria-label="Dashboard filters"><label>Region<select value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((v) => <option key={v}>{v}</option>)}</select></label><label>Product family<select value={product} onChange={(e) => setProduct(e.target.value)}>{products.map((v) => <option key={v}>{v}</option>)}</select></label><label>Period<select value={period} onChange={(e) => setPeriod(e.target.value)}>{["Last 6 months", "Last 12 months", "Year to date"].map((v) => <option key={v}>{v}</option>)}</select></label></div></section>

        <section className="management-brief" aria-label="Management brief"><span className="brief-label">Live data brief</span><div><b>{view === "control" ? "Service, cost and cash are recalculated from your five source files." : view === "inventory" ? "Inventory policy exceptions are generated from stock and demand fields." : view === "suppliers" ? "Supplier intervention priorities follow OTIF, quality and risk data." : "Lane reliability and mode cost follow shipment records."}</b><p>{model.recordCount} records match the active filters. {openCount} priority exceptions remain open.</p></div><button onClick={() => showToast("Current data context added to the executive report")}>Add to report</button></section>

        <section className="metric-grid" aria-label="Key performance indicators">{currentMetrics.map((metric) => {
          const onTarget = metric.lowerBetter ? metric.actual <= metric.target : metric.actual >= metric.target;
          const movementGood = metric.lowerBetter ? metric.actual < metric.previous : metric.actual > metric.previous;
          return <article className="metric-card" key={metric.id}><div className="metric-label"><span>{metric.label}</span><button onClick={() => setMetricDetail(metric)} aria-label={`View definition for ${metric.label}`}>i</button></div><div className="metric-value"><strong>{formatValue(metric.actual, metric.unit)}</strong><span className={onTarget ? "metric-state good" : "metric-state bad"}>{onTarget ? "On target" : "Gap"}</span></div><Delta metric={metric} /><div className="metric-comparison"><span>Previous <b className={movementGood ? "good" : "bad"}>{formatValue(metric.previous, metric.unit)}</b></span><span>Forecast <b>{formatValue(metric.forecast, metric.unit)}</b></span></div></article>;
        })}</section>

        <section className={`dashboard-grid view-${view}`}>{view === "control" ? renderControl() : view === "inventory" ? renderInventory() : view === "suppliers" ? renderSuppliers() : renderLogistics()}</section>
        <footer className="dashboard-footer"><span>{data.config.company} {data.config.dashboardName}</span><span>Reusable CSV template · Sample data included · Updated {new Date(data.config.updatedAt).toLocaleDateString("en-GB")}</span></footer>
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
