"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CarFront, UserRound, CalendarDays, LogOut, Languages, ShieldCheck, LockKeyhole, Menu, X } from "lucide-react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://blknmrmibgklnfqycxnq.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_kRGYnQJ4LY5bdtcfPy3Agw_G6U4hSyv";

type Car = {id:string;make:string|null;model:string|null;year:number|null;plate:string|null;daily_rate:number;currency:string;status:string;image_url:string;color:string|null;transmission:string|null;fuel_type:string|null;seats:number|null};

export default function CustomerPortal(){
 const [sb,setSb]=useState<SupabaseClient|null>(null);
 const [session,setSession]=useState<any>(null);
 const [cars,setCars]=useState<Car[]>([]);
 const [status,setStatus]=useState("not_linked");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(true);
 const [notice,setNotice]=useState("");
 const [lang,setLang]=useState<"ar"|"en">("ar");
 const [tab,setTab]=useState<"cars"|"bookings"|"profile">("cars");
 const ar=lang==="ar";
 useEffect(()=>{
  const client=createClient(URL,KEY);setSb(client);
  client.auth.getSession().then(({data})=>{setSession(data.session);setBusy(false);});
  const {data:{subscription}}=client.auth.onAuthStateChange((_e,s)=>{setSession(s);});
  client.rpc("customer_portal_catalog").then(({data,error})=>{if(error)setNotice(ar?"تعذر تحميل السيارات حالياً.":"Could not load vehicles.");else setCars(data||[]);});
  return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{if(session&&sb)sb.rpc("customer_portal_my_status").then(({data,error})=>{if(!error&&data)setStatus(data);});},[session,sb]);
 async function auth(mode:"in"|"up"){
  if(!sb)return;setBusy(true);setNotice("");
  const result=mode==="in"?await sb.auth.signInWithPassword({email,password}):await sb.auth.signUp({email,password});
  if(result.error)setNotice(result.error.message);
  else if(mode==="up"&&!result.data.session)setNotice(ar?"أنشأنا الحساب. افحص بريدك لتأكيده ثم سجّل الدخول.":"Account created. Check your email to confirm, then sign in.");
  setBusy(false);
 }
 async function refreshCars(){if(!sb)return;const {data,error}=await sb.rpc("customer_portal_catalog");if(error)setNotice(error.message);else setCars(data||[]);}
 async function signOut(){await sb?.auth.signOut();setStatus("not_linked");setTab("cars");}
 const label=(a:string,b:string)=>ar?a:b;
 return <main dir={ar?"rtl":"ltr"} style={{minHeight:"100vh",background:"#f4f6fa",color:"#1d2939",fontFamily:"'IBM Plex Sans Arabic',Inter,sans-serif"}}>
  <style>{`
   .cp-wrap{max-width:1180px;margin:auto;padding:22px}.cp-top{background:#14253d;color:white;border-radius:18px;padding:20px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.cp-brand{display:flex;align-items:center;gap:12px}.cp-mark{width:46px;height:46px;border:1px solid #c9a45c;color:#c9a45c;border-radius:12px;display:grid;place-items:center;font:800 25px Inter}.cp-top button,.cp-btn{border:0;border-radius:10px;padding:11px 15px;cursor:pointer;font:600 14px inherit}.cp-ghost{background:#ffffff18;color:white}.cp-primary{background:#c9a45c;color:#14253d}.cp-nav{display:flex;gap:9px;margin:20px 0;flex-wrap:wrap}.cp-nav button{border:1px solid #e1e6ed;background:white;border-radius:10px;padding:11px 15px;color:#526174;cursor:pointer}.cp-nav button.active{background:#14253d;color:white;border-color:#14253d}.cp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:16px}.cp-card{background:white;border:1px solid #e7ebf0;border-radius:16px;overflow:hidden}.cp-photo{height:160px;background:linear-gradient(135deg,#e7ebf0,#f8f9fb);display:grid;place-items:center;color:#7b8796}.cp-photo img{width:100%;height:100%;object-fit:cover}.cp-cardbody{padding:16px}.cp-price{color:#9b7837;font-size:20px;font-weight:800}.cp-muted{color:#778496;font-size:13px}.cp-panel{background:white;border:1px solid #e7ebf0;border-radius:16px;padding:22px}.cp-input{display:block;width:100%;padding:12px;border:1px solid #d9e0e8;border-radius:9px;margin:7px 0 14px;font:inherit}.cp-notice{background:#fff8e9;border:1px solid #ead8ad;border-radius:10px;padding:12px;margin:14px 0}.cp-lock{background:#f7f8fa;border:1px dashed #cbd3dd;border-radius:13px;padding:18px;margin-top:16px}.cp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}@media(max-width:600px){.cp-wrap{padding:12px}.cp-top{padding:16px}.cp-top h1{font-size:19px}}
  `}</style>
  <div className="cp-wrap">
   <header className="cp-top"><div className="cp-brand"><div className="cp-mark">A</div><div><div style={{fontWeight:800,letterSpacing:1}}>ARKAN CO.</div><small style={{color:"#cbd4df",letterSpacing:2}}>RENT A CAR · CUSTOMER</small></div></div><div className="cp-row"><button className="cp-ghost" onClick={()=>setLang(ar?"en":"ar")}><Languages size={15} style={{verticalAlign:"middle"}}/> {ar?"English":"العربية"}</button>{session&&<button className="cp-ghost" onClick={signOut}><LogOut size={15} style={{verticalAlign:"middle"}}/> {label("تسجيل الخروج","Sign out")}</button>}</div></header>
   <section style={{padding:"26px 4px 12px"}}><div className="cp-muted" style={{letterSpacing:2}}>WELCOME TO ARKAN</div><h1 style={{fontSize:28,margin:"7px 0"}}>{label("استكشف أسطول سياراتنا","Explore our fleet")}</h1><p className="cp-muted">{label("اختر السيارة المناسبة وتعرّف على المواصفات والأسعار.","Find the right car and review its details and rates.")}</p></section>
   {notice&&<div className="cp-notice">{notice}</div>}
   {!session?<div className="cp-panel" style={{maxWidth:520,marginBottom:22}}><h2>{label("دخول العميل","Customer sign in")}</h2><p className="cp-muted">{label("سجّل الدخول أو أنشئ حساباً لاستكمال ملفك ومتابعة طلباتك.","Sign in or create an account to complete your profile and follow requests.")}</p><label>{label("البريد الإلكتروني","Email")}<input className="cp-input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>{label("كلمة المرور","Password")}<input className="cp-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="cp-row"><button className="cp-btn cp-primary" disabled={busy||!email||password.length<6} onClick={()=>auth("in")}>{label("تسجيل الدخول","Sign in")}</button><button className="cp-btn" style={{background:"#eef1f5"}} disabled={busy||!email||password.length<6} onClick={()=>auth("up")}>{label("إنشاء حساب","Create account")}</button></div></div>:<div className="cp-panel" style={{marginBottom:22}}><div className="cp-row"><div><b>{label("مرحباً بك في حسابك","Welcome to your account")}</b><div className="cp-muted">{session.user.email}</div></div><span className="cp-muted">{status==="approved"?label("الملف معتمد","Profile approved"):status==="pending"?label("بانتظار مراجعة الإدارة","Pending admin review"):label("الحساب غير مربوط بملف عميل","Not linked to a customer record")}</span></div><div className="cp-lock"><div className="cp-row"><div><b><LockKeyhole size={17} style={{verticalAlign:"middle"}}/> {label("تثبيت الحجز غير متاح حالياً","Booking confirmation is currently locked")}</b><p className="cp-muted">{label("سيتم فتح الحجز بعد ربط حسابك بملف العميل واعتماد بيانات الهوية والرخصة من الإدارة.","Booking unlocks only after your account is linked to a customer record and your identity and driving-licence details are approved by the company.")}</p></div><ShieldCheck size={28} color="#b18b42"/></div></div></div>}
   <nav className="cp-nav"><button className={tab==="cars"?"active":""} onClick={()=>setTab("cars")}><CarFront size={16} style={{verticalAlign:"middle"}}/> {label("السيارات","Vehicles")}</button><button className={tab==="bookings"?"active":""} onClick={()=>setTab("bookings")}><CalendarDays size={16} style={{verticalAlign:"middle"}}/> {label("حجوزاتي","My bookings")}</button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserRound size={16} style={{verticalAlign:"middle"}}/> {label("ملفي الشخصي","My profile")}</button></nav>
   {tab==="cars"&&<><div className="cp-grid">{cars.map(car=><article className="cp-card" key={car.id}><div className="cp-photo">{car.image_url?<img src={car.image_url} alt={`${car.make||""} ${car.model||""}`}/>:<CarFront size={42}/>}</div><div className="cp-cardbody"><div className="cp-row"><b style={{fontSize:17}}>{car.make||"Vehicle"} {car.model||""}</b><span className="cp-muted">{car.year||""}</span></div><p className="cp-muted">{[car.color,car.transmission,car.fuel_type,car.seats?car.seats+" seats":null].filter(Boolean).join(" · ")||label("تفاصيل السيارة","Vehicle details")}</p><div className="cp-row"><div className="cp-price">{Number(car.daily_rate||0).toLocaleString("en-US")} ₪ <small className="cp-muted">{label("لليوم","/ day")}</small></div><span className="cp-muted">{label("متاحة","Available")}</span></div><button className="cp-btn" style={{width:"100%",marginTop:13,background:"#14253d",color:"white"}} disabled={!session||status!=="approved"} onClick={()=>setNotice(label("الحجز متاح بعد اكتمال ربط الملف واعتماده.","Booking is available after your account is linked and approved."))}>{label("احجز هذه السيارة","Book this car")}</button></div></article>)}</div>{cars.length===0&&<div className="cp-panel cp-muted">{label("لا توجد سيارات متاحة للعرض حالياً.","No vehicles are currently listed as available.")}</div>}</>}
   {tab==="bookings"&&<div className="cp-panel"><h3>{label("حجوزاتي","My bookings")}</h3><p className="cp-muted">{label("ستظهر طلباتك وحجوزاتك هنا بعد ربط حسابك بملف العميل. لا يمكن تثبيت أي حجز قبل اعتماد الإدارة.","Your requests and bookings will appear here after your account is linked. Booking confirmation remains disabled until admin approval.")}</p></div>}
   {tab==="profile"&&<div className="cp-panel"><h3>{label("ملفي الشخصي","My profile")}</h3><p className="cp-muted">{label("حالة الربط: ","Link status: ")}{status==="approved"?label("معتمد","Approved"):status==="pending"?label("قيد المراجعة","Under review"):label("غير مربوط","Not linked")}</p><p className="cp-muted">{label("لأمان بياناتك، يتم ربط حسابك بملف العميل من قبل إدارة ARKAN فقط.","For your security, ARKAN staff must link your account to the correct customer record.")}</p></div>}
   <footer className="cp-muted" style={{textAlign:"center",padding:28}}>© {new Date().getFullYear()} ARKAN CO. – RENT A CAR</footer>
  </div>
 </main>;
}
