"use client";

import { useMemo } from "react";
import { Activity, AlertTriangle, ArrowUpRight, CalendarClock, CarFront, CheckCircle2, ClipboardCheck, FileWarning, Gauge, ShieldCheck, Wallet, Wrench } from "lucide-react";

type Row = { id?: string; [key: string]: any };
type Props = {
  ar: boolean; cars: Row[]; customers: Row[]; bookings: Row[]; contracts: Row[];
  cash: Row[]; maintenance: Row[]; insurance: Row[]; vehicleCosts: Row[];
  inspections: Row[]; incidents: Row[]; fines: Row[]; debts: Row[]; alerts: Row[];
  branches: Row[]; activeBranchId: string; onOpen: (section: string) => void;
};

const dateKey = (value: unknown) => String(value || "").slice(0, 10);
const dayDiff = (date: string, today: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const a = Date.parse(date + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 86400000) : null;
};
const norm = (value: unknown) => String(value || "").trim().toLowerCase();
const receiptKind = (value: unknown) => ["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"].includes(norm(value));
const expenseKind = (value: unknown) => ["صرف", "صرف نقدي", "دفع", "مصروف", "مصروفات", "payment", "expense", "paid"].includes(norm(value));
const completed = (value: unknown) => ["completed", "مكتمل", "منتهي", "cancelled", "canceled", "ملغي", "closed", "مغلق"].includes(norm(value));
const vehicleTokens = (value: unknown) => norm(value).split(/\s+-\s+|\s*[|,،]\s*/).filter(Boolean);

export default function GlobalCommand({
  ar, cars, customers, bookings, contracts, cash, maintenance, insurance, vehicleCosts,
  inspections, incidents, fines, debts, alerts, branches, activeBranchId, onOpen
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const activeContracts = contracts.filter(row => !completed(row.status));
  const overdueContracts = activeContracts.filter(row => dateKey(row.end_date) && dateKey(row.end_date) < today);
  const unavailableCars = cars.filter(row => ["maintenance", "صيانة", "inactive", "غير نشطة"].includes(norm(row.status)));
  const unclassifiedCash = cash.filter(row => !receiptKind(row.kind) && !expenseKind(row.kind));
  const cashClosingDifferences = cash.filter(row => false); // Cash closings are summarized in the dedicated closing workspace.
  const openIncidents = incidents.filter(row => !["closed", "resolved", "مغلق", "تمت المعالجة"].includes(norm(row.incident_status)));
  const unpaidFines = fines.filter(row => !["paid", "collected", "مدفوعة", "محصلة", "مغلق"].includes(norm(row.collection_status)));
  const missingPickup = activeContracts.filter(contract => {
    const no = norm(contract.contract_no);
    if (!no) return false;
    return !inspections.some(item => norm(item.contract_no) === no && norm(item.stage) === "pickup");
  });
  const overdueAlerts = alerts.filter(row => Number(row.days) < 0);
  const expiringAlerts = alerts.filter(row => row.days !== null && Number(row.days) >= 0 && Number(row.days) <= 7);
  const utilization = cars.length ? Math.round((cars.filter(row => ["rented", "مؤجرة"].includes(norm(row.status))).length / cars.length) * 100) : 0;
  const branch = branches.find(row => row.id === activeBranchId);

  const risks = useMemo(() => {
    const result: { id: string; title: string; detail: string; level: "high" | "medium"; target: string }[] = [];
    overdueContracts.forEach(row => result.push({
      id: "late-" + row.id, title: ar ? "عقد تجاوز موعد الإرجاع" : "Rental contract is overdue",
      detail: [row.contract_no, row.customer_name, row.car_label, dateKey(row.end_date)].filter(Boolean).join(" · "),
      level: "high", target: "contracts"
    }));
    unclassifiedCash.forEach(row => result.push({
      id: "cash-" + row.id, title: ar ? "حركة صندوق غير مصنفة" : "Unclassified cash transaction",
      detail: [dateKey(row.transaction_date || row.created_at), row.amount, row.currency || "ILS", row.description].filter(Boolean).join(" · "),
      level: "high", target: "cash"
    }));
    openIncidents.forEach(row => result.push({
      id: "incident-" + row.id, title: ar ? "حادث يحتاج متابعة" : "Incident needs follow-up",
      detail: [row.car_label, row.customer_name, row.claim_status].filter(Boolean).join(" · "),
      level: "high", target: "incidents"
    }));
    missingPickup.forEach(row => result.push({
      id: "pickup-" + row.id, title: ar ? "عقد نشط بلا فحص تسليم مسجل" : "Active contract has no pickup inspection",
      detail: [row.contract_no, row.car_label, row.customer_name].filter(Boolean).join(" · "),
      level: "high", target: "inspections"
    }));
    unpaidFines.forEach(row => result.push({
      id: "fine-" + row.id, title: ar ? "مخالفة غير محصلة" : "Uncollected traffic fine",
      detail: [row.car_label, row.fine_type, row.amount, row.currency || "ILS"].filter(Boolean).join(" · "),
      level: "medium", target: "fines"
    }));
    expiringAlerts.forEach(row => result.push({
      id: "due-" + row.id, title: row.title || (ar ? "استحقاق قريب" : "Upcoming due date"),
      detail: [row.date, row.days === 0 ? (ar ? "اليوم" : "Today") : String(row.days) + (ar ? " يوم" : " days")].join(" · "),
      level: "medium", target: row.target || "alerts"
    }));
    return result.slice(0, 30);
  }, [overdueContracts, unclassifiedCash, openIncidents, missingPickup, unpaidFines, expiringAlerts, ar]);

  const metrics = [
    { label: ar ? "عقود متأخرة" : "Overdue contracts", value: overdueContracts.length, icon: <CalendarClock/>, tone: "red", target: "contracts" },
    { label: ar ? "حركات غير مصنفة" : "Unclassified cash", value: unclassifiedCash.length, icon: <Wallet/>, tone: "orange", target: "cash" },
    { label: ar ? "حوادث مفتوحة" : "Open incidents", value: openIncidents.length, icon: <AlertTriangle/>, tone: "red", target: "incidents" },
    { label: ar ? "فحوص تسليم ناقصة" : "Missing pickup checks", value: missingPickup.length, icon: <ClipboardCheck/>, tone: "gold", target: "inspections" },
    { label: ar ? "مخالفات غير محصلة" : "Unpaid fines", value: unpaidFines.length, icon: <FileWarning/>, tone: "orange", target: "fines" },
    { label: ar ? "تنبيهات متأخرة" : "Overdue alerts", value: overdueAlerts.length, icon: <Activity/>, tone: "red", target: "alerts" }
  ];

  const workflows = [
    { title: ar ? "قبل اعتماد عقد جديد" : "Before approving a rental", text: ar ? "تحقق من أهلية العميل، وتوفر السيارة، وعدم تداخل المواعيد، وربط العقد بالعميل والسيارة." : "Verify customer eligibility, vehicle availability, date conflicts, and customer/vehicle links.", target: "contracts", icon: <ShieldCheck/> },
    { title: ar ? "عند تسليم السيارة" : "At vehicle pickup", text: ar ? "سجّل قراءة العداد والوقود والصور وإقرار العميل قبل مغادرة السيارة." : "Record odometer, fuel, photos and customer acknowledgement before departure.", target: "inspections", icon: <CarFront/> },
    { title: ar ? "عند إرجاع السيارة" : "At vehicle return", text: ar ? "قارن الفحصين، راجع الوقود والكيلومترات والأضرار، ثم سوِّ المستحقات." : "Compare both inspections, review fuel, mileage and damage, then settle outstanding amounts.", target: "inspections", icon: <ClipboardCheck/> },
    { title: ar ? "في نهاية اليوم" : "At end of day", text: ar ? "صنّف كل حركة، طابق الصندوق لكل عملة، وسجّل أي فرق قبل الإغلاق." : "Classify every transaction, reconcile cash by currency and record any variance before closing.", target: "cash_closings", icon: <Wallet/> }
  ];

  const modules = [
    { name: ar ? "الأسطول" : "Fleet", count: cars.length, target: "cars", icon: <CarFront/> },
    { name: ar ? "العملاء" : "Customers", count: customers.length, target: "customers", icon: <Gauge/> },
    { name: ar ? "العقود النشطة" : "Active contracts", count: activeContracts.length, target: "contracts", icon: <FileWarning/> },
    { name: ar ? "سجلات الصيانة" : "Maintenance records", count: maintenance.length, target: "maintenance", icon: <Wrench/> },
    { name: ar ? "حسابات عليها مستحقات" : "Receivable accounts", count: debts.length, target: "debts", icon: <Wallet/> },
    { name: ar ? "الفروع" : "Branches", count: branches.length, target: "branches", icon: <Activity/> }
  ];

  return <section className="global-command" dir={ar ? "rtl" : "ltr"}>
    <div className="gc-hero">
      <div><span>ARKAN GLOBAL · COMMAND</span><h2>{ar ? "مركز القيادة الذكي" : "Global Operations Command"}</h2>
        <p>{ar ? "لوحة تشغيلية تجمع إشارات المخاطر والمهام اليومية من السجلات الحالية." : "An operational cockpit combining risk signals and daily tasks from current records."}</p>
      </div>
      <div className="gc-context"><b>{branch?.name || (ar ? "كل الفروع المتاحة" : "All available branches")}</b><small>{today}</small></div>
    </div>

    <div className="gc-metrics">{metrics.map(item => <button type="button" className="gc-metric" key={item.label} onClick={() => onOpen(item.target)}>
      <span className={"gc-icon " + item.tone}>{item.icon}</span><span><small>{item.label}</small><strong>{item.value}</strong></span><ArrowUpRight size={15}/>
    </button>)}</div>

    <div className="gc-grid">
      <div className="gc-panel">
        <div className="gc-head"><div><h3>{ar ? "مركز المخاطر والتنبيهات" : "Risk & alert center"}</h3><p>{ar ? "قائمة مراجعة مرتبة حسب الأولوية" : "Review queue ordered by priority"}</p></div><ShieldCheck/></div>
        {risks.length ? <div className="gc-risks">{risks.map(item => <button type="button" key={item.id} onClick={() => onOpen(item.target)}>
          <span className={"gc-risk-dot " + item.level}/><span className="gc-risk-copy"><b>{item.title}</b><small>{item.detail || (ar ? "افتح السجل لمراجعة التفاصيل" : "Open the record to review details")}</small></span><em>{item.level === "high" ? (ar ? "عاجل" : "High") : (ar ? "متابعة" : "Review")}</em>
        </button>)}</div> : <div className="gc-clear"><CheckCircle2/>{ar ? "لا توجد مخاطر ظاهرة وفق السجلات المحملة حالياً." : "No visible risks in the currently loaded records."}</div>}
        <p className="gc-note">{ar ? "هذه إشارات مراجعة وليست قرارات آلية. لا يتم تعديل عقد أو حذف حركة أو فرض غرامة تلقائياً." : "These are review signals, not automatic decisions. ARKAN never edits contracts, deletes transactions or applies penalties automatically."}</p>
      </div>

      <div className="gc-panel">
        <div className="gc-head"><div><h3>{ar ? "سير العمل المقترح" : "Operational playbooks"}</h3><p>{ar ? "خطوات موحدة لتقليل الأخطاء" : "Standard steps to reduce operating errors"}</p></div><Activity/></div>
        <div className="gc-workflows">{workflows.map(item => <button type="button" key={item.target + item.title} onClick={() => onOpen(item.target)}><span>{item.icon}</span><span><b>{item.title}</b><small>{item.text}</small></span><ArrowUpRight size={15}/></button>)}</div>
      </div>
    </div>

    <div className="gc-bottom">
      <div className="gc-panel"><div className="gc-head"><div><h3>{ar ? "حالة وحدات ARKAN" : "ARKAN module health"}</h3><p>{ar ? "أعداد السجلات المحملة في مساحة العمل" : "Loaded record counts in this workspace"}</p></div><Gauge/></div>
        <div className="gc-modules">{modules.map(item => <button type="button" key={item.target} onClick={() => onOpen(item.target)}><span>{item.icon}</span><b>{item.name}</b><strong>{item.count}</strong></button>)}</div>
        <div className="gc-foot">{ar ? "نسبة تشغيل الأسطول: " : "Fleet utilization: "}<b>{utilization}%</b> · {ar ? "السيارات غير المتاحة: " : "Unavailable vehicles: "}<b>{unavailableCars.length}</b> · {ar ? "العقود النشطة: " : "Active contracts: "}<b>{activeContracts.length}</b></div>
      </div>
      <div className="gc-panel gc-readiness"><div className="gc-head"><div><h3>{ar ? "جاهزية التكاملات" : "Integration readiness"}</h3><p>{ar ? "ما يحتاج مزوداً أو اعتماداً خارجياً" : "Items requiring an external provider or credentials"}</p></div><Wrench/></div>
        <ul>
          <li><b>GPS Live</b><span>{ar ? "يتطلب جهازاً ومزود API معتمداً" : "Requires a supported device and provider API"}</span></li>
          <li><b>WhatsApp API</b><span>{ar ? "يتطلب حساب WhatsApp Business ومفاتيح خادم" : "Requires WhatsApp Business and server credentials"}</span></li>
          <li><b>Digital payments</b><span>{ar ? "يتطلب بوابة دفع تدعم فلسطين" : "Requires a payment gateway supporting Palestine"}</span></li>
          <li><b>AI cloud</b><span>{ar ? "يتطلب مزوداً وموافقة على مشاركة البيانات" : "Requires a provider and data-sharing approval"}</span></li>
        </ul>
        <p className="gc-note">{ar ? "لم يتم اختلاق اتصالات حية أو إرسال بيانات إلى خدمات خارجية. تبقى التكاملات اليدوية الحالية كما هي." : "No live integrations are fabricated and no data is sent to external services. Existing manual workflows remain unchanged."}</p>
      </div>
    </div>
    <div className="gc-disclaimer"><AlertTriangle size={16}/><span>{ar ? "يعرض المركز البيانات المحملة فقط. لا يمكن اعتباره نظاماً سحابياً متزامناً بالكامل حتى يكتمل ربط جميع الأقسام واختبار الصلاحيات." : "This command center reflects only loaded records. It is not a fully synchronized cloud system until every module and access policy is completed and tested."}</span></div>
  </section>;
}
