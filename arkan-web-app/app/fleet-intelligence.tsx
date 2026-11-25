"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CarFront, CircleDollarSign, Gauge, TrendingDown, TrendingUp, Wrench } from "lucide-react";

type Row = { id?: string; [key: string]: any };
type Props = { ar: boolean; cars: Row[]; contracts: Row[]; cash: Row[]; maintenance: Row[]; insurance: Row[]; vehicleCosts: Row[] };

const amount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const currency = (value: unknown) => {
  const raw = String(value || "ILS").trim().toUpperCase();
  if (["₪", "NIS", "ILS", "شيكل"].includes(raw)) return "ILS";
  if (["$", "US$", "USD", "دولار"].includes(raw)) return "USD";
  if (["JOD", "دينار"].includes(raw)) return "JOD";
  if (["€", "EUR"].includes(raw)) return "EUR";
  return raw || "ILS";
};
const dayNumber = (value: unknown) => {
  const s = String(value || "").slice(0, 10);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return null;
  const n = Date.parse(s + "T00:00:00Z");
  return Number.isFinite(n) ? Math.floor(n / 86400000) : null;
};
const dateText = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
const cancelled = (status: unknown) => ["cancelled", "canceled", "ملغي", "مرفوض"].includes(String(status || "").trim().toLowerCase());
const cashKind = (value: unknown) => {
  const v = String(value || "").trim().toLowerCase();
  if (["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"].includes(v)) return "income";
  if (["صرف", "صرف نقدي", "دفع", "مصروف", "مصروفات", "payment", "expense", "paid"].includes(v)) return "expense";
  return "unknown";
};
const matchesVehicle = (row: Row, car: Row) => {
  if (row.car_id && car.id && String(row.car_id) === String(car.id)) return true;
  const aliases = [car.plate, car.car_number].filter(Boolean).map(v => String(v).trim().toLowerCase());
  const label = String(row.car_label || row.car_plate || row.plate || row.car_number || "").trim().toLowerCase();
  return Boolean(label && aliases.some(alias => label === alias || label.split(/\\s+-\\s+|[|,،]/).map(x => x.trim()).includes(alias)));
};
const mergeDays = (intervals: Array<[number, number]>) => {
  const sorted = intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const interval of sorted) {
    if (!current) current = [...interval];
    else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
    else { total += current[1] - current[0]; current = [...interval]; }
  }
  if (current) total += current[1] - current[0];
  return total;
};
const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

export default function FleetIntelligence({ ar, cars, contracts, cash, maintenance, insurance, vehicleCosts }: Props) {
  const [windowDays, setWindowDays] = useState(90);
  const today = Math.floor(Date.now() / 86400000);
  const startDay = today - windowDays + 1;
  const endDay = today + 1;
  const t = (arabic: string, english: string) => ar ? arabic : english;

  const fleet = useMemo(() => cars.map(car => {
    const vehicleContracts = contracts.filter(row => matchesVehicle(row, car));
    const contractNumbers = new Set(vehicleContracts.map(row => String(row.contract_no || "").trim()).filter(Boolean));
    const rentalIntervals: Array<[number, number]> = [];
    vehicleContracts.filter(row => !cancelled(row.status)).forEach(row => {
      const start = dayNumber(row.start_date);
      const end = dayNumber(row.end_date);
      if (start === null || end === null || end <= start) return;
      const clippedStart = Math.max(start, startDay);
      const clippedEnd = Math.min(end, endDay);
      if (clippedEnd > clippedStart) rentalIntervals.push([clippedStart, clippedEnd]);
    });
    const rentalDays = Math.min(windowDays, mergeDays(rentalIntervals));
    const utilization = Math.round((rentalDays / windowDays) * 100);
    const totals: Record<string, { income: number; costs: number }> = {};
    const ensure = (cur: string) => totals[cur] || (totals[cur] = { income: 0, costs: 0 });
    cash.filter(row => contractNumbers.has(String(row.contract_no || "").trim()) && cashKind(row.kind) === "income").forEach(row => {
      const d = dayNumber(row.transaction_date || row.created_at);
      if (d === null || d < startDay || d >= endDay) return;
      ensure(currency(row.currency)).income += amount(row.amount);
    });
    const costRows = [
      ...maintenance.filter(row => matchesVehicle(row, car)).map(row => ({ row, date: row.service_date || row.created_at, value: row.cost })),
      ...insurance.filter(row => matchesVehicle(row, car)).map(row => ({ row, date: row.start_date || row.created_at, value: row.premium })),
      ...vehicleCosts.filter(row => matchesVehicle(row, car)).map(row => ({ row, date: row.due_date || row.created_at, value: row.amount }))
    ];
    costRows.forEach(item => {
      const d = dayNumber(item.date);
      if (d === null || d < startDay || d >= endDay) return;
      ensure(currency(item.row.currency)).costs += amount(item.value);
    });
    const finance = Object.entries(totals).map(([cur, value]) => ({ currency: cur, income: value.income, costs: value.costs, net: value.income - value.costs }));
    return {
      id: String(car.id || car.plate || car.car_number || Math.random()),
      name: [car.make, car.model].filter(Boolean).join(" ") || car.car_number || car.plate || t("سيارة", "Vehicle"),
      plate: car.plate || car.car_number || "—",
      status: String(car.status || "").toLowerCase(),
      rentalDays,
      utilization,
      contracts: vehicleContracts.filter(row => !cancelled(row.status)).length,
      finance
    };
  }), [cars, contracts, cash, maintenance, insurance, vehicleCosts, startDay, endDay, windowDays, ar]);

  const avgUtilization = fleet.length ? Math.round(fleet.reduce((sum, car) => sum + car.utilization, 0) / fleet.length) : 0;
  const currentlyRented = fleet.filter(car => ["rented", "مؤجرة"].includes(car.status)).length;
  const noRentals = fleet.filter(car => car.rentalDays === 0).length;
  const financialRows = fleet.flatMap(car => car.finance.map(value => ({ ...value, id: car.id, name: car.name, plate: car.plate, utilization: car.utilization, rentalDays: car.rentalDays })));
  const currencies = Array.from(new Set(financialRows.map(row => row.currency))).sort();
  const negativeCount = financialRows.filter(row => row.net < -0.009).length;
  const ranked = [...financialRows].sort((a, b) => b.net - a.net);

  return <section className="fleet-intelligence" dir={ar ? "rtl" : "ltr"}>
    <div className="page-heading">
      <div><span className="eyebrow">ARKAN · FLEET INTELLIGENCE</span><h2>{t("ذكاء الأسطول وأداء السيارات", "Fleet Intelligence")}</h2><p>{t("قياس تشغيل السيارات والإيرادات والتكاليف المسجلة دون خلط العملات أو اختراع بيانات.", "Measure vehicle utilization, collected revenue and recorded costs without mixing currencies or inventing data.")}</p></div>
      <select className="profit-period" value={windowDays} onChange={event => setWindowDays(Number(event.target.value))} aria-label={t("الفترة الزمنية", "Analysis period")}>
        <option value={30}>{t("آخر 30 يوماً", "Last 30 days")}</option>
        <option value={90}>{t("آخر 90 يوماً", "Last 90 days")}</option>
        <option value={365}>{t("آخر 12 شهراً", "Last 12 months")}</option>
      </select>
    </div>
    <div className="stats-grid fleet-intelligence-stats">
      <div className="stat-card"><div className="stat-icon blue"><CarFront/></div><div><span>{t("إجمالي الأسطول", "Fleet size")}</span><strong>{cars.length}</strong><small>{t("سيارة مسجلة", "Registered vehicles")}</small></div></div>
      <div className="stat-card"><div className="stat-icon purple"><Gauge/></div><div><span>{t("متوسط التشغيل", "Average utilization")}</span><strong>{avgUtilization}%</strong><small>{t("من أيام الفترة المحددة", "Of selected period days")}</small></div></div>
      <div className="stat-card"><div className="stat-icon green"><Activity/></div><div><span>{t("سيارات مؤجرة حالياً", "Currently rented")}</span><strong>{currentlyRented}</strong><small>{t("حسب حالة السيارة المسجلة", "Based on recorded vehicle status")}</small></div></div>
      <div className="stat-card"><div className="stat-icon orange"><AlertTriangle/></div><div><span>{t("بلا أيام تأجير", "No rental days")}</span><strong>{noRentals}</strong><small>{t("خلال الفترة المحددة", "During selected period")}</small></div></div>
    </div>

    <div className="panel cash-statement">
      <div className="panel-head"><div><h3>{t("الأداء المالي حسب العملة", "Financial performance by currency")}</h3><p>{t("الإيراد هو المقبوض المرتبط بعقود السيارة؛ والتكاليف تشمل الصيانة والتأمين والترخيص المسجلة فقط.", "Revenue means receipts linked to vehicle contracts; costs include recorded maintenance, insurance and registration only.")}</p></div><CircleDollarSign/></div>
      {currencies.length ? <div className="table-wrap"><table><thead><tr><th>{t("السيارة", "Vehicle")}</th><th>{t("اللوحة", "Plate")}</th><th>{t("العملة", "Currency")}</th><th>{t("المقبوض", "Collected")}</th><th>{t("التكاليف", "Costs")}</th><th>{t("الصافي التشغيلي", "Operating net")}</th><th>{t("التشغيل", "Utilization")}</th></tr></thead><tbody>
        {ranked.map((row, index) => <tr key={row.id + row.currency + index}><td><b>{row.name}</b></td><td>{row.plate}</td><td>{row.currency}</td><td>{money(row.income)}</td><td>{money(row.costs)}</td><td><strong className={row.net < 0 ? "profit-negative" : "profit-positive"}>{money(row.net)}</strong></td><td>{row.utilization}%</td></tr>)}
      </tbody></table></div> : <p className="statement-empty">{t("لا توجد حركات مالية مرتبطة بالسيارات ضمن الفترة. أضف قبضاً مرتبطاً برقم عقد وسجّل تكاليف السيارة لعرض المقارنة.", "No vehicle-linked financial activity was found in this period. Record receipts linked to contract numbers and vehicle costs to compare performance.")}</p>}
    </div>

    <div className="panel cash-statement">
      <div className="panel-head"><div><h3>{t("كفاءة تشغيل كل سيارة", "Vehicle utilization ranking")}</h3><p>{t("أيام التأجير محسوبة من تداخل تواريخ العقود مع الفترة المختارة، مع دمج الفترات المتداخلة لتجنب العد المكرر.", "Rental days are calculated from contract-date overlap with the selected period; overlapping contracts are merged to prevent double counting.")}</p></div><TrendingUp/></div>
      {fleet.length ? <div className="fleet-utilization-list">{[...fleet].sort((a,b)=>b.utilization-a.utilization).map(car => <div className="fleet-utilization-row" key={car.id}><div className="fleet-utilization-name"><b>{car.name}</b><small>{car.plate} · {car.contracts} {t("عقد", "contracts")}</small></div><div className="fleet-utilization-track"><i style={{width: car.utilization + "%"}}/></div><strong>{car.utilization}%</strong><small>{car.rentalDays}/{windowDays} {t("يوم", "days")}</small></div>)}</div> : <p className="statement-empty">{t("أضف السيارات والعقود لاحتساب كفاءة الأسطول.", "Add vehicles and contracts to calculate fleet utilization.")}</p>}
    </div>

    <div className="fleet-intelligence-footnote"><Wrench size={16}/><span>{t("ملاحظة: المؤشرات تشغيلية وليست ربحاً محاسبياً نهائياً. لا تشمل الاستهلاك والرواتب والمصاريف العامة والضرائب، ولا تُعد تكاليف الحوادث التقديرية مصروفات مدفوعة.", "Note: These are operational indicators, not final accounting profit. Depreciation, payroll, overhead and taxes are excluded; estimated incident costs are not treated as paid expenses.")}</span>{negativeCount > 0 && <b><TrendingDown size={15}/>{negativeCount} {t("نتيجة صافية سالبة", "negative net result(s)")}</b>}</div>
    <p className="fleet-period-note">{t("الفترة المحللة:", "Analysis window:")} {dateText(startDay)} — {dateText(today)} · {t("تُعرض العملات كلٌ على حدة.", "Currencies are displayed separately.")}</p>
  </section>;
}
