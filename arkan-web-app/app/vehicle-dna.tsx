"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarClock, CarFront, CircleDollarSign, FileText, Gauge, ShieldCheck, Wrench } from "lucide-react";

type Row = { id?: string; [key: string]: any };
type Props = { ar: boolean; cars: Row[]; contracts: Row[]; cash: Row[]; maintenance: Row[]; insurance: Row[]; vehicleCosts: Row[]; incidents: Row[]; fines: Row[]; inspections: Row[] };
const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
const cur = (v: any) => { const x=String(v||"ILS").trim().toUpperCase(); if(["₪","NIS","ILS","شيكل"].includes(x))return "ILS"; if(["$","US$","USD","دولار"].includes(x))return "USD"; if(["JOD","دينار"].includes(x))return "JOD"; if(["€","EUR"].includes(x))return "EUR"; return x; };
const dateOf = (r: Row, keys: string[]) => { for(const k of keys){const v=String(r[k]||"").slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;}return ""; };
const tokens = (v: any) => String(v||"").toLowerCase().split(/\s+-\s+|\s*[|,،]\s*/).map(x=>x.trim()).filter(Boolean);

export default function VehicleDNA({ar,cars,contracts,cash,maintenance,insurance,vehicleCosts,incidents,fines,inspections}:Props){
 const [selected,setSelected]=useState("");
 const [period,setPeriod]=useState("all");
 const car=cars.find(x=>String(x.id)===selected)||cars[0];
 const t=(a:string,e:string)=>ar?a:e;
 const profile=useMemo(()=>{
  if(!car)return null;
  const ids=[car.id,car.plate,car.car_number,car.car_label].filter(Boolean).map(x=>String(x).toLowerCase());
  const matches=(r:Row)=>{if(r.car_id&&String(r.car_id)===String(car.id))return true;const ts=tokens(r.car_label||r.car_plate||r.plate||r.car_number);return ts.some(x=>ids.includes(x));};
  const cs=contracts.filter(matches);
  const nums=new Set(cs.map(x=>String(x.contract_no||"").trim()).filter(Boolean));
  const receipts=cash.filter(x=>nums.has(String(x.contract_no||"").trim())&&["قبض","قبض نقدي","مقبوض","استلام","إيراد","ايراد","receipt","income","received"].includes(String(x.kind||"").trim().toLowerCase()));
  const costs: Row[]=[...maintenance.filter(matches).map(x=>({...x,_kind:"maintenance",_date:dateOf(x,["service_date","created_at"]),_amount:n(x.cost)})),...insurance.filter(matches).map(x=>({...x,_kind:"insurance",_date:dateOf(x,["start_date","created_at"]),_amount:n(x.premium)})),...vehicleCosts.filter(matches).map(x=>({...x,_kind:"registration",_date:dateOf(x,["due_date","created_at"]),_amount:n(x.amount)}))];
  const sums:Record<string,{income:number;cost:number}>={};
  receipts.forEach(x=>{const c=cur(x.currency);if(!sums[c])sums[c]={income:0,cost:0};sums[c].income+=n(x.amount);});
  costs.forEach(x=>{const c=cur(x.currency);if(!sums[c])sums[c]={income:0,cost:0};sums[c].cost+=x._amount;});
  const history=[
   ...cs.map(x=>({id:x.id,date:dateOf(x,["start_date","created_at"]),kind:"contract",title:t("عقد تأجير","Rental contract"),detail:String(x.contract_no||"")+" · "+String(x.customer_name||""),amount:n(x.total_amount),currency:cur(x.currency)})),
   ...receipts.map(x=>({id:x.id,date:dateOf(x,["transaction_date","created_at"]),kind:"receipt",title:t("دفعة مستلمة","Payment received"),detail:String(x.description||x.contract_no||""),amount:n(x.amount),currency:cur(x.currency)})),
   ...costs.map(x=>({id:x.id,date:x._date,kind:x._kind,title:x._kind==="maintenance"?t("صيانة","Maintenance"):x._kind==="insurance"?t("تأمين","Insurance"):t("ترخيص","Registration"),detail:String(x.description||x.service_type||x.insurer_name||x.invoice_no||""),amount:x._amount,currency:cur(x.currency)})),
   ...incidents.filter(matches).map(x=>({id:x.id,date:dateOf(x,["accident_date","created_at"]),kind:"incident",title:t("حادث / مطالبة","Accident / claim"),detail:String(x.damage_description||x.incident_type||""),amount:n(x.estimated_cost),currency:cur(x.currency)})),
   ...fines.filter(matches).map(x=>({id:x.id,date:dateOf(x,["fine_date","created_at"]),kind:"fine",title:t("مخالفة مرورية","Traffic fine"),detail:String(x.fine_type||""),amount:n(x.amount),currency:cur(x.currency)})),
   ...inspections.filter(matches).map(x=>({id:x.id,date:dateOf(x,["inspection_date","created_at"]),kind:"inspection",title:t("فحص سيارة","Vehicle inspection"),detail:String(x.stage||"")+" · "+String(x.damage_notes||x.condition_notes||""),amount:0,currency:""}))
  ].filter(x=>period==="all"||x.date.startsWith(period)).sort((a,b)=>b.date.localeCompare(a.date));
  return {cs,receipts,costs,sums,history};
 },[car,contracts,cash,maintenance,insurance,vehicleCosts,incidents,fines,inspections,period,ar]);
 const months=Array.from(new Set((profile?.history||[]).map(x=>x.date.slice(0,7)).filter(Boolean))).sort().reverse();
 if(!cars.length)return <section className="panel"><h2>{t("الهوية الرقمية للسيارة","Vehicle DNA")}</h2><p>{t("أضف السيارات أولاً لعرض ملفاتها الرقمية.","Add vehicles first to create their digital profiles.")}</p></section>;
 return <section className="profitability-workspace" dir={ar?"rtl":"ltr"}>
  <div className="page-heading"><div><span className="eyebrow">ARKAN · VEHICLE DNA</span><h2>{t("الملف الذكي لكل سيارة","Vehicle Digital Identity")}</h2><p>{t("سجل حياة السيارة من العقود والمقبوضات والصيانة والتأمين والترخيص والحوادث والمخالفات والفحوصات.","A vehicle lifecycle record from contracts, receipts, maintenance, insurance, registration, incidents, fines and inspections.")}</p></div><select className="profit-period" value={selected||cars[0]?.id||""} onChange={e=>setSelected(e.target.value)}>{cars.map((x,i)=><option key={x.id||i} value={x.id}>{[x.make,x.model].filter(Boolean).join(" ")||x.car_number||x.plate||t("سيارة","Vehicle")} · {x.plate||x.car_number||"—"}</option>)}</select></div>
  {profile&&<><div className="stats-grid profit-stats">
   <div className="stat-card"><div className="stat-icon blue"><CarFront/></div><div><span>{t("السيارة / اللوحة","Vehicle / plate")}</span><strong>{[car.make,car.model].filter(Boolean).join(" ")||car.plate||car.car_number}</strong><small>{car.plate||car.car_number||"—"} · {car.year||"—"}</small></div></div>
   <div className="stat-card"><div className="stat-icon green"><CircleDollarSign/></div><div><span>{t("المقبوضات المرتبطة","Linked receipts")}</span><strong>{profile.receipts.length}</strong><small>{t("حركة قبض مسجلة","Recorded receipts")}</small></div></div>
   <div className="stat-card"><div className="stat-icon orange"><Wrench/></div><div><span>{t("سجلات الصيانة","Maintenance records")}</span><strong>{profile.costs.filter(x=>x._kind==="maintenance").length}</strong><small>{t("عمليات مسجلة","Recorded services")}</small></div></div>
   <div className="stat-card"><div className="stat-icon purple"><Activity/></div><div><span>{t("العقود المرتبطة","Linked contracts")}</span><strong>{profile.cs.length}</strong><small>{t("حسب رقم السيارة أو اللوحة","Matched by vehicle ID or plate")}</small></div></div>
  </div>
  <div className="panel cash-statement"><div className="panel-head"><div><h3>{t("ملخص الإيرادات والتكاليف حسب العملة","Revenue and cost summary by currency")}</h3><p>{t("الأرقام مبنية على المقبوضات الفعلية والتكاليف المسجلة فقط، دون خلط العملات.","Based on actual receipts and recorded costs; currencies are not mixed.")}</p></div><Gauge/></div><div className="table-wrap"><table><thead><tr><th>{t("العملة","Currency")}</th><th>{t("المقبوض","Collected")}</th><th>{t("التكاليف","Costs")}</th><th>{t("الصافي التشغيلي","Operating net")}</th></tr></thead><tbody>{Object.entries(profile.sums).map(([c,v])=><tr key={c}><td>{c}</td><td>{v.income.toLocaleString("en-US")}</td><td>{v.cost.toLocaleString("en-US")}</td><td><strong className={v.income-v.cost<0?"profit-negative":"profit-positive"}>{(v.income-v.cost).toLocaleString("en-US")}</strong></td></tr>)}</tbody></table>{!Object.keys(profile.sums).length&&<p className="statement-empty">{t("لا توجد حركات مالية مرتبطة بهذه السيارة بعد.","No financial transactions are linked to this vehicle yet.")}</p>}</div></div>
  <div className="panel cash-statement"><div className="panel-head"><div><h3>{t("سجل حياة السيارة","Vehicle lifecycle timeline")}</h3><p>{t("كل الأحداث المرتبطة بالسيارة في سجل واحد.","All matched vehicle events in one timeline.")}</p></div><select className="profit-period" value={period} onChange={e=>setPeriod(e.target.value)}><option value="all">{t("كل الفترات","All periods")}</option>{months.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
   <div className="owner-approvals">{profile.history.map((x,i)=><div key={x.kind+"-"+(x.id||i)}><span><b>{x.title}</b><small>{x.date||t("تاريخ غير محدد","Date not recorded")} · {x.detail||"—"}</small></span>{x.amount>0&&<span className="owner-status">{x.amount.toLocaleString("en-US")} {x.currency}</span>}</div>)}{!profile.history.length&&<p className="statement-empty">{t("لا توجد أحداث مسجلة مرتبطة بهذه السيارة.","No lifecycle events are linked to this vehicle.")}</p>}</div>
  </div><p className="profit-note"><b>{t("ملاحظة محاسبية","Accounting note")}</b><br/>{t("هذا صافي تشغيلي جزئي، وليس ربحاً محاسبياً نهائياً؛ لا يشمل الاستهلاك والرواتب والمصاريف العامة أو الضرائب. تعتمد دقة الربط على تسجيل رقم السيارة أو اللوحة أو car_id في السجلات.","This is a partial operating net, not final accounting profit; depreciation, payroll, overhead and taxes are excluded. Matching depends on vehicle ID, plate or car_id being recorded consistently.")}</p></>}
 </section>;
}
