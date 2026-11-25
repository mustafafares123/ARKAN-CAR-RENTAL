"use client";

import { useMemo, useState } from "react";
import { BarChart3, CarFront, CircleDollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type RecordRow = { [key: string]: any };
type Props = {
  ar: boolean;
  cars: RecordRow[];
  contracts: RecordRow[];
  cash: RecordRow[];
  maintenance: RecordRow[];
  insurance: RecordRow[];
  vehicleCosts: RecordRow[];
};

const amount = (value: any) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const currency = (value: any) => {
  const raw = String(value || "ILS").trim().toUpperCase();
  if (["شيكل", "شيكل اسرائيلي", "شيكل إسرائيلي", "₪", "NIS", "ILS"].includes(raw)) return "ILS";
  if (["دولار", "دولار امريكي", "دولار أمريكي", "$", "US$", "USD"].includes(raw)) return "USD";
  if (["دينار", "دينار اردني", "دينار أردني", "JOD"].includes(raw)) return "JOD";
  if (["يورو", "€", "EUR"].includes(raw)) return "EUR";
  return raw || "ILS";
};
const dateMonth = (row: RecordRow, fields: string[]) => {
  for (const field of fields) {
    const value = String(row[field] || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(value)) return value;
  }
  return "";
};
const tokens = (value: any) => String(value || "").toLowerCase().split(/\s+-\s+|\s*[|,،]\s*/).map(x => x.trim()).filter(Boolean);

export default function CarProfitability({ ar, cars, contracts, cash, maintenance, insurance, vehicleCosts }: Props) {
  const [period, setPeriod] = useState("all");
  const months = useMemo(() => Array.from(new Set([
    ...cash.map(r => dateMonth(r, ["transaction_date", "created_at"])),
    ...maintenance.map(r => dateMonth(r, ["service_date", "created_at"])),
    ...insurance.map(r => dateMonth(r, ["start_date", "created_at"])),
    ...vehicleCosts.map(r => dateMonth(r, ["due_date", "created_at"]))
  ].filter(Boolean))).sort().reverse(), [cash, maintenance, insurance, vehicleCosts]);

  const report = useMemo(() => cars.map(car => {
    const identifiers = [car.plate, car.car_number, car.id].filter(Boolean).map(v => String(v).trim().toLowerCase());
    const matches = (row: RecordRow) => {
      if (row.car_id && String(row.car_id) === String(car.id)) return true;
      const rowTokens = tokens(row.car_label || row.car_plate || row.plate || row.car_number);
      return rowTokens.some(t => identifiers.includes(t));
    };
    const carContracts = contracts.filter(r => matches(r));
    const contractNumbers = new Set(carContracts.map(r => String(r.contract_no || "").trim()).filter(Boolean));
    const collected: Record<string, number> = {};
    const costs: Record<string, { maintenance: number; insurance: number; registration: number }> = {};
    const add = (target: Record<string, number>, cur: string, value: any) => { target[cur] = (target[cur] || 0) + amount(value); };
    cash.filter(r => {
      const kind = String(r.kind || "").trim().toLowerCase();
      const isReceipt = ["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"].includes(kind);
      return isReceipt && contractNumbers.has(String(r.contract_no || "").trim()) &&
        (period === "all" || dateMonth(r, ["transaction_date", "created_at"]) === period);
    }).forEach(r => add(collected, currency(r.currency), r.amount));
    const addCost = (kind: "maintenance" | "insurance" | "registration", row: RecordRow, dateFields: string[], value: any) => {
      if (!matches(row) || (period !== "all" && dateMonth(row, dateFields) !== period)) return;
      const cur = currency(row.currency);
      if (!costs[cur]) costs[cur] = { maintenance: 0, insurance: 0, registration: 0 };
      costs[cur][kind] += amount(value);
    };
    maintenance.forEach(r => addCost("maintenance", r, ["service_date", "created_at"], r.cost));
    insurance.forEach(r => addCost("insurance", r, ["start_date", "created_at"], r.premium));
    vehicleCosts.forEach(r => addCost("registration", r, ["due_date", "created_at"], r.amount));
    const currencies = Array.from(new Set([...Object.keys(collected), ...Object.keys(costs)]));
    return {
      id: car.id,
      name: [car.make, car.model].filter(Boolean).join(" ") || car.car_number || car.plate || (ar ? "سيارة" : "Vehicle"),
      plate: car.plate || car.car_number || "—",
      values: currencies.map(cur => {
        const cost = costs[cur] || { maintenance: 0, insurance: 0, registration: 0 };
        const totalCosts = cost.maintenance + cost.insurance + cost.registration;
        const income = collected[cur] || 0;
        return { currency: cur, revenue: income, collected: income, maintenance: cost.maintenance, insurance: cost.insurance, registration: cost.registration, costs: totalCosts, net: income - totalCosts };
      })
    };
  }), [cars, contracts, cash, maintenance, insurance, vehicleCosts, period, ar]);

  const totals = useMemo(() => {
    const result: Record<string, { revenue: number; collected: number; costs: number; net: number }> = {};
    report.forEach(car => car.values.forEach(v => {
      if (!result[v.currency]) result[v.currency] = { revenue: 0, collected: 0, costs: 0, net: 0 };
      result[v.currency].revenue += v.revenue;
      result[v.currency].collected += v.collected;
      result[v.currency].costs += v.costs;
      result[v.currency].net += v.net;
    }));
    return result;
  }, [report]);

  const formatTotals = (key: "revenue" | "collected" | "costs" | "net") => Object.entries(totals).map(([cur, values]) => money(values[key]) + " " + cur).join(" / ") || "0 ILS";
  const title = (arText: string, enText: string) => ar ? arText : enText;

  return <section className="profitability-workspace">
    <div className="page-heading">
      <div><span className="eyebrow">{title("تحليل أداء الأسطول", "FLEET PERFORMANCE")}</span><h2>{title("ربحية كل سيارة", "Profitability by vehicle")}</h2><p>{title("المقبوضات المرتبطة بعقود السيارات مطروحاً منها التكاليف المسجلة، دون احتساب قيمة العقد غير المحصلة.", "Recorded receipts linked to vehicle contracts less itemized vehicle costs; unpaid contract value is not counted as income.")}</p></div>
      <select className="profit-period" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">{title("كل الفترات", "All periods")}</option>{months.map(m => <option key={m} value={m}>{m}</option>)}</select>
    </div>
    <div className="stats-grid profit-stats">
      <div className="stat-card"><div className="stat-icon green"><TrendingUp/></div><div><span>{title("المقبوضات المرتبطة بالعقود", "Contract-linked receipts")}</span><strong>{formatTotals("revenue")}</strong></div></div>
      <div className="stat-card"><div className="stat-icon blue"><Wallet/></div><div><span>{title("المقبوض فعلياً", "Cash collected")}</span><strong>{formatTotals("collected")}</strong></div></div>
      <div className="stat-card"><div className="stat-icon orange"><TrendingDown/></div><div><span>{title("تكاليف السيارات", "Vehicle costs")}</span><strong>{formatTotals("costs")}</strong></div></div>
      <div className="stat-card"><div className="stat-icon purple"><CircleDollarSign/></div><div><span>{title("الصافي بعد تكاليف السيارة المسجلة", "Net after recorded vehicle costs")}</span><strong>{formatTotals("net")}</strong></div></div>
    </div>
    <div className="panel cash-statement">
      <div className="panel-head"><div><h3>{title("تفصيل ربحية السيارات", "Vehicle profitability breakdown")}</h3><p>{title("كل عملة محسوبة بشكل مستقل دون تحويل بين العملات.", "Each currency is calculated separately; no currency conversion is assumed.")}</p></div><BarChart3/></div>
      <div className="table-wrap"><table><thead><tr><th>{title("السيارة","Vehicle")}</th><th>{title("اللوحة","Plate")}</th><th>{title("العملة","Currency")}</th><th>{title("إيرادات العقود","Revenue")}</th><th>{title("المقبوض","Collected")}</th><th>{title("الصيانة","Maintenance")}</th><th>{title("التأمين","Insurance")}</th><th>{title("الترخيص","Registration")}</th><th>{title("إجمالي التكلفة","Total costs")}</th><th>{title("صافي الربح","Net profit")}</th></tr></thead><tbody>{report.flatMap(car => car.values.map(v => <tr key={car.id + "-" + v.currency}><td><CarFront size={15} style={{ verticalAlign: "middle", marginInlineEnd: 6 }}/>{car.name}</td><td>{car.plate}</td><td>{v.currency}</td><td>{money(v.revenue)}</td><td>{money(v.collected)}</td><td>{money(v.maintenance)}</td><td>{money(v.insurance)}</td><td>{money(v.registration)}</td><td>{money(v.costs)}</td><td><strong className={v.net < 0 ? "profit-negative" : "profit-positive"}>{money(v.net)}</strong></td></tr>))}</tbody></table></div>
      {!report.some(car => car.values.length) && <p className="statement-empty">{title("لا توجد مقبوضات أو تكاليف مرتبطة بالسيارات في الفترة المختارة. اربط حركة القبض برقم العقد واربط المصاريف بالسيارة.", "No receipts or costs are linked to vehicles for this period. Link receipts to contract numbers and costs to vehicles.")}</p>}
    </div>
    <div className="profit-note"><b>{title("ملاحظات احتساب مهمة", "Accounting notes")}</b><ul><li>{title("تُحتسب الإيرادات من حركات القبض المرتبطة برقم العقد فقط؛ قيمة العقد غير المحصلة لا تدخل في الدخل.", "Income uses receipt transactions linked to a contract number; unpaid contract value is excluded.")}</li><li>{title("التكاليف تشمل الصيانة والتأمين والترخيص المسجلة على السيارة. لا تشمل المصاريف العامة أو الرواتب أو الضرائب.", "Costs include recorded maintenance, insurance and registration. General overhead, payroll and taxes are excluded.")}</li><li>{title("لا يتم جمع العملات المختلفة معاً أو تحويلها بسعر صرف افتراضي.", "Different currencies are not combined or converted using an assumed exchange rate.")}</li></ul></div>
  </section>;
}
