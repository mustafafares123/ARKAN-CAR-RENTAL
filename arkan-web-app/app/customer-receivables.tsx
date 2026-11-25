"use client";

import { useMemo, useState } from "react";
import { Search, Wallet, Users, FileText, CircleAlert, ChevronDown, ChevronUp } from "lucide-react";

type Row = { [key: string]: any };
type Props = { ar: boolean; contracts: Row[]; cash: Row[]; customers: Row[]; onRecordPayment: (contract: Row) => void };
const n = (v: any) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
const fmt = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
const cur = (v: any) => { const s=String(v||"ILS").trim().toUpperCase(); if(["₪","NIS","ILS","شيكل"].includes(s))return "ILS";if(["$","USD","US$","دولار"].includes(s))return "USD";if(["JOD","دينار"].includes(s))return "JOD";if(["EUR","€","يورو"].includes(s))return "EUR";return s; };
const isReceipt = (v: any) => ["قبض","receipt","income","received"].includes(String(v||"").trim().toLowerCase());
const dayDiff = (date: any) => { const d=String(date||"").slice(0,10); if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(d))return null;const a=new Date(d+"T00:00:00").getTime(),b=new Date();b.setHours(0,0,0,0);return Math.floor((b.getTime()-a)/86400000); };

export default function CustomerReceivables({ar,contracts,cash,customers,onRecordPayment}:Props){
 const [search,setSearch]=useState(""); const [filter,setFilter]=useState("all"); const [expanded,setExpanded]=useState("");
 const rows=useMemo(()=>{
  const valid=(contracts||[]).filter(c=>!["cancelled","canceled","ملغي","مرفوض","rejected"].includes(String(c.status||"").toLowerCase()));
  const byCustomer=new Map<string,any>();
  valid.forEach(c=>{
   const name=String(c.customer_name||"").trim()|| (ar?"عميل غير محدد":"Unassigned customer");
   const customer=(customers||[]).find(x=>String(x.id)===String(c.customer_id))||(customers||[]).find(x=>String(x.full_name||"").trim().toLowerCase()===name.toLowerCase());
   const key=String(c.customer_id||customer?.id||name.toLowerCase());
   const currency=cur(c.currency);
   const contractNo=String(c.contract_no||"").trim();
   const paid=(cash||[]).filter(p=>isReceipt(p.kind)&&String(p.contract_no||"").trim()===contractNo&&cur(p.currency)===currency).reduce((sum,p)=>sum+n(p.amount),0);
   const total=n(c.total_amount),outstanding=Math.max(0,total-paid);
   if(outstanding<=0.009)return;
   if(!byCustomer.has(key))byCustomer.set(key,{key,name,phone:customer?.phone||"",contracts:[],totals:{}});
   const group=byCustomer.get(key);group.contracts.push({...c,paid_amount:paid,outstanding,currency});
   if(!group.totals[currency])group.totals[currency]={total:0,paid:0,outstanding:0};
   group.totals[currency].total+=total;group.totals[currency].paid+=paid;group.totals[currency].outstanding+=outstanding;
  });
  return Array.from(byCustomer.values()).map(g=>({...g,contracts:g.contracts.sort((a:any,b:any)=>String(a.end_date||"").localeCompare(String(b.end_date||""))),overdue:g.contracts.some((c:any)=>{const days=dayDiff(c.end_date);return days!==null&&days>0;})})).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||a.name.localeCompare(b.name));
 },[contracts,cash,customers,ar]);
 const filtered=rows.filter(g=>(filter==="all"||(filter==="overdue"&&g.overdue)||(filter==="open"&&!g.overdue))&&[g.name,g.phone,...g.contracts.map((c:any)=>c.contract_no+" "+c.car_label)].join(" ").toLowerCase().includes(search.toLowerCase()));
 const totals=rows.reduce((acc,g)=>{Object.entries(g.totals).forEach(([c,v]:any)=>{if(!acc[c])acc[c]={total:0,paid:0,outstanding:0};acc[c].total+=v.total;acc[c].paid+=v.paid;acc[c].outstanding+=v.outstanding;});return acc;},{ } as Record<string,{total:number;paid:number;outstanding:number}>);
 const t=(a:string,e:string)=>ar?a:e;
 return <div className="receivables-workspace">
  <div className="page-heading"><div><span className="eyebrow">{t("متابعة التحصيل","COLLECTION MANAGEMENT")}</span><h2>{t("كشف حساب العملاء والديون","Customer receivables ledger")}</h2><p>{t("تجميع أرصدة العقود المفتوحة حسب العميل، مع فصل العملات وإظهار العقود التي تجاوزت تاريخ نهايتها.", "Customer-level balances across open contracts, with currencies separated and contracts past their end date highlighted.")}</p></div></div>
  <div className="stats-grid receivable-stats"><div className="stat-card"><div className="stat-icon orange"><Wallet/></div><div><span>{t("العملاء عليهم مستحقات","Customers with balances")}</span><strong>{rows.length}</strong></div></div><div className="stat-card"><div className="stat-icon blue"><FileText/></div><div><span>{t("العقود المفتوحة","Open contracts")}</span><strong>{rows.reduce((s,g)=>s+g.contracts.length,0)}</strong></div></div><div className="stat-card"><div className="stat-icon purple"><CircleAlert/></div><div><span>{t("عملاء لديهم عقود تجاوزت نهايتها","Past-end-date customers")}</span><strong>{rows.filter(g=>g.overdue).length}</strong></div></div><div className="stat-card"><div className="stat-icon green"><Users/></div><div><span>{t("إجمالي أرصدة العملاء","Outstanding by currency")}</span><strong>{Object.entries(totals).map(([c,v])=>fmt(v.outstanding)+" "+c).join(" / ")||"0 ILS"}</strong></div></div></div>
  <div className="panel cash-statement"><div className="receivable-toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("ابحث باسم العميل أو الهاتف أو رقم العقد...","Search customer, phone or contract...")}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{t("كل المستحقات","All balances")}</option><option value="overdue">{t("عقود تجاوزت تاريخ النهاية","Past end date")}</option><option value="open">{t("لم تتجاوز تاريخ النهاية","Not past end date")}</option></select></div>
   <div className="table-wrap"><table><thead><tr><th>{t("العميل","Customer")}</th><th>{t("الهاتف","Phone")}</th><th>{t("عدد العقود","Contracts")}</th><th>{t("الرصيد حسب العملة","Balance by currency")}</th><th>{t("المتابعة","Follow-up")}</th><th>{t("التفاصيل","Details")}</th></tr></thead><tbody>{filtered.map(g=><><tr key={g.key}><td><b>{g.name}</b></td><td>{g.phone||"—"}</td><td>{g.contracts.length}</td><td>{Object.entries(g.totals).map(([c,v]:any)=><div key={c}>{fmt(v.outstanding)} {c}</div>)}</td><td><span className={g.overdue?"receivable-status overdue":"receivable-status"}>{g.overdue?t("يوجد عقد تجاوز تاريخ نهايته","Past end date"):t("ضمن مدة العقد","Within contract period")}</span></td><td><button type="button" className="row-action" onClick={()=>setExpanded(expanded===g.key?"":g.key)}>{expanded===g.key?<ChevronUp size={15}/>:<ChevronDown size={15}/>} {t("كشف العميل","Customer ledger")}</button></td></tr>{expanded===g.key&&<tr key={g.key+"-details"}><td colSpan={6}><div className="receivable-detail"><table><thead><tr><th>{t("العقد","Contract")}</th><th>{t("السيارة","Vehicle")}</th><th>{t("نهاية العقد","End date")}</th><th>{t("قيمة العقد","Contract value")}</th><th>{t("المقبوض","Paid")}</th><th>{t("المتبقي","Balance")}</th><th>{t("الإجراء","Action")}</th></tr></thead><tbody>{g.contracts.map((c:any)=><tr key={c.id}><td>{c.contract_no||"—"}</td><td>{c.car_label||"—"}</td><td>{c.end_date||"—"}</td><td>{fmt(n(c.total_amount))} {c.currency}</td><td>{fmt(c.paid_amount)} {c.currency}</td><td><b className="profit-negative">{fmt(c.outstanding)} {c.currency}</b></td><td><button type="button" className="row-action" onClick={()=>onRecordPayment(c)}>{t("تسجيل دفعة","Record payment")}</button></td></tr>)}</tbody></table></div></td></tr>}</>)}</tbody></table>{!filtered.length&&<p className="statement-empty">{t("لا توجد مستحقات تطابق البحث أو الفلتر الحالي.","No receivables match this search or filter.")}</p>}</div>
   <p className="statement-empty">{t("تنبيه: تصنيف «تجاوز تاريخ النهاية» يعني أن تاريخ نهاية العقد مضى، ولا يثبت وحده أن العميل متأخر عن موعد سداد متفق عليه. تُطابق الدفعات برقم العقد والعملة نفسها فقط.", "Note: “Past end date” means the contract end date has passed; it does not by itself establish a missed payment due date. Receipts are matched only by contract number and currency.")}</p>
  </div>
 </div>;
}
