"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BadgeCheck, Banknote, BellRing, CarFront, CheckCircle2, Clock3, ShieldCheck, Sparkles, Wrench, XCircle } from "lucide-react";

type Row = { id?: string; [key: string]: any };
type Props = {
  ar: boolean;
  role: string;
  cars: Row[];
  contracts: Row[];
  cash: Row[];
  debts: Row[];
  alerts: Row[];
  approvals: Row[];
  findings: Row[];
  onOpen: (section: string) => void;
  onCreateApproval: (request: { request_type: string; reason: string; amount?: number; currency: string }) => Promise<void>;
  onReviewApproval: (id: string, status: "approved" | "rejected") => Promise<void>;
};

const money = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const currencyOf = (row: Row) => {
  const raw = String(row.currency || "ILS").trim().toUpperCase();
  if (["₪", "NIS", "شيكل", "ILS"].includes(raw)) return "ILS";
  if (["$", "US$", "دولار", "USD"].includes(raw)) return "USD";
  if (["دينار", "JOD"].includes(raw)) return "JOD";
  if (["€", "EUR"].includes(raw)) return "EUR";
  return raw || "ILS";
};
const cashKind = (value: unknown) => {
  const kind = String(value || "").trim().toLowerCase();
  if (["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"].includes(kind)) return "income";
  if (["صرف", "صرف نقدي", "دفع", "مصروف", "مصروفات", "payment", "expense", "paid"].includes(kind)) return "expense";
  return "unknown";
};

export default function OwnerCommand({ ar, role, cars, contracts, cash, debts, alerts, approvals, findings, onOpen, onCreateApproval, onReviewApproval }: Props) {
  const [requestType, setRequestType] = useState("large_expense");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [saving, setSaving] = useState(false);
  const isOwner = ["owner", "admin"].includes(role);
  const today = new Date().toISOString().slice(0, 10);
  const activeContracts = contracts.filter(r => !["completed", "مكتمل", "منتهي", "cancelled", "canceled", "ملغي"].includes(String(r.status || "").toLowerCase()));
  const overdueContracts = activeContracts.filter(r => String(r.end_date || "").slice(0, 10) < today);
  const maintenanceAlerts = alerts.filter(r => ["maintenance", "صيانة"].includes(String(r.kind || "").toLowerCase()) || /maintenance|صيانة/i.test(String(r.title || "")));
  const pendingApprovals = approvals.filter(r => r.status === "pending");
  const openFindings = findings.filter(r => ["open", "acknowledged"].includes(r.status));
  const utilization = cars.length ? Math.round(cars.filter(r => ["rented", "مؤجرة"].includes(String(r.status || "").toLowerCase())).length / cars.length * 100) : 0;
  const financial = useMemo(() => {
    const result: Record<string, { income: number; expenses: number }> = {};
    cash.forEach(row => {
      const kind = cashKind(row.kind);
      if (kind === "unknown") return;
      const cur = currencyOf(row);
      if (!result[cur]) result[cur] = { income: 0, expenses: 0 };
      const date = String(row.transaction_date || row.created_at || "").slice(0, 7);
      if (date !== today.slice(0, 7)) return;
      result[cur][kind] += Number(row.amount || 0);
    });
    return result;
  }, [cash, today]);
  const suggestions = [
    ...(overdueContracts.length ? [{ key: "contracts", title: ar ? "عقود تجاوزت موعد الإرجاع" : "Contracts past their return date", detail: ar ? overdueContracts.length + " عقداً نشطاً يحتاج متابعة فورية." : overdueContracts.length + " active contract(s) need immediate follow-up.", target: "contracts", severity: "high" }] : []),
    ...(debts.length ? [{ key: "debts", title: ar ? "مستحقات عملاء مفتوحة" : "Outstanding customer balances", detail: ar ? debts.length + " حساباً يحتوي على رصيد غير محصل." : debts.length + " account(s) have uncollected balances.", target: "debts", severity: "medium" }] : []),
    ...(maintenanceAlerts.length ? [{ key: "maintenance", title: ar ? "مواعيد صيانة تحتاج متابعة" : "Maintenance due for follow-up", detail: ar ? maintenanceAlerts.length + " تنبيهاً مرتبطاً بالصيانة." : maintenanceAlerts.length + " maintenance-related alert(s).", target: "maintenance", severity: "medium" }] : []),
    ...(alerts.length ? [{ key: "alerts", title: ar ? "استحقاقات وتنبيهات قريبة" : "Upcoming due dates and alerts", detail: ar ? alerts.length + " تنبيهاً مسجلاً في النظام." : alerts.length + " alert(s) currently recorded.", target: "alerts", severity: "low" }] : [])
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onCreateApproval({ request_type: requestType, reason: reason.trim(), amount: amount.trim() ? Number(amount) : undefined, currency });
      setReason("");
      setAmount("");
    } finally {
      setSaving(false);
    }
  }

  const requestLabel = (value: string) => ({
    discount: ar ? "خصم استثنائي" : "Special discount",
    contract_cancellation: ar ? "إلغاء عقد" : "Contract cancellation",
    large_expense: ar ? "مصروف كبير" : "Large expense",
    record_deletion: ar ? "حذف سجل" : "Record deletion",
    financial_adjustment: ar ? "تعديل مالي" : "Financial adjustment",
    other: ar ? "طلب آخر" : "Other request"
  } as Record<string, string>)[value] || value;

  return <section className="owner-command" dir={ar ? "rtl" : "ltr"}>
    <div className="owner-hero">
      <div><span className="owner-eyebrow">ARKAN 360 · OWNER INTELLIGENCE</span><h2>{ar ? "مركز قيادة المالك" : "Owner Command Center"}</h2><p>{ar ? "رؤية تنفيذية موحدة مبنية على بيانات الشركة المسجلة، مع إبقاء القرارات الحساسة تحت موافقتك." : "An executive view built from recorded company data, with sensitive decisions kept under your approval."}</p></div>
      <div className="owner-shield"><ShieldCheck size={24}/><b>{ar ? "التحكم بيد المالك" : "Owner-controlled"}</b><small>{ar ? "لا تنفيذ مالي تلقائي" : "No automatic financial execution"}</small></div>
    </div>

    <div className="owner-metrics">
      <button type="button" onClick={() => onOpen("cars")}><span><CarFront/></span><small>{ar ? "إجمالي السيارات" : "Fleet size"}</small><strong>{cars.length}</strong><em>{ar ? "نسبة التأجير" : "Utilization"} · {utilization}%</em></button>
      <button type="button" onClick={() => onOpen("contracts")}><span><Clock3/></span><small>{ar ? "العقود المتأخرة" : "Overdue contracts"}</small><strong>{overdueContracts.length}</strong><em>{ar ? "تحتاج متابعة" : "Require follow-up"}</em></button>
      <button type="button" onClick={() => onOpen("debts")}><span><Banknote/></span><small>{ar ? "حسابات مستحقة" : "Receivable accounts"}</small><strong>{debts.length}</strong><em>{ar ? "أرصدة مفتوحة" : "Open balances"}</em></button>
      <button type="button" onClick={() => onOpen("approvals")}><span><BadgeCheck/></span><small>{ar ? "موافقات معلقة" : "Pending approvals"}</small><strong>{pendingApprovals.length}</strong><em>{ar ? "بانتظار القرار" : "Awaiting decision"}</em></button>
    </div>

    <div className="owner-grid">
      <div className="owner-panel">
        <div className="owner-panel-head"><div><h3><Sparkles size={18}/>{ar ? "اقتراحات AUTO PILOT" : "AUTO PILOT recommendations"}</h3><p>{ar ? "قواعد تشغيلية قابلة للتفسير من السجلات الحالية." : "Explainable operational rules based on current records."}</p></div><span className="owner-tag">{ar ? "مساعد" : "Advisory"}</span></div>
        {suggestions.length ? <div className="owner-suggestions">{suggestions.map(item => <button key={item.key} type="button" onClick={() => onOpen(item.target)}><span className={"owner-severity " + item.severity}><AlertTriangle size={16}/></span><span><b>{item.title}</b><small>{item.detail}</small></span><em>{ar ? "مراجعة" : "Review"} ←</em></button>)}</div> : <div className="owner-empty"><CheckCircle2/>{ar ? "لا توجد مؤشرات متابعة مستخرجة من البيانات الحالية." : "No follow-up indicators were found in the current data."}</div>}
        <p className="owner-disclaimer">{ar ? "هذه اقتراحات مبنية على قواعد واضحة وليست قرارات آلية أو تنبؤات مؤكدة. لا ينفذ النظام أي إجراء مالي أو تعاقدي تلقائياً." : "These are rule-based suggestions, not automatic decisions or guaranteed forecasts. No financial or contractual action is executed automatically."}</p>
      </div>

      <div className="owner-panel">
        <div className="owner-panel-head"><div><h3><Activity size={18}/>{ar ? "الحركة المالية لهذا الشهر" : "This month's cash movement"}</h3><p>{ar ? "حسب المقبوضات والمدفوعات المسجلة، مع فصل العملات." : "Based on recorded receipts and expenses, with currencies kept separate."}</p></div></div>
        {Object.keys(financial).length ? <div className="owner-financial">{Object.entries(financial).map(([cur, values]) => <div key={cur}><b>{cur}</b><span>{ar ? "قبض" : "Income"} <strong>{money(values.income)}</strong></span><span>{ar ? "صرف" : "Expenses"} <strong>{money(values.expenses)}</strong></span><span>{ar ? "الصافي النقدي" : "Net cash"} <strong>{money(values.income - values.expenses)}</strong></span></div>)}</div> : <div className="owner-empty"><Banknote/>{ar ? "لا توجد حركات نقدية مصنفة لهذا الشهر." : "No classified cash transactions for this month."}</div>}
        <p className="owner-disclaimer">{ar ? "صافي حركة الصندوق ليس بالضرورة صافي الربح المحاسبي." : "Net cash movement is not necessarily accounting profit."}</p>
        <button className="owner-link" type="button" onClick={() => onOpen("reports")}>{ar ? "فتح التقارير المالية ←" : "Open financial reports →"}</button>
      </div>
    </div>

    <div className="owner-grid">
      <div className="owner-panel">
        <div className="owner-panel-head"><div><h3><BadgeCheck size={18}/>{ar ? "طلبات الموافقة" : "Approval requests"}</h3><p>{ar ? "اعتماد أو رفض الطلبات الحساسة مع توثيق القرار." : "Approve or reject sensitive requests with a recorded decision."}</p></div><b>{pendingApprovals.length}</b></div>
        <div className="owner-approvals">
          {approvals.length ? approvals.slice(0, 8).map(item => <div key={item.id}><span><b>{requestLabel(item.request_type)}</b><small>{item.reason}</small><small>{item.amount ? money(Number(item.amount)) + " " + (item.currency || "ILS") + " · " : ""}{String(item.created_at || "").slice(0, 10)}</small></span><strong className={"owner-status " + item.status}>{item.status === "pending" ? (ar ? "معلق" : "Pending") : item.status === "approved" ? (ar ? "معتمد" : "Approved") : item.status === "rejected" ? (ar ? "مرفوض" : "Rejected") : item.status}</strong>{isOwner && item.status === "pending" && <span className="owner-actions"><button type="button" disabled={saving} onClick={() => void onReviewApproval(item.id, "approved")}><CheckCircle2 size={15}/>{ar ? "اعتماد" : "Approve"}</button><button type="button" disabled={saving} onClick={() => void onReviewApproval(item.id, "rejected")}><XCircle size={15}/>{ar ? "رفض" : "Reject"}</button></span>}</div>) : <div className="owner-empty"><BadgeCheck/>{ar ? "لا توجد طلبات موافقة حتى الآن." : "No approval requests yet."}</div>}
        </div>
        <form className="owner-request-form" onSubmit={submit}>
          <h4>{ar ? "إنشاء طلب موافقة" : "Create an approval request"}</h4>
          <div className="owner-form-row"><select value={requestType} onChange={e => setRequestType(e.target.value)}><option value="large_expense">{ar ? "مصروف كبير" : "Large expense"}</option><option value="discount">{ar ? "خصم استثنائي" : "Special discount"}</option><option value="contract_cancellation">{ar ? "إلغاء عقد" : "Contract cancellation"}</option><option value="financial_adjustment">{ar ? "تعديل مالي" : "Financial adjustment"}</option><option value="record_deletion">{ar ? "حذف سجل" : "Record deletion"}</option><option value="other">{ar ? "طلب آخر" : "Other"}</option></select><input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder={ar ? "المبلغ (اختياري)" : "Amount (optional)"}/><select value={currency} onChange={e => setCurrency(e.target.value)}><option value="ILS">ILS</option><option value="USD">USD</option><option value="JOD">JOD</option><option value="EUR">EUR</option></select></div>
          <textarea required value={reason} onChange={e => setReason(e.target.value)} placeholder={ar ? "اشرح سبب الطلب والتفاصيل المطلوبة..." : "Explain the reason and requested details..."}/>
          <button type="submit" disabled={saving || !reason.trim()}>{saving ? (ar ? "جارٍ الإرسال..." : "Submitting...") : (ar ? "إرسال للمالك للموافقة" : "Submit for owner approval")}</button>
        </form>
      </div>

      <div className="owner-panel">
        <div className="owner-panel-head"><div><h3><BellRing size={18}/>{ar ? "ملاحظات AUTO PILOT المسجلة" : "Recorded AUTO PILOT findings"}</h3><p>{ar ? "تنبيهات محفوظة للمراجعة والمتابعة." : "Saved findings awaiting review and follow-up."}</p></div><b>{openFindings.length}</b></div>
        {openFindings.length ? <div className="owner-suggestions">{openFindings.slice(0, 8).map(item => <div key={item.id} className="owner-finding"><span className={"owner-severity " + item.severity}><AlertTriangle size={16}/></span><span><b>{item.title}</b><small>{item.description}</small><small>{ar ? "التوصية: " : "Recommendation: "}{item.recommendation}</small></span></div>)}</div> : <div className="owner-empty"><CheckCircle2/>{ar ? "لا توجد اكتشافات محفوظة بعد. تظهر الاقتراحات المباشرة في قسم AUTO PILOT." : "No persisted findings yet. Live rule-based suggestions appear in AUTO PILOT."}</div>}
        <p className="owner-disclaimer">{ar ? "يتم عرض البيانات حسب صلاحيات المستخدم والفرع المحدد. لا يتم دمج بيانات الفروع أو العملات دون قواعد واضحة." : "Data is shown according to the user's permissions and selected branch. Branches and currencies are not combined without explicit rules."}</p>
      </div>
    </div>
  </section>;
}
