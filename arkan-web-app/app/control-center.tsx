"use client";

import { AlertTriangle, CarFront, CheckCircle2, Clock3, FileWarning, Gauge, Wallet, Wrench } from "lucide-react";

type AnyRow = { id?: string; [key: string]: any };
type Props = {
  ar: boolean; cars: AnyRow[]; customers: AnyRow[]; bookings: AnyRow[]; contracts: AnyRow[];
  cash: AnyRow[]; maintenance: AnyRow[]; insurance: AnyRow[]; vehicleCosts: AnyRow[];
  alerts: AnyRow[]; debts: AnyRow[]; incidents: AnyRow[]; fines: AnyRow[]; branches: AnyRow[]; activeBranchId: string;
  onOpen: (section: string) => void;
};
const amount = (value: unknown) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
const dayKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
const cashKind = (kind: unknown) => {
  const value = String(kind || "").trim().toLowerCase();
  if (["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"].includes(value)) return "receipt";
  if (["صرف", "صرف نقدي", "دفع", "مصروف", "مصروفات", "payment", "expense", "paid"].includes(value)) return "expense";
  return "unknown";
};

export default function ControlCenter({ ar, cars, customers, bookings, contracts, cash, maintenance, insurance, vehicleCosts, alerts, debts, incidents, fines, branches, activeBranchId, onOpen }: Props) {
  const today = new Date();
  const todayText = dayKey(today);
  const monthText = todayText.slice(0, 7);
  const activeContracts = contracts.filter((r) => !["completed", "مكتمل", "منتهي", "cancelled", "canceled", "ملغي"].includes(String(r.status || "").toLowerCase()));
  const lateContracts = activeContracts.filter((r) => String(r.end_date || "").slice(0, 10) < todayText);
  const availableCars = cars.filter((r) => ["متاحة", "available"].includes(String(r.status || "").toLowerCase()));
  const rentedCars = cars.filter((r) => ["مؤجرة", "rented"].includes(String(r.status || "").toLowerCase()));
  const serviceCars = cars.filter((r) => ["صيانة", "maintenance"].includes(String(r.status || "").toLowerCase()));
  const utilization = cars.length ? Math.round((rentedCars.length / cars.length) * 100) : 0;
  const openIncidents = incidents.filter((r) => !["closed", "resolved", "مغلق", "تمت المعالجة"].includes(String(r.incident_status || "").toLowerCase()));
  const unpaidFines = fines.filter((r) => !["paid", "collected", "مدفوعة", "محصلة", "مغلق"].includes(String(r.collection_status || "").toLowerCase()));
  const monthCash = cash.filter((r) => String(r.transaction_date || r.created_at || "").slice(0, 7) === monthText);
  const cashByCurrency = monthCash.reduce<Record<string, { receipts: number; expenses: number }>>((acc, row) => {
    const kind = cashKind(row.kind);
    if (kind === "unknown") return acc;
    const currency = String(row.currency || "ILS").trim().toUpperCase() || "ILS";
    if (!acc[currency]) acc[currency] = { receipts: 0, expenses: 0 };
    acc[currency][kind === "receipt" ? "receipts" : "expenses"] += Number(row.amount || 0);
    return acc;
  }, {});
  const cashSummary = (key: "receipts" | "expenses" | "net") => Object.entries(cashByCurrency)
    .map(([currency, values]) => amount(key === "net" ? values.receipts - values.expenses : values[key]) + " " + currency)
    .join(" / ") || "0 ILS";
  const unknownCash = monthCash.filter((r) => cashKind(r.kind) === "unknown").length;
  const categorizedCosts = [
    ...maintenance.filter((r) => String(r.service_date || r.created_at || "").slice(0, 7) === monthText).map((r) => ({ amount: r.cost, currency: r.currency || "ILS" })),
    ...insurance.filter((r) => String(r.start_date || r.created_at || "").slice(0, 7) === monthText).map((r) => ({ amount: r.premium, currency: r.currency || "ILS" })),
    ...vehicleCosts.filter((r) => String(r.due_date || r.created_at || "").slice(0, 7) === monthText).map((r) => ({ amount: r.amount, currency: r.currency || "ILS" }))
  ];
  const costByCurrency = categorizedCosts.reduce<Record<string, number>>((acc, row) => {
    const currency = String(row.currency || "ILS").toUpperCase();
    acc[currency] = (acc[currency] || 0) + Number(row.amount || 0);
    return acc;
  }, {});
  const currentBranch = branches.find((b) => b.id === activeBranchId);
  const urgentAlerts = alerts.filter((r) => r.days === null || Number(r.days) <= 7);
  const stat = (label: string, value: string | number, hint: string, icon: React.ReactNode, tone: string, action: string) => (
    <button type="button" className="cc-stat" onClick={() => onOpen(action)}>
      <span className={"cc-stat-icon " + tone}>{icon}</span>
      <span className="cc-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span>
    </button>
  );
  return <section className="control-center" dir={ar ? "rtl" : "ltr"}>
    <div className="cc-welcome"><div><span className="eyebrow">ARKAN CONTROL CENTER</span><h2>{ar ? "مركز مراقبة أركان" : "ARKAN Control Center"}</h2><p>{ar ? "نظرة تشغيلية ومالية سريعة مبنية على السجلات المحفوظة في النظام." : "A live operational and financial overview based on records saved in the system."}</p></div>
      <div className="cc-date"><Gauge size={17}/><span>{currentBranch?.name || (ar ? "كل الفروع المتاحة" : "Available branches")}</span><b>{todayText}</b></div>
    </div>
    <div className="cc-section-head"><div><h3>{ar ? "ملخص الأسطول والعملاء" : "Fleet & customer overview"}</h3><p>{ar ? "حالة السيارات والعقود المسجلة حالياً" : "Current vehicle and contract records"}</p></div></div>
    <div className="cc-stats-grid">
      {stat(ar ? "إجمالي السيارات" : "Total vehicles", cars.length, ar ? "في الفرع المحدد" : "Selected branch", <CarFront/>, "blue", "cars")}
      {stat(ar ? "سيارات متاحة" : "Available", availableCars.length, ar ? "جاهزة للتأجير" : "Ready to rent", <CheckCircle2/>, "green", "cars")}
      {stat(ar ? "سيارات مؤجرة" : "Rented vehicles", rentedCars.length, ar ? "لدى العملاء" : "With customers", <CarFront/>, "purple", "contracts")}
      {stat(ar ? "في الصيانة" : "In maintenance", serviceCars.length, ar ? "تحتاج متابعة" : "Need attention", <Wrench/>, "orange", "maintenance")}
      {stat(ar ? "العقود المتأخرة" : "Overdue contracts", lateContracts.length, ar ? "تجاوزت تاريخ الإرجاع" : "Past return date", <Clock3/>, "red", "contracts")}
      {stat(ar ? "الديون المفتوحة" : "Open receivables", debts.length, ar ? "عقود لها رصيد متبقٍ" : "Contracts with a balance", <Wallet/>, "gold", "debts")}
      {stat(ar ? "العملاء" : "Customers", customers.length, ar ? "ملفات العملاء" : "Customer profiles", <CheckCircle2/>, "blue", "customers")}
      {stat(ar ? "الحجوزات" : "Bookings", bookings.length, ar ? "كل الحجوزات المسجلة" : "Recorded bookings", <FileWarning/>, "purple", "bookings")}
      {stat(ar ? "نسبة تشغيل الأسطول" : "Fleet utilization", utilization + "%", ar ? "حسب حالة السيارات المسجلة" : "Based on recorded vehicle status", <Gauge/>, "gold", "cars")}
      {stat(ar ? "الحوادث المفتوحة" : "Open incidents", openIncidents.length, ar ? "تحتاج معالجة أو إغلاق" : "Need resolution or closure", <AlertTriangle/>, "red", "incidents")}
      {stat(ar ? "المخالفات غير المحصلة" : "Unpaid fines", unpaidFines.length, ar ? "تحتاج مراجعة وتحصيل" : "Need review and collection", <FileWarning/>, "orange", "fines")}
    </div>
    <div className="cc-two-columns">
      <div className="cc-panel"><div className="cc-panel-head"><div><h3>{ar ? "حركة الصندوق هذا الشهر" : "Cash movement this month"}</h3><p>{monthText}</p></div><Wallet size={20}/></div>
        <div className="cc-finance-grid"><div><small>{ar ? "المقبوضات" : "Receipts"}</small><strong>{cashSummary("receipts")}</strong></div><div><small>{ar ? "المدفوعات" : "Payments"}</small><strong>{cashSummary("expenses")}</strong></div><div className="cc-net"><small>{ar ? "صافي حركة الصندوق" : "Net cash movement"}</small><strong>{cashSummary("net")}</div></div>
        <p className="cc-footnote">{ar ? "الأرقام حسب حركات الصندوق المسجلة فقط، ولا يتم جمع عملات مختلفة في إجمالي واحد." : "Based only on recorded cash transactions. Different currencies are not combined into one total."}</p>
        {unknownCash > 0 && <p className="cc-warning"><AlertTriangle size={15}/>{ar ? String(unknownCash) + " حركة هذا الشهر تحتاج تصنيف قبض أو صرف." : String(unknownCash) + " transactions this month need a receipt/expense classification."}</p>}
        <button type="button" className="cc-link" onClick={() => onOpen("cash")}>{ar ? "فتح الصندوق ←" : "Open cashbox →"}</button>
      </div>
      <div className="cc-panel"><div className="cc-panel-head"><div><h3>{ar ? "تكاليف السيارات المسجلة" : "Recorded vehicle costs"}</h3><p>{ar ? "تكاليف مفصلة لهذا الشهر، حسب العملة" : "Itemized costs this month, by currency"}</p></div><Wrench size={20}/></div>
        {Object.keys(costByCurrency).length ? <div className="cc-cost-list">{Object.entries(costByCurrency).map(([currency, value]) => <div key={currency}><span>{currency}</span><strong>{amount(value)}</strong></div>)}</div> : <div className="cc-empty">{ar ? "لا توجد تكاليف مفصلة مسجلة لهذا الشهر." : "No itemized costs recorded this month."}</div>}
        <p className="cc-footnote">{ar ? "تشمل الصيانة والتأمين والترخيص. تُعرض منفصلة عن الصندوق لتجنب احتساب المصروف مرتين." : "Includes maintenance, insurance and registration. Kept separate from cashbox totals to avoid double counting."}</p>
        <button type="button" className="cc-link" onClick={() => onOpen("reports")}>{ar ? "فتح التقارير المالية ←" : "Open financial reports →"}</button>
      </div>
    </div>
    <div className="cc-two-columns">
      <div className="cc-panel"><div className="cc-panel-head"><div><h3>{ar ? "التنبيهات التي تحتاج متابعة" : "Alerts requiring attention"}</h3><p>{ar ? "العاجل والمتأخر أولاً" : "Urgent and overdue items first"}</p></div><AlertTriangle size={20}/></div>
        {urgentAlerts.length ? <div className="cc-alert-list">{urgentAlerts.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => onOpen(item.target || "alerts")}><span className={Number(item.days) < 0 ? "cc-alert-dot danger" : "cc-alert-dot"}></span><span><b>{item.title}</b><small>{item.date}</small></span><em>{item.days === null ? (ar ? "متابعة" : "Follow-up") : Number(item.days) < 0 ? (ar ? "متأخر" : "Overdue") : (ar ? String(item.days) + " يوم" : String(item.days) + " days")}</em></button>)}</div> : <div className="cc-empty cc-success"><CheckCircle2 size={18}/>{ar ? "لا توجد تنبيهات عاجلة خلال الأيام السبعة القادمة." : "No urgent alerts in the next seven days."}</div>}
        <button type="button" className="cc-link" onClick={() => onOpen("alerts")}>{ar ? "عرض جميع التنبيهات ←" : "View all alerts →"}</button>
      </div>
      <div className="cc-panel"><div className="cc-panel-head"><div><h3>{ar ? "متابعة العقود والالتزامات" : "Contracts & obligations"}</h3><p>{ar ? "أهم مؤشرات المتابعة" : "Key follow-up indicators"}</p></div><FileWarning size={20}/></div>
        <div className="cc-follow-list"><button type="button" onClick={() => onOpen("contracts")}><span>{ar ? "عقود نشطة" : "Active contracts"}</span><b>{activeContracts.length}</b></button><button type="button" onClick={() => onOpen("contracts")}><span>{ar ? "عقود متأخرة" : "Overdue contracts"}</span><b className={lateContracts.length ? "cc-danger-text" : ""}>{lateContracts.length}</b></button><button type="button" onClick={() => onOpen("debts")}><span>{ar ? "حسابات عليها مستحقات" : "Accounts with balances"}</span><b>{debts.length}</b></button><button type="button" onClick={() => onOpen("maintenance")}><span>{ar ? "سجلات الصيانة" : "Maintenance records"}</span><b>{maintenance.length}</b></button></div>
        <p className="cc-footnote">{ar ? "راجع تاريخ الإرجاع والفحوصات قبل اعتبار العقد منتهياً." : "Review return dates and inspection records before treating a contract as completed."}</p>
      </div>
    </div>
    <div className="cc-bottom-note"><AlertTriangle size={16}/><span>{ar ? "ملاحظة محاسبية: صافي حركة الصندوق ليس هو صافي الربح المحاسبي. يلزم توحيد ربط الفواتير والمدفوعات قبل اعتماد تقرير أرباح نهائي." : "Accounting note: net cash movement is not accounting profit. Invoices and payments must be reconciled before relying on a final profit report."}</span></div>
  </section>;
}
