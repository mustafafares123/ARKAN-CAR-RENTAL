 "use client";
import { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { LayoutDashboard, CarFront, Users, CalendarDays, FileText, Wallet, Wrench, MapPin, AlertTriangle, Languages, Plus, Search, Menu, X, LogOut, Settings, Bell, Globe2, CircleDollarSign, Activity, CheckCircle2, Pencil, Trash2, ImagePlus } from "lucide-react";

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
 cars:["رقم السيارة","اللوحة","الماركة","الموديل","السنة","الحالة","السعر اليومي","اللون","ناقل الحركة","نوع الوقود"],
 customers:["اسم العميل","رقم الهاتف","رقم الهوية","البريد الإلكتروني","تاريخ الميلاد","تاريخ إصدار الرخصة","تاريخ انتهاء الرخصة"],
 bookings:["اسم العميل","السيارة / اللوحة","من تاريخ","إلى تاريخ","الحالة"],
 contracts:["رقم العقد","اسم العميل","السيارة / اللوحة","بداية العقد","نهاية العقد","الإجمالي"],
 cash:["التاريخ","نوع الحركة","البيان","المبلغ","العملة","رقم العقد"],
 maintenance:["التاريخ","السيارة / اللوحة","نوع الصيانة","الوصف","التكلفة"],
 trackers:["السيارة / اللوحة","رقم الجهاز","مزود الخدمة","حالة الاتصال","آخر تحديث"],
 fines:["تاريخ المخالفة","السيارة / اللوحة","رقم العقد","نوع المخالفة","المبلغ","حالة التحقق","حالة التحصيل"]
};
const FIELDS: Record<string,string[]> = {
 cars:["car_number","plate","make","model","year","status","daily_rate","color","transmission","fuel_type"],
 customers:["full_name","phone","identity_no","email","date_of_birth","license_issue_date","license_expiry_date"],
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
 const [form,setForm]=useState<Record<string,string>>({}), [notice,setNotice]=useState(""), [mobileOpen,setMobileOpen]=useState(false), [editingId,setEditingId]=useState<string|null>(null);
 const [client,setClient]=useState<SupabaseClient|null>(null), [cloud,setCloud]=useState(false), [loading,setLoading]=useState(false), [sessionReady,setSessionReady]=useState(false), [localLoaded,setLocalLoaded]=useState(false), [companyId,setCompanyId]=useState<string|null>(null), [email,setEmail]=useState(""), [password,setPassword]=useState("");
 const ar=lang==="ar"; const active=SECTIONS.find(s=>s[0]===section)!; const ActiveIcon=active[3];
 useEffect(()=>{
  try{const saved=localStorage.getItem("arkan-data-v1");if(saved)setRows({...initial,...JSON.parse(saved)});}catch(e){}finally{setLocalLoaded(true);}
  if(!envReady){setSessionReady(true);return;}
  const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  setClient(sb);setCloud(true);
  sb.auth.getSession().then(({data})=>{if(data.session)void connectCloud(sb);else setSessionReady(true);});
  const {data:{subscription}}=sb.auth.onAuthStateChange((_event,session)=>{if(session)void connectCloud(sb);else{setCompanyId(null);setSessionReady(true);}});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(localLoaded&&!companyId){try{localStorage.setItem("arkan-data-v1",JSON.stringify(rows));}catch(e){}}},[rows,companyId,localLoaded]);
 const allCars=rows.cars||[], allCustomers=rows.customers||[];
 const totalIncome=(rows.cash||[]).filter(x=>x.kind==="قبض"||x.kind==="Receipt").reduce((a,x)=>a+Number(x.amount||0),0);
 const totalExpense=(rows.cash||[]).filter(x=>x.kind==="صرف"||x.kind==="Payment").reduce((a,x)=>a+Number(x.amount||0),0);
 const available=allCars.filter(x=>["متاحة","Available"].includes(x.status)).length;
 const rented=allCars.filter(x=>["مؤجرة","Rented"].includes(x.status)).length;
 const title=(s:any)=>ar?s[1]:s[2];
 const data=rows[section]||[];
 const filtered=data.filter(r=>Object.values(r).join(" ").toLowerCase().includes(query.toLowerCase()));
 async function addRow(e:any){e.preventDefault();
  if(section==="customers"){
   const today=new Date();const birth=new Date(form.date_of_birth+"T00:00:00");const issue=new Date(form.license_issue_date+"T00:00:00");const expiry=new Date(form.license_expiry_date+"T00:00:00");
   const age=today.getFullYear()-birth.getFullYear()-((today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate()))?1:0);
   const tenure=today.getFullYear()-issue.getFullYear()-((today.getMonth()<issue.getMonth()||(today.getMonth()===issue.getMonth()&&today.getDate()<issue.getDate()))?1:0);
   if(!form.identity_front||!form.identity_back){setNotice(ar?"صورة الهوية الأمامية والخلفية إلزامية.":"Both front and back ID images are required.");return;}
   if(!form.date_of_birth||age<24){setNotice(ar?"مرفوض: يجب أن يكون عمر العميل 24 سنة على الأقل.":"Rejected: customer must be at least 24 years old.");return;}
   if(!form.license_issue_date||tenure<2||(tenure===2&&today.getMonth()===issue.getMonth()&&today.getDate()<=issue.getDate())){setNotice(ar?"مرفوض: يجب أن يكون قد مضى أكثر من سنتين على إصدار الرخصة.":"Rejected: driving licence must have been held for more than two years.");return;}
   if(!form.license_expiry_date||expiry<today||expiry<=issue){setNotice(ar?"الرخصة منتهية أو تاريخها غير صحيح.":"Licence is expired or dates are invalid.");return;}
   if(client&&companyId){setLoading(true);try{const id=editingId||crypto.randomUUID();const paths:any={};for(const [key,prefix] of [["identity_front","identity-front"],["identity_back","identity-back"],["license_image","license"]]){if(form[key]?.startsWith("data:")){const blob=await(await fetch(form[key])).blob();const p=`${companyId}/customers/${id}/${prefix}-${Date.now()}`;const {error}=await client.storage.from("arkan-private").upload(p,blob,{contentType:blob.type,upsert:true});if(error)throw error;paths[key+"_path"]=p;}else if(form[key+"_path"])paths[key+"_path"]=form[key+"_path"];}
    const payload:any={company_id:companyId,full_name:form.full_name,phone:form.phone,identity_no:form.identity_no,email:form.email||null,date_of_birth:form.date_of_birth,license_issue_date:form.license_issue_date,license_expiry_date:form.license_expiry_date,identity_front_path:paths.identity_front_path,identity_back_path:paths.identity_back_path,license_image_path:paths.license_image_path};
    const result=editingId?await client.from("customers").update(payload).eq("id",id).eq("company_id",companyId):await client.from("customers").insert(payload);if(result.error)throw result.error;
    const {data,error}=await client.from("customers").select("*").eq("company_id",companyId).order("created_at",{ascending:false});if(error)throw error;setRows(old=>({...old,customers:data||[]}));setNotice(ar?"تم حفظ ملف العميل السحابي بعد اجتياز الشروط.":"Customer saved to cloud after passing eligibility checks.");
   }catch(err:any){setNotice((ar?"تعذر حفظ العميل: ":"Customer save failed: ")+(err?.message||""));}finally{setLoading(false);}}
   else{const id=editingId||crypto.randomUUID();setRows(old=>({...old,customers:editingId?(old.customers||[]).map(x=>x.id===id?{...x,...form}:x):[{id,...form},...(old.customers||[])]}));setNotice(ar?"تم حفظ ملف العميل محلياً.":"Customer saved locally.");}
   setForm({});setEditingId(null);setShowForm(false);return;
  }
  if(section==="cars"&&client&&companyId){
   setLoading(true);try{const id=editingId||crypto.randomUUID();let image_path=form.image_path||null;
    if(form.image_url?.startsWith("data:image/")){const blob=await(await fetch(form.image_url)).blob();const photoPath=`${companyId}/cars/${id}/${Date.now()}.jpg`;const {error:uploadError}=await client.storage.from("arkan-private").upload(photoPath,blob,{contentType:"image/jpeg",upsert:true});if(uploadError)throw uploadError;image_path=photoPath;}
    const payload:any={company_id:companyId,car_number:form.car_number||null,plate:form.plate,make:form.make||null,model:form.model||null,year:form.year?Number(form.year):null,status:form.status||"available",daily_rate:form.daily_rate?Number(form.daily_rate):0,color:form.color||null,transmission:form.transmission||null,fuel_type:form.fuel_type||null,image_path};
    const result=editingId?await client.from("cars").update(payload).eq("id",id).eq("company_id",companyId):await client.from("cars").insert(payload);if(result.error)throw result.error;
    const {data:cars,error}=await client.from("cars").select("*").eq("company_id",companyId).order("created_at",{ascending:false});if(error)throw error;
    const mapped=await Promise.all((cars||[]).map(async(car:any)=>{let image_url="";if(car.image_path){const {data}=await client!.storage.from("arkan-private").createSignedUrl(car.image_path,3600);image_url=data?.signedUrl||"";}return {...car,image_url,year:car.year==null?"":String(car.year),daily_rate:String(car.daily_rate??"")};}));
    setRows(old=>({...old,cars:mapped}));setNotice(ar?"تم حفظ السيارة في قاعدة البيانات السحابية.":"Car saved to cloud database.");
   }catch(err:any){setNotice((ar?"فشل حفظ السيارة: ":"Could not save car: ")+(err?.message||"Unknown error"));}finally{setLoading(false);}
  }else{if(editingId)setRows(old=>({...old,[section]:(old[section]||[]).map(r=>r.id===editingId?{...r,...form}:r)}));else{const id=crypto.randomUUID();setRows(old=>({...old,[section]:[{id,...form},...(old[section]||[])]}));}setNotice(ar?"تم حفظ السجل محلياً":"Record saved locally");}
  setForm({});setEditingId(null);setShowForm(false);
 }
 function startEdit(r:Row){setEditingId(r.id);setForm(Object.fromEntries((FIELDS[section]||[]).map(k=>[k,String(r[k]??"")]).concat([["image_url",String(r.image_url??"")],["image_path",String(r.image_path??"")],["identity_front_path",String(r.identity_front_path??"")],["identity_back_path",String(r.identity_back_path??"")],["license_image_path",String(r.license_image_path??"")]])));setShowForm(true);}
 async function deleteRow(r:Row){if(!window.confirm(ar?"هل أنت متأكد من حذف هذه السيارة؟ لا يمكن التراجع عن الحذف.":"Delete this car? This cannot be undone."))return;
  if(section==="cars"&&client&&companyId){setLoading(true);try{const {error}=await client.from("cars").delete().eq("id",r.id).eq("company_id",companyId);if(error)throw error;if(r.image_path)await client.storage.from("arkan-private").remove([r.image_path]);setRows(old=>({...old,cars:(old.cars||[]).filter(x=>x.id!==r.id)}));setNotice(ar?"تم حذف السيارة من السحابة.":"Car deleted from cloud.");}catch(e:any){setNotice((ar?"تعذر الحذف: ":"Delete failed: ")+(e?.message||""));}finally{setLoading(false);}}
  else{setRows(old=>({...old,[section]:(old[section]||[]).filter(x=>x.id!==r.id)}));setNotice(ar?"تم حذف السجل محلياً":"Record deleted locally");}
 }
 function handleDocument(e:any,key:string){const file=e.target.files?.[0];if(!file)return;if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)){setNotice(ar?"نوع الملف غير مدعوم.":"Unsupported file type.");return;}if(file.size>8*1024*1024){setNotice(ar?"الملف أكبر من 8 ميغابايت.":"File exceeds 8 MB.");return;}const reader=new FileReader();reader.onload=()=>setForm(old=>({...old,[key]:String(reader.result)}));reader.readAsDataURL(file);}
 function handleCarImage(e:any){const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){setNotice(ar?"يرجى اختيار ملف صورة صالح":"Choose a valid image file");return;}if(file.size>8*1024*1024){setNotice(ar?"حجم الصورة كبير. اختر صورة أقل من 8 ميغابايت":"Image is too large. Choose a file under 8 MB");return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(img,0,0,canvas.width,canvas.height);setForm(old=>({...old,image_url:canvas.toDataURL("image/jpeg",0.78)}));};img.src=String(reader.result);};reader.readAsDataURL(file);}
 async function connectCloud(sb:SupabaseClient){
  setLoading(true);
  try{
   const {data:company,error:companyError}=await sb.rpc("create_or_get_my_company",{company_name:"ARKAN CO. – RENT A CAR"});
   if(companyError)throw companyError;if(!company)throw new Error("Company setup returned no ID");
   setCompanyId(company);
   const {data:cars,error}=await sb.from("cars").select("*").eq("company_id",company).order("created_at",{ascending:false});if(error)throw error;
   const mapped=await Promise.all((cars||[]).map(async(car:any)=>{let image_url="";if(car.image_path){const {data}=await sb.storage.from("arkan-private").createSignedUrl(car.image_path,3600);image_url=data?.signedUrl||"";}return {...car,image_url,year:car.year==null?"":String(car.year),daily_rate:String(car.daily_rate??"")};}));
   const {data:customers,error:customerError}=await sb.from("customers").select("*").eq("company_id",company).order("created_at",{ascending:false});if(customerError)throw customerError;
   const customersSigned=await Promise.all((customers||[]).map(async(c:any)=>{const signed:any={...c};for(const [field,path] of [["identity_front_url","identity_front_path"],["identity_back_url","identity_back_path"],["license_image_url","license_image_path"]])if(c[path]){const {data}=await sb.storage.from("arkan-private").createSignedUrl(c[path],3600);signed[field]=data?.signedUrl||"";}return signed;}));
   setRows(old=>({...old,cars:mapped,customers:customersSigned}));setNotice(ar?"تم الاتصال بقاعدة البيانات السحابية وتحميل السيارات.":"Connected to cloud database and loaded vehicles.");
  }catch(e:any){setCompanyId(null);setNotice(ar?"تعذر إعداد السحابة. شغّل ملف supabase/cloud_cars.sql وتحقق من تسجيل الدخول. ":"Cloud setup failed. Run supabase/cloud_cars.sql and verify sign-in. "+(e?.message||""));}
  finally{setLoading(false);setSessionReady(true);}
 }
 async function signIn(){if(!client)return;setLoading(true);const {error}=await client.auth.signInWithPassword({email,password});if(error)setNotice(error.message);setLoading(false);}
 async function signUp(){if(!client)return;setLoading(true);const {data,error}=await client.auth.signUp({email,password});if(error)setNotice(error.message);else if(!data.session)setNotice(ar?"تم إنشاء الحساب. افحص بريدك لتأكيده ثم سجّل الدخول.":"Account created. Check your email to confirm, then sign in.");setLoading(false);}
 async function signOut(){if(!client)return;await client.auth.signOut();setCompanyId(null);setRows(old=>({...old,cars:initial.cars}));}
 async function importLocalCars(){if(!client||!companyId)return;setLoading(true);try{
  const saved=localStorage.getItem("arkan-data-v1");const localRows=saved?JSON.parse(saved).cars||[]:[];
  if(!localRows.length){setNotice(ar?"لا توجد سيارات محفوظة محلياً لاستيرادها.":"No locally saved vehicles to import.");return;}
  const {data:existing,error:readError}=await client.from("cars").select("plate").eq("company_id",companyId);if(readError)throw readError;
  const plates=new Set((existing||[]).map((x:any)=>x.plate));
  let imported=0;
  for(const car of localRows){if(!car.plate||plates.has(car.plate))continue;let image_path=null;
   if(car.image_url?.startsWith("data:image/")){const blob=await(await fetch(car.image_url)).blob();image_path=`${companyId}/cars/${crypto.randomUUID()}/${Date.now()}.jpg`;const {error}=await client.storage.from("arkan-private").upload(image_path,blob,{contentType:"image/jpeg",upsert:true});if(error)throw error;}
   const payload:any={company_id:companyId,car_number:car.car_number||null,plate:car.plate,make:car.make||null,model:car.model||null,year:car.year?Number(car.year):null,status:car.status||"available",daily_rate:car.daily_rate?Number(car.daily_rate):0,color:car.color||null,transmission:car.transmission||null,fuel_type:car.fuel_type||null,image_path};
   const {error}=await client.from("cars").insert(payload);if(error)throw error;plates.add(car.plate);imported++;
  }
  await connectCloud(client);setNotice(ar?`تم استيراد ${imported} سيارة من هذا الجهاز إلى السحابة.`:`Imported ${imported} local cars to the cloud.`);
 }catch(e:any){setNotice((ar?"فشل الاستيراد: ":"Import failed: ")+(e?.message||""));}finally{setLoading(false);}}

 if(envReady&&!sessionReady)return <main className="app" dir="rtl"><div className="auth-gate"><div className="auth-card"><div className="brand-mark">A</div><h1>ARKAN CO.</h1><p>{ar?"جارٍ الاتصال بقاعدة بيانات أركان...":"Connecting to ARKAN cloud..."}</p></div></div></main>;
 if(envReady&&!companyId)return <main className="app" dir="rtl"><div className="auth-gate"><div className="auth-card"><div className="brand-mark">A</div><h1>ARKAN CO.</h1><p>{ar?"سجّل الدخول لمزامنة سيارات الشركة وصورها بين الأجهزة.":"Sign in to sync company vehicles and photos across devices."}</p><label>{ar?"البريد الإلكتروني":"Email"}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><label>{ar?"كلمة المرور":"Password"}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><button className="primary-btn" disabled={loading||!email||password.length<6} onClick={signIn}>{ar?"تسجيل الدخول":"Sign in"}</button><button className="secondary-btn" disabled={loading||!email||password.length<6} onClick={signUp}>{ar?"إنشاء حساب جديد":"Create account"}</button>{notice&&<p className="auth-notice">{notice}</p>}<small>{ar?"يجب تشغيل إعداد قاعدة البيانات السحابية أولاً.":"Cloud database setup must be applied first."}</small></div></div></main>;
 const nav=<>{SECTIONS.map(s=>{const Icon=s[3];return <button key={s[0]} className={"nav-item "+(section===s[0]?"selected":"")} onClick={()=>{setSection(s[0]);setQuery("");setMobileOpen(false)}}><Icon size={18}/><span>{title(s)}</span></button>})}</>;
 const sectionLabel=title(active);
 return <main className={ar?"app rtl":"app ltr"} dir={ar?"rtl":"ltr"}>
  <aside className={"sidebar "+(mobileOpen?"open":"")}><div className="brand"><div className="brand-mark">A</div><div><b>ARKAN CO.</b><small>RENT A CAR</small></div><button className="close-mobile" onClick={()=>setMobileOpen(false)}><X/></button></div>
   <div className="company-tag">{ar?"نظام إدارة تأجير السيارات":"Car Rental Management"}</div><nav>{nav}</nav>
   <div className="sidebar-bottom"><div className="cloud-state"><span className={cloud?"dot amber":"dot"}></span><div><b>{cloud?(ar?"إعداد السحابة موجود":"Cloud configured"):(ar?"وضع تجريبي محلي":"Local demo mode")}</b><small>{ar?"حالة التخزين":"Storage status"}</small></div></div><button className="nav-item" onClick={()=>setNotice(ar?"الإعدادات ستضاف في المرحلة التالية":"Settings will be added in the next phase")}><Settings size={18}/>{ar?"الإعدادات":"Settings"}</button>{companyId&&<button className="nav-item" onClick={signOut}><LogOut size={18}/>{ar?"تسجيل الخروج":"Sign out"}</button>}</div>
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
    </>:<><div className="page-heading"><div><span className="eyebrow">{ar?"إدارة العمليات":"OPERATIONS"}</span><h2>{sectionLabel}</h2><p>{ar?"إضافة ومراجعة بيانات القسم":"Add and review records in this workspace"}</p></div>{section==="cars"&&companyId&&<button className="secondary-btn" disabled={loading} onClick={importLocalCars}>{ar?"استيراد سيارات هذا الجهاز":"Import this device’s cars"}</button>}<button className="primary-btn" onClick={()=>{setForm({});setEditingId(null);setShowForm(true)}}><Plus size={18}/>{ar?"إضافة سجل":"Add record"}</button></div>
      <div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?"ابحث في السجلات...":"Search records..."}/></div><span className="record-count">{filtered.length} {ar?"سجل":"records"}</span></div>
      {showForm&&<div className="panel form-panel"><div className="panel-head"><h3>{editingId?(ar?"تعديل بيانات السيارة":"Edit car details"):(ar?"إضافة سجل جديد":"Add new record")}</h3><button className="icon-btn" onClick={()=>setShowForm(false)}><X/></button></div><form onSubmit={addRow}><div className="form-grid">{(FIELDS[section]||[]).map((f,i)=><label key={f}>{ar?(LABELS[section]||[])[i]:f.replaceAll("_"," ")}<input type={["date_of_birth","license_issue_date","license_expiry_date","start_date","end_date"].includes(f)?"date":"text"} required={section==="customers"?true:i===0} value={form[f]||""} onChange={e=>setForm({...form,[f]:e.target.value})} placeholder={ar?"أدخل البيانات":"Enter value"}/></label>)}</div>{section==="customers"&&<div className="customer-documents"><div className="form-grid"><label>{ar?"صورة الهوية – الوجه الأمامي (إلزامي)":"ID front (required)"}<input type="file" accept="image/*,.pdf" onChange={e=>handleDocument(e,"identity_front")}/>{form.identity_front&&<small>{ar?"تم اختيار الملف":"File selected"}</small>}</label><label>{ar?"صورة الهوية – الوجه الخلفي (إلزامي)":"ID back (required)"}<input type="file" accept="image/*,.pdf" onChange={e=>handleDocument(e,"identity_back")}/>{form.identity_back&&<small>{ar?"تم اختيار الملف":"File selected"}</small>}</label><label>{ar?"صورة رخصة القيادة (اختياري)":"Driving licence image (optional)"}<input type="file" accept="image/*,.pdf" onChange={e=>handleDocument(e,"license_image")}/>{form.license_image&&<small>{ar?"تم اختيار الملف":"File selected"}</small>}</label></div><p>{ar?"التحقق من العمر ومدة الرخصة يتم تلقائياً قبل الحفظ.":"Age and licence tenure are automatically checked before saving."}</p></div>}{section==="cars"&&<div className="car-image-field"><label>{ar?"صورة السيارة":"Car photo"}<span className="image-help">{ar?"اختر صورة من جهازك (حتى 8 ميغابايت)":"Choose an image from your device (up to 8 MB)"}</span><input type="file" accept="image/*" onChange={handleCarImage}/></label>{form.image_url&&<div className="image-preview"><img src={form.image_url} alt="Car preview"/><button type="button" className="secondary-btn" onClick={()=>setForm(old=>({...old,image_url:""}))}>{ar?"إزالة الصورة":"Remove photo"}</button></div>}</div>}<div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>{setShowForm(false);setEditingId(null);setForm({})}}>{ar?"إلغاء":"Cancel"}</button><button className="primary-btn" type="submit">{editingId?(ar?"حفظ التعديلات":"Save changes"):(ar?"حفظ السجل":"Save record")}</button></div></form></div>}
      <div className="panel table-panel">{filtered.length? <div className="table-wrap"><table><thead><tr>{section==="cars"&&<th>{ar?"الصورة":"Photo"}</th>}{(FIELDS[section]||[]).map((f,i)=><th key={f}>{ar?(LABELS[section]||[])[i]:f.replaceAll("_"," ")}</th>)}{section==="cars"&&<th>{ar?"الإجراءات":"Actions"}</th>}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}>{section==="cars"&&<td>{r.image_url?<img className="car-thumb" src={r.image_url} alt={`${r.make||""} ${r.model||""}`}/>:<div className="car-thumb-placeholder"><CarFront size={20}/></div>}</td>}{(FIELDS[section]||[]).map(f=><td key={f}>{r[f]||"—"}</td>)}{section==="cars"&&<td><div className="row-actions"><button type="button" className="row-action edit" onClick={()=>startEdit(r)} title={ar?"تعديل":"Edit"}><Pencil size={15}/>{ar?"تعديل":"Edit"}</button><button type="button" className="row-action delete" onClick={()=>deleteRow(r)} title={ar?"حذف":"Delete"}><Trash2 size={15}/>{ar?"حذف":"Delete"}</button></div></td>}</tr>)}</tbody></table></div>:<div className="empty"><div className="empty-icon"><ActiveIcon size={26}/></div><b>{ar?"لا توجد سجلات حتى الآن":"No records yet"}</b><p>{ar?"ابدأ بإضافة أول سجل لهذا القسم":"Add the first record to this section"}</p><button className="primary-btn" onClick={()=>setShowForm(true)}><Plus size={17}/>{ar?"إضافة سجل":"Add record"}</button></div>}</div>
    </>}
    <footer>© {new Date().getFullYear()} ARKAN CO. – RENT A CAR <span>{ar?"نسخة أولية للتطوير":"Development starter"}</span></footer>
   </div>
  </section>
 </main>;
}
function Stat({icon,label,value,tone}:{icon:any,label:string,value:any,tone:string}){return <div className="stat-card"><div className={"stat-icon "+tone}>{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>}
