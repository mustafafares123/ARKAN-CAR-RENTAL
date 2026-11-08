 "use client";
import { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { LayoutDashboard, CarFront, Users, CalendarDays, FileText, Wallet, Wrench, MapPin, AlertTriangle, Languages, Plus, Search, Menu, X, LogOut, Settings, Bell, Globe2, CircleDollarSign, Activity, CheckCircle2 } from "lucide-react";

type Row = { id: string; [key: string]: any };
const SECTIONS = [
  ["dashboard","لوحة التحكم","Dashboard",LayoutDashboard],
  ["cars","السيارات","Cars",CarFront],
  ["customers","العملاء","Customers",Users],
  ["bookings","الحجوزات","Bookings",CalendarDays],
  ["contracts","العقود","Contracts",FileText],
  ["cash","الصندوق","Cashbox",Wallet],
  ["maintenance","الصيانة","Maintenance",Wrench],
  ["trackers","أجهزة التتبع","GPS Devices",MapPin],
  ["fines","المخالفات","Traffic Fines",AlertTriangle]
] as const;
const TABLES: Record<string,string> = {cars:"cars",customers:"customers",bookings:"bookings",contracts:"contracts",cash:"cash_transactions",maintenance:"maintenance",trackers:"gps_devices",fines:"traffic_fines"};
const LABELS: Record<string,string[]> = {
 cars:["رقم السيارة","اللوحة","الماركة","الموديل","السنة","الحالة","السعر اليومي"],
 customers:["اسم العميل","رقم الهاتف","رقم الهوية/الجواز","البريد الإلكتروني"],
 bookings:["اسم العميل","السيارة / اللوحة","من تاريخ","إلى تاريخ","الحالة"],
 contracts:["رقم العقد","اسم العميل","السيارة / اللوحة","بداية العقد","نهاية العقد","الإجمالي"],
 cash:["التاريخ","نوع الحركة","البيان","المبلغ","العملة","رقم العقد"],
 maintenance:["التاريخ","السيارة / اللوحة","نوع الصيانة","الوصف","التكلفة"],
 trackers:["السيارة / اللوحة","رقم الجهاز","مزود الخدمة","حالة الاتصال","آخر تحديث"],
 fines:["تاريخ المخالفة","السيارة / اللوحة","رقم العقد","نوع المخالفة","المبلغ","حالة التحقق","حالة التحصيل"]
};
const FIELDS: Record<string,string[]> = {
 cars:["car_number","plate","make","model","year","status","daily_rate"],
 customers:["full_name","phone","identity_no","email"],
 bookings:["customer_name","car_label","start_date","end_date","status"],
 contracts:["contract_no","customer_name","car_label","start_date","end_date","total_amount"],
 cash:["transaction_date","kind","description","amount","currency","contract_no"],
 maintenance:["service_date","car_label","service_type","description","cost"],
 trackers:["car_label","device_no","provider","connection_status","last_seen"],
 fines:["fine_date","car_label","contract_no","fine_type","amount","verification_status","collection_status"]
};
const initial: Record<string,Row[]> = {
 cars:[
  {id:"c1",car_number:"CAR-001",plate:"12-345-67",make:"Toyota",model:"Corolla",year:"2022",status:"متاحة",daily_rate:"150"},
  {id:"c2",car_number:"CAR-002",plate:"22-111-33",make:"Hyundai",model:"Elantra",year:"2023",status:"مؤجرة",daily_rate:"170"},
  {id:"c3",car_number:"CAR-003",plate:"33-222-44",make:"Kia",model:"Sportage",year:"2021",status:"صيانة",daily_rate:"210"}
 ],
 customers:[{id:"u1",full_name:"عميل تجريبي",phone:"0590000000",identity_no:"",email:""}],
 bookings:[],contracts:[],cash:[],maintenance:[],trackers:[],fines:[]
};
const money = (v:any) => new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(Number(v||0));
const envReady = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function Home() {
 const [section,setSection]=useState("dashboard"), [lang,setLang]=useState<"ar"|"en">("ar");
 const [rows,setRows]=useState<Record<string,Row[]>>(initial), [query,setQuery]=useState(""), [showForm,setShowForm]=useState(false);
 const [form,setForm]=useState<Record<string,string>>({}), [notice,setNotice]=useState(""), [mobileOpen,setMobileOpen]=useState(false);
 const [client,setClient]=useState<SupabaseClient|null>(null), [cloud,setCloud]=useState(false), [loading,setLoading]=useState(false);
 const ar=lang==="ar"; const active=SECTIONS.find(s=>s[0]===section)!; const ActiveIcon=active[3];
 useEffect(()=>{ try {
   const saved=localStorage.getItem("arkan-data-v1"); if(saved) setRows({...initial,...JSON.parse(saved)});
   if(envReady){ const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); setClient(sb); setCloud(true); }
  } catch(e){} },[]);
 useEffect(()=>{ try{localStorage.setItem("arkan-data-v1",JSON.stringify(rows));}catch(e){} },[rows]);
 const allCars=rows.cars||[], allCustomers=rows.customers||[];
 const totalIncome=(rows.cash||[]).filter(x=>x.kind==="قبض"||x.kind==="Receipt").reduce((a,x)=>a+Number(x.amount||0),0);
 const totalExpense=(rows.cash||[]).filter(x=>x.kind==="صرف"||x.kind==="Payment").reduce((a,x)=>a+Number(x.amount||0),0);
 const available=allCars.filter(x=>["متاحة","Available"].includes(x.status)).length;
 const rented=allCars.filter(x=>["مؤجرة","Rented"].includes(x.status)).length;
 const title=(s:any)=>ar?s[1]:s[2];
 const data=rows[section]||[];
 const filtered=data.filter(r=>Object.values(r).join(" ").toLowerCase().includes(query.toLowerCase()));
 function addRow(e:any){e.preventDefault(); const id=crypto.randomUUID(); setRows(old=>({...old,[section]:[{id,...form},...(old[section]||[])]})); setForm({});setShowForm(false);setNotice(ar?"تمت إضافة السجل على هذا الجهاز":"Record added on this device");}
 async function loadCloud(){
  if(!client){setNotice(ar?"أضف إعدادات Supabase للاتصال السحابي":"Add Supabase settings to enable cloud sync");return;}
  setLoading(true);
  try {
   const {data:auth}=await client.auth.getSession();
   if(!auth.session){setNotice(ar?"قاعدة البيانات جاهزة؛ يلزم إعداد تسجيل الدخول والسياسات قبل مزامنة بيانات الشركة.":"Database configured; sign-in and company policies must be set before syncing.");}
   else {setNotice(ar?"تم الاتصال بحسابك. اربط جداول الشركة قبل تفعيل المزامنة.":"Signed in. Connect company tables before enabling sync.");}
  } catch(e){setNotice(ar?"تعذر الاتصال. تحقق من إعدادات Supabase.":"Connection failed. Check Supabase settings.");}
  setLoading(false);
 }
 const nav=<>{SECTIONS.map(s=>{const Icon=s[3];return <button key={s[0]} className={"nav-item "+(section===s[0]?"selected":"")} onClick={()=>{setSection(s[0]);setQuery("");setMobileOpen(false)}}><Icon size={18}/><span>{title(s)}</span></button>})}</>;
 const sectionLabel=title(active);
 return <main className={ar?"app rtl":"app ltr"} dir={ar?"rtl":"ltr"}>
  <aside className={"sidebar "+(mobileOpen?"open":"")}><div className="brand"><div className="brand-mark">A</div><div><b>ARKAN CO.</b><small>RENT A CAR</small></div><button className="close-mobile" onClick={()=>setMobileOpen(false)}><X/></button></div>
   <div className="company-tag">{ar?"نظام إدارة تأجير السيارات":"Car Rental Management"}</div><nav>{nav}</nav>
   <div className="sidebar-bottom"><div className="cloud-state"><span className={cloud?"dot amber":"dot"}></span><div><b>{cloud?(ar?"إعداد السحابة موجود":"Cloud configured"):(ar?"وضع تجريبي محلي":"Local demo mode")}</b><small>{ar?"حالة التخزين":"Storage status"}</small></div></div><button className="nav-item" onClick={()=>setNotice(ar?"الإعدادات ستضاف في المرحلة التالية":"Settings will be added in the next phase")}><Settings size={18}/>{ar?"الإعدادات":"Settings"}</button></div>
  </aside>
  {mobileOpen&&<div className="scrim" onClick={()=>setMobileOpen(false)} />}
  <section className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div><div className="eyebrow">{ar?"مرحباً بك في":"WELCOME TO"}</div><h1>{ar?"إدارة أسطول ARKAN":"ARKAN Fleet Management"}</h1></div><div className="top-actions"><button className="icon-btn" onClick={()=>setNotice(ar?"لا توجد تنبيهات جديدة":"No new notifications")}><Bell size={18}/></button><button className="language-btn" onClick={()=>setLang(ar?"en":"ar")}><Languages size={17}/>{ar?"English":"العربية"}</button><div className="avatar">A</div></div></header>
   <div className="content">
    {notice&&<div className="notice"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
    {section==="dashboard"?<>
     <div className="page-heading"><div><span className="eyebrow">{ar?"نظرة عامة":"OVERVIEW"}</span><h2>{ar?"لوحة التحكم":"Dashboard"}</h2><p>{ar?"ملخص سريع لأداء شركة التأجير":"A quick overview of your rental business"}</p></div><div className="date-chip"><CalendarDays size={16}/>{new Date().toLocaleDateString(ar?"ar":"en-GB")}</div></div>
     <div className="stats-grid">
      <Stat icon={<CarFront/>} label={ar?"إجمالي السيارات":"Total cars"} value={allCars.length} tone="blue"/>
      <Stat icon={<CheckCircle2/>} label={ar?"السيارات المتاحة":"Available"} value={available} tone="green"/>
      <Stat icon={<Activity/>} label={ar?"السيارات المؤجرة":"Rented"} value={rented} tone="purple"/>
      <Stat icon={<Users/>} label={ar?"العملاء":"Customers"} value={allCustomers.length} tone="orange"/>
     </div>
     <div className="stats-grid money-grid"><Stat icon={<CircleDollarSign/>} label={ar?"إجمالي المقبوضات (تجريبي)":"Receipts (demo)"} value={money(totalIncome)+" ₪"} tone="green"/><Stat icon={<Wallet/>} label={ar?"إجمالي المصروفات (تجريبي)":"Payments (demo)"} value={money(totalExpense)+" ₪"} tone="orange"/></div>
     <div className="dashboard-grid"><div className="panel"><div className="panel-head"><div><h3>{ar?"حالة الأسطول":"Fleet status"}</h3><p>{ar?"توزيع السيارات حسب الحالة":"Vehicles by current status"}</p></div><CarFront/></div><div className="fleet-row"><span>{ar?"متاحة":"Available"}</span><div className="bar"><i style={{width:(allCars.length?available/allCars.length*100:0)+"%"}}/></div><b>{available}</b></div><div className="fleet-row"><span>{ar?"مؤجرة":"Rented"}</span><div className="bar purple"><i style={{width:(allCars.length?rented/allCars.length*100:0)+"%"}}/></div><b>{rented}</b></div><div className="fleet-row"><span>{ar?"صيانة":"Maintenance"}</span><div className="bar orange"><i style={{width:(allCars.length?allCars.filter(x=>["صيانة","Maintenance"].includes(x.status)).length/allCars.length*100:0)+"%"}}/></div><b>{allCars.filter(x=>["صيانة","Maintenance"].includes(x.status)).length}</b></div></div>
      <div className="panel"><div className="panel-head"><div><h3>{ar?"الوصول السريع":"Quick access"}</h3><p>{ar?"انتقل إلى القسم المطلوب":"Open a workspace"}</p></div><Globe2/></div><div className="quick-grid">{SECTIONS.slice(1).map(s=>{const Icon=s[3];return <button key={s[0]} onClick={()=>setSection(s[0])}><Icon size={19}/><span>{title(s)}</span></button>})}</div></div></div>
     <div className="panel tip-panel"><div className="tip-icon"><AlertTriangle/></div><div><b>{ar?"تنبيه مهم قبل التشغيل الفعلي":"Important before live operation"}</b><p>{ar?"هذه نسخة أولية ببيانات تجريبية محفوظة على المتصفح. لا ترفع هويات العملاء أو العقود أو أي بيانات حقيقية قبل إعداد قاعدة البيانات الخاصة وتسجيل الدخول والصلاحيات والنسخ الاحتياطي.":"This starter currently stores demo data in this browser. Do not enter real IDs, contracts, or sensitive customer data until private database, authentication, access controls, and backups are configured."}</p></div></div>
    </>:<><div className="page-heading"><div><span className="eyebrow">{ar?"إدارة العمليات":"OPERATIONS"}</span><h2>{sectionLabel}</h2><p>{ar?"إضافة ومراجعة بيانات القسم":"Add and review records in this workspace"}</p></div><button className="primary-btn" onClick={()=>{setForm({});setShowForm(true)}}><Plus size={18}/>{ar?"إضافة سجل":"Add record"}</button></div>
      <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?"ابحث في السجلات...":"Search records..."}/></div><span className="record-count">{filtered.length} {ar?"سجل":"records"}</span></div>
      {showForm&&<div className="panel form-panel"><div className="panel-head"><h3>{ar?"إضافة سجل جديد":"Add new record"}</h3><button className="icon-btn" onClick={()=>setShowForm(false)}><X/></button></div><form onSubmit={addRow}><div className="form-grid">{(FIELDS[section]||[]).map((f,i)=><label key={f}>{ar?(LABELS[section]||[])[i]:f.replaceAll("_"," ")}<input required={i===0} value={form[f]||""} onChange={e=>setForm({...form,[f]:e.target.value})} placeholder={ar?"أدخل البيانات":"Enter value"}/></label>)}</div><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setShowForm(false)}>{ar?"إلغاء":"Cancel"}</button><button className="primary-btn" type="submit">{ar?"حفظ السجل":"Save record"}</button></div></form></div>}
      <div className="panel table-panel">{filtered.length? <div className="table-wrap"><table><thead><tr>{(FIELDS[section]||[]).map((f,i)=><th key={f}>{ar?(LABELS[section]||[])[i]:f.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}>{(FIELDS[section]||[]).map(f=><td key={f}>{r[f]||"—"}</td>)}</tr>)}</tbody></table></div>:<div className="empty"><div className="empty-icon"><ActiveIcon size={26}/></div><b>{ar?"لا توجد سجلات حتى الآن":"No records yet"}</b><p>{ar?"ابدأ بإضافة أول سجل لهذا القسم":"Add the first record to this section"}</p><button className="primary-btn" onClick={()=>setShowForm(true)}><Plus size={17}/>{ar?"إضافة سجل":"Add record"}</button></div>}</div>
    </>}
    <footer>© {new Date().getFullYear()} ARKAN CO. – RENT A CAR <span>{ar?"نسخة أولية للتطوير":"Development starter"}</span></footer>
   </div>
  </section>
 </main>;
}
function Stat({icon,label,value,tone}:{icon:any,label:string,value:any,tone:string}){return <div className="stat-card"><div className={"stat-icon "+tone}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>}
