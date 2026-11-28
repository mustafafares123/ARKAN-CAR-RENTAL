"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  CarFront, UserRound, CalendarDays, LogOut, Languages, ShieldCheck,
  LockKeyhole, Menu, X, Fuel, Settings2, Users, ArrowUpRight, CheckCircle2,
  Clock3, KeyRound, Sparkles, RefreshCw, Search, ArrowDownWideNarrow,
  Heart, SlidersHorizontal, Eye, EyeOff
} from "lucide-react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://blknmrmibgklnfqycxnq.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_kRGYnQJ4LY5bdtcfPy3Agw_G6U4hSyv";

type Car = {
  id: string; make: string | null; model: string | null; year: number | null;
  plate: string | null; daily_rate: number; currency: string; status: string;
  image_url: string; image_path: string | null; gallery_paths: string[]; gallery_urls: string[];
  company_id: string; color: string | null; transmission: string | null;
  fuel_type: string | null; seats: number | null;
};

export default function CustomerPortal() {
  const [sb, setSb] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [status, setStatus] = useState("not_linked");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [tab, setTab] = useState<"cars" | "bookings" | "profile">("cars");
  const [carSearch, setCarSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"recommended" | "price-low" | "price-high">("recommended");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [requestType, setRequestType] = useState<"booking" | "inquiry">("booking");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const ar = lang === "ar";

  useEffect(() => {
    const client = createClient(URL, KEY);
    setSb(client);
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBusy(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    void loadCatalog(client);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("arkan-customer-favorites");
      if (saved) setFavorites(JSON.parse(saved).filter((value: unknown) => typeof value === "string"));
    } catch { /* Ignore unavailable or malformed local preferences. */ }
    setFavoritesReady(true);
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    try { window.localStorage.setItem("arkan-customer-favorites", JSON.stringify(favorites)); }
    catch { /* Favorites remain available for this session if storage is blocked. */ }
  }, [favorites, favoritesReady]);

  useEffect(() => {
    if (session && sb) {
      sb.rpc("customer_portal_my_status").then(({ data, error }) => {
        if (!error && data) setStatus(data);
      });
      void loadMyRequests(sb);
    } else {
      setMyRequests([]);
    }
  }, [session, sb]);

  async function loadCatalog(client: SupabaseClient) {
    setCatalogBusy(true);
    const { data, error } = await client.rpc("customer_portal_catalog");
    if (error) {
      setNotice("تعذر تحميل السيارات حالياً. حاول تحديث القائمة بعد قليل.");
    } else {
      const catalog = await Promise.all(((data || []) as Car[]).map(async (car) => {
        const paths = Array.from(new Set([...(car.gallery_paths || []), car.image_path].filter((path): path is string => Boolean(path))));
        const signed = await Promise.all(paths.map(async (path) => {
          const { data: file, error: imageError } = await client.storage.from("arkan-private").createSignedUrl(path, 3600);
          return imageError ? null : file?.signedUrl || null;
        }));
        const gallery_urls = signed.filter((url): url is string => Boolean(url));
        return { ...car, gallery_urls, image_url: gallery_urls[0] || car.image_url || "" };
      }));
      setCars(catalog);
    }
    setCatalogBusy(false);
  }

  async function loadMyRequests(client: SupabaseClient) {
    const { data, error } = await client.from("customer_portal_requests")
      .select("id,car_id,request_type,status,start_date,end_date,message,created_at,customer_name")
      .order("created_at", { ascending: false });
    if (!error) setMyRequests(data || []);
  }

  function openVehicleRequest(car: Car, type: "booking" | "inquiry") {
    if (!session) {
      setNotice(label("سجّل الدخول أولاً لإرسال طلب حجز أو استفسار. يمكنك تصفح السيارات دون تسجيل الدخول.", "Sign in first to send a booking request or enquiry. You can browse the fleet without signing in."));
      return;
    }
    setNotice("");
    setSelectedCar(car);
    setRequestType(type);
    setStartDate("");
    setEndDate("");
    setRequestMessage("");
    setCustomerName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || "");
    setCustomerPhone(session.user.user_metadata?.phone || "");
  }

  async function submitVehicleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sb || !session || !selectedCar) return;
    setRequestBusy(true);
    const { error } = await sb.from("customer_portal_requests").insert({
      company_id: selectedCar.company_id,
      car_id: selectedCar.id,
      user_id: session.user.id,
      request_type: requestType,
      customer_name: customerName.trim(),
      phone: customerPhone.trim(),
      start_date: requestType === "booking" ? startDate : null,
      end_date: requestType === "booking" ? endDate : null,
      message: requestMessage.trim()
    });
    if (error) {
      setNotice(label("تعذر إرسال الطلب. تأكد من البيانات وحاول مرة أخرى.", "We could not send your request. Check the details and try again."));
    } else {
      setSelectedCar(null);
      setNotice(label("تم إرسال طلبك إلى فريق أركان بنجاح. هذا طلب مبدئي وليس حجزاً مؤكداً، وسيتواصل معك الفريق بعد المراجعة.", "Your request was sent to ARKAN. This is a request, not a confirmed booking; our team will contact you after review."));
      await loadMyRequests(sb);
      setTab("bookings");
    }
    setRequestBusy(false);
  }

  async function auth(mode: "in" | "up") {
    if (!sb) return;
    setBusy(true);
    setNotice("");
    const result = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });
    if (result.error) setNotice(result.error.message);
    else if (mode === "up" && !result.data.session) {
      setNotice(ar ? "تم إنشاء الحساب. افحص بريدك لتأكيده ثم سجّل الدخول." : "Account created. Check your email to confirm, then sign in.");
    }
    setBusy(false);
  }

  async function resetPassword() {
    if (!sb || !email.trim()) {
      setNotice(label("أدخل بريدك الإلكتروني أولاً لإرسال رابط استعادة كلمة المرور.","Enter your email first so we can send a password reset link."));
      return;
    }
    setBusy(true);
    setNotice("");
    const { error } = await sb.auth.resetPasswordForEmail(email.trim());
    setNotice(error ? error.message : label("إذا كان البريد مسجلاً، فسيصلك رابط استعادة كلمة المرور. افحص صندوق الوارد والرسائل غير المرغوب فيها.","If this email is registered, a password reset link will arrive shortly. Check your inbox and spam folder."));
    setBusy(false);
  }

  async function refreshCars() {
    if (sb) {
      setNotice("");
      await loadCatalog(sb);
    }
  }

  async function signOut() {
    await sb?.auth.signOut();
    setStatus("not_linked");
    setTab("cars");
  }

  const label = (arabic: string, english: string) => ar ? arabic : english;
  const linked = status === "approved";
  const pending = status === "pending";
  const visibleCars = cars
    .filter((car) => [car.make, car.model, car.year, car.color, car.transmission, car.fuel_type]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(carSearch.trim().toLocaleLowerCase()))
    .filter((car) => fuelFilter === "all" || car.fuel_type === fuelFilter)
    .filter((car) => transmissionFilter === "all" || car.transmission === transmissionFilter)
    .filter((car) => !favoritesOnly || favorites.includes(car.id))
    .sort((a, b) => sortOrder === "price-low" ? Number(a.daily_rate) - Number(b.daily_rate)
      : sortOrder === "price-high" ? Number(b.daily_rate) - Number(a.daily_rate) : 0);

  const fuelOptions = Array.from(new Set(cars.map((car) => car.fuel_type).filter(Boolean))) as string[];
  const transmissionOptions = Array.from(new Set(cars.map((car) => car.transmission).filter(Boolean))) as string[];
  const resetFilters = () => { setCarSearch(""); setFuelFilter("all"); setTransmissionFilter("all"); setSortOrder("recommended"); setFavoritesOnly(false); };
  const toggleFavorite = (carId: string) => setFavorites((current) => current.includes(carId)
    ? current.filter((id) => id !== carId) : [...current, carId]);

  return (
    <main dir={ar ? "rtl" : "ltr"} className="portal">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .portal{min-height:100vh;background:#f4f6fa;color:#1d2939;font-family:'IBM Plex Sans Arabic',Inter,sans-serif}
        .cp-shell{max-width:1240px;margin:auto;padding:26px 28px 38px}
        .cp-header{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 26px;border-radius:22px;background:linear-gradient(115deg,#101d30 0%,#1d3555 68%,#263e5d 100%);color:#fff;box-shadow:0 14px 36px #14253d20}
        .cp-header:after{content:"";position:absolute;width:270px;height:270px;border:1px solid #c9a45c35;border-radius:50%;inset-inline-end:-80px;top:-150px;box-shadow:0 0 0 28px #c9a45c0b,0 0 0 58px #c9a45c08;pointer-events:none}
        .cp-brand{display:flex;align-items:center;gap:13px;position:relative;z-index:1}
        .cp-mark{width:48px;height:48px;border:1px solid #c9a45c;border-radius:14px;display:grid;place-items:center;color:#d8b873;font:900 27px Inter;box-shadow:inset 0 0 18px #c9a45c18}
        .cp-brand-name{font:800 16px Inter;letter-spacing:1.4px}.cp-brand-sub{display:block;color:#c7d0dc;font:600 9px Inter;letter-spacing:2.5px;margin-top:5px}
        .cp-actions{display:flex;gap:9px;align-items:center;position:relative;z-index:1}
        .cp-btn{border:0;border-radius:11px;padding:11px 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font:600 13px inherit;transition:transform .18s,background .18s}
        .cp-btn:hover:not(:disabled){transform:translateY(-1px)}.cp-btn:disabled{opacity:.48;cursor:not-allowed}
        .cp-ghost{background:#ffffff13;color:#fff;border:1px solid #ffffff25}.cp-gold{background:#c9a45c;color:#14253d}.cp-dark{background:#14253d;color:#fff}.cp-soft{background:#f0f3f7;color:#40516a}
        .cp-hero{padding:34px 4px 25px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
        .cp-kicker{display:flex;align-items:center;gap:7px;color:#a17d3d;font:700 10px Inter;letter-spacing:2px}
        .cp-hero h1{font-size:clamp(25px,3vw,35px);line-height:1.3;margin:9px 0 8px;color:#172b45;font-weight:800}
        .cp-hero p{margin:0;color:#778496;font-size:14px;max-width:610px;line-height:1.9}
        .cp-hero-art{display:flex;align-items:center;gap:10px;color:#9a783f;background:#fff;border:1px solid #eee6d6;border-radius:14px;padding:13px 16px;white-space:nowrap;font-size:12px;font-weight:600}
        .cp-notice{display:flex;gap:10px;align-items:flex-start;background:#fff8e9;border:1px solid #ead8ad;color:#735b2c;border-radius:13px;padding:13px 15px;margin:0 0 18px;font-size:13px}
        .cp-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
        .cp-main{min-width:0}.cp-side{display:grid;gap:14px}
        .cp-panel{background:#fff;border:1px solid #e7ebf0;border-radius:18px;padding:21px;box-shadow:0 5px 18px #14253d08}
        .cp-panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}
        .cp-panel-title h2,.cp-panel-title h3{margin:0;font-size:17px;color:#1c304b}
        .cp-muted{color:#7b8797;font-size:12px;line-height:1.8}
        .cp-nav{display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap}
        .cp-nav button{border:1px solid #e1e6ed;background:#fff;border-radius:11px;padding:11px 15px;color:#657286;display:flex;align-items:center;gap:8px;cursor:pointer;font:600 13px inherit;transition:.18s}
        .cp-nav button.active{background:#14253d;color:white;border-color:#14253d;box-shadow:0 5px 12px #14253d20}
        .cp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:15px}
        .cp-card{background:#fff;border:1px solid #e7ebf0;border-radius:17px;overflow:hidden;transition:transform .2s,box-shadow .2s}
        .cp-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px #14253d12}
        .cp-photo{height:174px;background:linear-gradient(135deg,#e9edf2,#f7f8fa);display:grid;place-items:center;color:#9ba8b8;position:relative;overflow:hidden}
        .cp-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#14253d12,transparent 50%);pointer-events:none}
        .cp-photo img{width:100%;height:100%;object-fit:cover}
        .cp-photo-label{position:absolute;top:12px;inset-inline-start:12px;background:#fff;color:#47795e;border:1px solid #d9eadf;border-radius:20px;padding:5px 9px;font-size:10px;font-weight:700;z-index:1}
        .cp-cardbody{padding:16px}
        .cp-car-title{font-size:17px;font-weight:800;color:#20344f}
        .cp-year{background:#f1f4f8;color:#718096;border-radius:7px;padding:4px 7px;font:700 11px Inter}
        .cp-specs{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0 15px}
        .cp-spec{display:inline-flex;align-items:center;gap:5px;background:#f6f8fa;border-radius:7px;padding:6px 8px;color:#667589;font-size:10px}
        .cp-price{font:800 22px Inter;color:#9b7837;letter-spacing:-.5px}.cp-price small{font:500 11px 'IBM Plex Sans Arabic',sans-serif;color:#8792a1;letter-spacing:0}
        .cp-divider{height:1px;background:#edf0f4;margin:14px 0}
        .cp-field{display:block;color:#59677a;font-size:12px;font-weight:600;margin:12px 0}
        .cp-input{display:block;width:100%;padding:12px 13px;border:1px solid #dfe5ec;border-radius:10px;margin-top:7px;background:#fbfcfd;color:#26364b;font:500 13px inherit;outline:none}
        .cp-input:focus{border-color:#c9a45c;box-shadow:0 0 0 3px #c9a45c20}
        .cp-auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}
        .cp-status{display:flex;align-items:center;gap:8px;border-radius:11px;padding:10px 12px;font-size:12px;font-weight:700}
        .cp-status.ok{background:#eaf6ef;color:#367752}.cp-status.wait{background:#fff7e8;color:#916b26}.cp-status.off{background:#f2f4f7;color:#697789}
        .cp-lock{border:1px dashed #d6dce4;border-radius:13px;background:#f8f9fb;padding:15px;margin-top:14px}
        .cp-lock strong{display:flex;align-items:center;gap:7px;color:#33445b;font-size:13px}
        .cp-lock p{margin:8px 0 0}
        .cp-feature{display:flex;gap:11px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f0f2f5}
        .cp-feature:last-child{border:0;padding-bottom:0}
        .cp-feature-icon{width:34px;height:34px;flex:0 0 34px;border-radius:10px;background:#f6f1e7;color:#a17d3d;display:grid;place-items:center}
        .cp-feature b{display:block;color:#34445a;font-size:12px;margin-bottom:3px}
        .cp-empty{padding:42px 20px;text-align:center}.cp-empty-icon{width:58px;height:58px;border-radius:17px;background:#f0f3f7;color:#8290a2;display:grid;place-items:center;margin:0 auto 13px}
        .cp-footer{text-align:center;color:#9aa4b1;font-size:11px;padding:28px 0 4px}
        @media(max-width:950px){.cp-layout{grid-template-columns:1fr}.cp-side{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){.cp-shell{padding:12px}.cp-header{padding:16px;border-radius:16px}.cp-mark{width:42px;height:42px}.cp-brand-name{font-size:14px}.cp-brand-sub{font-size:8px;letter-spacing:1.7px}.cp-actions{gap:6px}.cp-actions .cp-btn{padding:9px 10px;font-size:11px}.cp-hero{padding:25px 3px 18px;display:block}.cp-hero h1{font-size:25px}.cp-hero-art{display:inline-flex;margin-top:15px}.cp-panel{padding:16px}.cp-side{grid-template-columns:1fr}.cp-grid{grid-template-columns:1fr}.cp-photo{height:190px}.cp-auth-actions{grid-template-columns:1fr}}
      `}</style>

      <div className="cp-shell">
        <header className="cp-header">
          <div className="cp-brand">
            <div className="cp-mark">A</div>
            <div><div className="cp-brand-name">ARKAN CO.</div><small className="cp-brand-sub">RENT A CAR · CUSTOMER EXPERIENCE</small></div>
          </div>
          <div className="cp-actions">
            <button className="cp-btn cp-ghost" onClick={() => setLang(ar ? "en" : "ar")}><Languages size={15}/>{ar ? "English" : "العربية"}</button>
            {session && <button className="cp-btn cp-ghost" onClick={signOut}><LogOut size={15}/>{label("خروج","Sign out")}</button>}
          </div>
        </header>

        <section className="cp-hero cp-hero-premium">
          {cars[0]?.image_url && <div className="cp-hero-vehicle"><img src={cars[0].image_url} alt="" aria-hidden="true"/></div>}
          <div className="cp-hero-copy">
            <div className="cp-kicker"><Sparkles size={14}/>{label("تجربة أركان للعملاء","THE ARKAN CUSTOMER EXPERIENCE")}</div>
            <h1>{label("مرحباً بك في أركان","Welcome to ARKAN")}<br/>{label("رحلتك تبدأ من هنا.","Your journey starts here.")}</h1>
            <p>{label("اكتشف أسطول سياراتنا، قارن المواصفات والأسعار، وتابع طلباتك من مساحة واحدة مصممة لراحتك.", "Explore our fleet, compare vehicle details and daily rates, and manage your requests in one place.")}</p>
            <div className="cp-hero-actions">
              <a className="cp-btn cp-gold" href="#cp-fleet"><CarFront size={16}/>{label("استكشف سياراتنا","Explore our fleet")}</a>
              <a className="cp-btn cp-hero-link" href="#cp-account"><UserRound size={16}/>{label("حسابي","My account")}</a>
            </div>
          </div>
          <div className="cp-hero-art"><ShieldCheck size={19}/>{label("خدمة موثوقة وآمنة","Trusted & secure service")}</div>
        </section>
        <section className="cp-quick-stats" aria-label={label("ملخص البوابة","Portal overview")}>
          <article><span className="cp-stat-icon"><CarFront size={19}/></span><div><b>{cars.length}</b><small>{label("سيارة في الأسطول","Fleet vehicles")}</small></div></article>
          <article><span className="cp-stat-icon"><Heart size={19}/></span><div><b>{favorites.length}</b><small>{label("سيارات مفضلة","Saved favorites")}</small></div></article>
          <article><span className="cp-stat-icon"><ShieldCheck size={19}/></span><div><b>{linked ? label("معتمد","Approved") : pending ? label("قيد المراجعة","In review") : label("بحاجة للربط","Needs linking")}</b><small>{label("حالة ملف العميل","Customer profile")}</small></div></article>
        </section>

        {notice && <div className="cp-notice"><LockKeyhole size={17}/><span>{notice}</span></div>}

        <div className="cp-layout">
          <section className="cp-main">
            <nav className="cp-nav">
              <button className={tab === "cars" ? "active" : ""} onClick={() => setTab("cars")}><CarFront size={16}/>{label("أسطول السيارات","Our fleet")}</button>
              <button className={tab === "bookings" ? "active" : ""} onClick={() => setTab("bookings")}><CalendarDays size={16}/>{label("حجوزاتي","My bookings")}</button>
              <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><UserRound size={16}/>{label("ملفي الشخصي","My profile")}</button>
            </nav>

            {tab === "cars" && <>
              <div className="cp-panel-title" id="cp-fleet">
                <div><h2>{label("اختر سيارتك القادمة","Find your next car")}</h2><div className="cp-muted">{label("اختر ما يناسب رحلتك من أسطولنا.","Find the right vehicle for your next trip.")}</div></div>
                <button className="cp-btn cp-soft" onClick={refreshCars} disabled={catalogBusy}><RefreshCw size={14}/>{label("تحديث","Refresh")}</button>
              </div>
              <div className="cp-fleet-tools">
                <label className="cp-searchbox">
                  <Search size={17} aria-hidden="true"/>
                  <input value={carSearch} onChange={(event) => setCarSearch(event.target.value)} placeholder={label("ابحث عن الماركة أو الموديل أو المواصفات...","Search make, model or features...")} aria-label={label("ابحث في السيارات","Search vehicles")}/>
                  {carSearch && <button type="button" onClick={() => setCarSearch("")} aria-label={label("مسح البحث","Clear search")}><X size={15}/></button>}
                </label>
                <label className="cp-sortbox">
                  <ArrowDownWideNarrow size={16} aria-hidden="true"/>
                  <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)} aria-label={label("ترتيب السيارات","Sort vehicles")}>
                    <option value="recommended">{label("الترتيب الافتراضي","Recommended")}</option>
                    <option value="price-low">{label("السعر: من الأقل","Price: low to high")}</option>
                    <option value="price-high">{label("السعر: من الأعلى","Price: high to low")}</option>
                  </select>
                </label>
                <label className="cp-filterbox">
                  <SlidersHorizontal size={15}/>
                  <select value={fuelFilter} onChange={(event) => setFuelFilter(event.target.value)} aria-label={label("تصفية حسب الوقود","Filter by fuel")}>
                    <option value="all">{label("كل أنواع الوقود","All fuel types")}</option>
                    {fuelOptions.map((fuel) => <option key={fuel} value={fuel}>{fuel}</option>)}
                  </select>
                </label>
                <label className="cp-filterbox">
                  <Settings2 size={15}/>
                  <select value={transmissionFilter} onChange={(event) => setTransmissionFilter(event.target.value)} aria-label={label("تصفية حسب ناقل الحركة","Filter by transmission")}>
                    <option value="all">{label("كل نواقل الحركة","All transmissions")}</option>
                    {transmissionOptions.map((transmission) => <option key={transmission} value={transmission}>{transmission}</option>)}
                  </select>
                </label>
                <button type="button" className={favoritesOnly ? "cp-favorites-filter active" : "cp-favorites-filter"} onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}><Heart size={14} fill={favoritesOnly ? "currentColor" : "none"}/>{label("المفضلة","Favorites")} ({favorites.length})</button>
                <span className="cp-results-count">{label("عرض","Showing")} <b>{visibleCars.length}</b> {label("من","of")} <b>{cars.length}</b></span>
                {(carSearch || fuelFilter !== "all" || transmissionFilter !== "all" || sortOrder !== "recommended" || favoritesOnly) &&
                  <button className="cp-clear-filters" onClick={resetFilters}>{label("مسح الفلاتر","Clear filters")}</button>}
              </div>
              {catalogBusy ? <div className="cp-panel cp-empty"><div className="cp-empty-icon"><RefreshCw size={24}/></div><b>{label("جارٍ تحميل السيارات","Loading vehicles")}</b><p className="cp-muted">{label("لحظات ونجهز لك الأسطول المتاح.","Getting the available fleet ready.")}</p></div>
              : cars.length === 0 ? <div className="cp-panel cp-empty"><div className="cp-empty-icon"><CarFront size={27}/></div><b>{label("لا توجد سيارات متاحة للعرض حالياً","No vehicles available right now")}</b><p className="cp-muted">{label("يرجى المحاولة لاحقاً أو التواصل مع فريق أركان.","Please check again later or contact the ARKAN team.")}</p></div>
              : visibleCars.length === 0 ? <div className="cp-panel cp-empty"><div className="cp-empty-icon"><Search size={25}/></div><b>{favoritesOnly && favorites.length === 0 ? label("لم تضف سيارات إلى المفضلة بعد","No saved favorites yet") : label("لم نعثر على سيارة بهذه المواصفات","No vehicles match your search")}</b><p className="cp-muted">{favoritesOnly && favorites.length === 0 ? label("اضغط على رمز القلب في بطاقة أي سيارة لإضافتها إلى قائمتك.","Tap the heart on any vehicle card to save it here.") : label("جرّب تعديل البحث أو الفلاتر لعرض المزيد من السيارات.","Adjust your search or filters to see more vehicles.")}</p><button className="cp-btn cp-soft" onClick={resetFilters}>{label("عرض جميع السيارات","Show all vehicles")}</button></div>
              : <div className="cp-grid">{visibleCars.map(car => <article className="cp-card" key={car.id}>
                  <div className="cp-photo">
                    <button type="button" className={favorites.includes(car.id) ? "cp-favorite active" : "cp-favorite"} onClick={() => toggleFavorite(car.id)} aria-label={favorites.includes(car.id) ? label("إزالة من المفضلة","Remove from favorites") : label("إضافة إلى المفضلة","Add to favorites")} aria-pressed={favorites.includes(car.id)}><Heart size={17} fill={favorites.includes(car.id) ? "currentColor" : "none"}/></button>
                    {car.image_url ? <img src={car.image_url} alt={`${car.make || ""} ${car.model || ""}`} loading="lazy"/> : <CarFront size={55} strokeWidth={1.2}/>}
                    <span className="cp-photo-label">{label("متاحة الآن","Available")}</span>
                  </div>
                  {car.gallery_urls.length > 1 && <div className="cp-photo-thumbs">{car.gallery_urls.slice(1, 5).map((url, index) => <img key={url} src={url} alt={label(`صورة إضافية ${index + 1}`, `Additional view ${index + 1}`)} loading="lazy" />)}</div>}
                  <div className="cp-cardbody">
                    <div className="cp-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <b className="cp-car-title">{car.make || label("سيارة","Vehicle")} {car.model || ""}</b><span className="cp-year">{car.year || "—"}</span>
                    </div>
                    <div className="cp-specs">
                      {car.color && <span className="cp-spec">{car.color}</span>}
                      {car.transmission && <span className="cp-spec"><Settings2 size={12}/>{car.transmission}</span>}
                      {car.fuel_type && <span className="cp-spec"><Fuel size={12}/>{car.fuel_type}</span>}
                      {car.seats && <span className="cp-spec"><Users size={12}/>{car.seats} {label("مقاعد","seats")}</span>}
                    </div>
                    <div className="cp-divider"/>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <div className="cp-price">{Number(car.daily_rate || 0).toLocaleString("en-US")} ₪ <small>{label(" / يوم"," / day")}</small></div>
                      <span className="cp-muted">{label("السعر اليومي","Daily rate")}</span>
                    </div>
                    <div className="cp-request-actions">
                      <button className="cp-btn cp-gold" type="button" onClick={() => openVehicleRequest(car, "booking")}>{label("اطلب حجزاً","Request booking")}<CalendarDays size={15}/></button>
                      <button className="cp-btn cp-dark" type="button" onClick={() => openVehicleRequest(car, "inquiry")}>{label("استفسار","Enquire")}<ArrowUpRight size={15}/></button>
                    </div>
                    {!session && <div className="cp-muted cp-card-hint">{label("سجّل الدخول لإرسال طلب حجز أو استفسار. تصفح السيارات متاح للجميع.","Sign in to send a booking request or enquiry. Browsing is open to everyone.")}</div>}
                    {session && !linked && <div className="cp-muted cp-card-hint">{label("يمكنك إرسال طلب الآن؛ تثبيت الحجز النهائي يتطلب ربط الحساب واعتماد الهوية والرخصة.","You can send a request now; final booking confirmation requires account linking and verified ID and licence.")}</div>}
                  </div>
                </article>)}</div>}
            </>}

            {tab === "bookings" && <div className="cp-panel"><div className="cp-panel-title"><h2>{label("حجوزاتي وطلباتي","My bookings & requests")}</h2><CalendarDays color="#b18b42"/></div>
              {!session ? <p className="cp-muted">{label("سجّل الدخول لمتابعة طلباتك.", "Sign in to follow your requests.")}</p> : myRequests.length === 0 ? <p className="cp-muted">{label("لا توجد طلبات حتى الآن. اختر سيارة وأرسل طلب حجز أو استفسار.", "No requests yet. Choose a vehicle and send a booking request or enquiry.")}</p> : <div className="cp-request-list">{myRequests.map((request) => { const car = cars.find((item) => item.id === request.car_id); return <article className="cp-request-item" key={request.id}><div><b>{car ? `${car.make || ""} ${car.model || ""}` : label("طلب سيارة","Vehicle request")}</b><small>{request.request_type === "booking" ? label("طلب حجز","Booking request") : label("استفسار","Enquiry")} · {new Date(request.created_at).toLocaleDateString(ar ? "ar" : "en")}</small>{request.start_date && <small>{request.start_date} – {request.end_date}</small>}</div><span className={`cp-request-status ${request.status}`}>{request.status === "pending" ? label("قيد المراجعة","Pending") : request.status}</span></article>; })}</div>}
              <p className="cp-muted" style={{marginTop:14}}>{label("طلبات الحجز لا تتحول إلى حجوزات مؤكدة إلا بعد مراجعة فريق أركان واعتماد ملف العميل.", "Booking requests become confirmed reservations only after ARKAN reviews them and approves your customer profile.")}</p>
            </div>}

            {tab === "profile" && <div className="cp-panel"><div className="cp-panel-title"><h2>{label("حالة ملف العميل","Customer profile status")}</h2><UserRound color="#b18b42"/></div><div className={`cp-status ${linked ? "ok" : pending ? "wait" : "off"}`}>{linked ? <CheckCircle2 size={16}/> : pending ? <Clock3 size={16}/> : <LockKeyhole size={16}/>} {linked ? label("تم اعتماد الملف","Profile approved") : pending ? label("الملف قيد مراجعة الإدارة","Under admin review") : label("الحساب غير مربوط بملف عميل","Account not linked")}</div><div className="cp-lock"><strong><ShieldCheck size={17}/>{label("حماية بياناتك","Your data is protected")}</strong><p className="cp-muted">{label("لضمان الخصوصية، تقوم إدارة أركان بربط الحساب بسجل العميل الصحيح ومراجعة بيانات الهوية ورخصة القيادة قبل تفعيل الحجز.","For your privacy, ARKAN staff link your account to the correct customer record and verify identity and driving-licence details before enabling bookings.")}</p></div></div>}
          </section>

          <aside className="cp-side">
            {!session ? <div className="cp-panel" id="cp-account">
              <div className="cp-panel-title"><div><h3>{label("مرحباً بك في أركان","Welcome to ARKAN")}</h3><div className="cp-muted">{label("ادخل إلى حسابك لمتابعة طلباتك.","Sign in to follow your requests.")}</div></div><KeyRound color="#b18b42"/></div>
              <label className="cp-field">{label("البريد الإلكتروني","Email address")}<input className="cp-input" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)}/></label>
              <label className="cp-field">{label("كلمة المرور","Password")}<span className="cp-password-wrap"><input className="cp-input" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="cp-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? label("إخفاء كلمة المرور","Hide password") : label("إظهار كلمة المرور","Show password")}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
              <div className="cp-auth-actions">
                <button className="cp-btn cp-gold" disabled={busy || !email || password.length < 6} onClick={() => auth("in")}>{label("تسجيل الدخول","Sign in")}</button>
                <button className="cp-btn cp-soft" disabled={busy || !email || password.length < 6} onClick={() => auth("up")}>{label("إنشاء حساب","Create account")}</button>
              </div>
              <button type="button" className="cp-text-link" onClick={resetPassword} disabled={busy || !email.trim()}>{label("نسيت كلمة المرور؟","Forgot password?")}</button>
              <p className="cp-muted" style={{marginBottom:0}}>{label("كلمة المرور يجب أن تكون 6 أحرف على الأقل.","Password must contain at least 6 characters.")}</p>
            </div> : <div className="cp-panel">
              <div className="cp-panel-title"><h3>{label("حسابك في أركان","Your ARKAN account")}</h3><UserRound color="#b18b42"/></div>
              <b style={{fontSize:13,overflowWrap:"anywhere"}}>{session.user.email}</b>
              <div style={{marginTop:13}} className={`cp-status ${linked ? "ok" : pending ? "wait" : "off"}`}>{linked ? <CheckCircle2 size={15}/> : pending ? <Clock3 size={15}/> : <LockKeyhole size={15}/>} {linked ? label("ملف معتمد","Approved") : pending ? label("قيد المراجعة","Pending review") : label("غير مربوط","Not linked")}</div>
              <div className="cp-lock"><strong><LockKeyhole size={16}/>{label("الحجز محمي","Booking is protected")}</strong><p className="cp-muted">{label("لن تتمكن من تأكيد الحجز قبل ربط حسابك بملف العميل واعتماد الهوية والرخصة.","Booking confirmation stays locked until your customer record, identity and licence are approved.")}</p></div>
            </div>}
            <div className="cp-panel">
              <div className="cp-panel-title"><h3>{label("لماذا أركان؟","The ARKAN promise")}</h3><Sparkles color="#b18b42"/></div>
              <div className="cp-feature"><div className="cp-feature-icon"><ShieldCheck size={17}/></div><div><b>{label("حجز موثوق","Trusted service")}</b><span className="cp-muted">{label("إجراءات واضحة ومراجعة آمنة للبيانات.","Clear steps and secure customer verification.")}</span></div></div>
              <div className="cp-feature"><div className="cp-feature-icon"><CarFront size={17}/></div><div><b>{label("أسطول متنوع","A fleet to choose from")}</b><span className="cp-muted">{label("مواصفات وأسعار السيارات في مكان واحد.","Vehicle details and rates in one place.")}</span></div></div>
              <div className="cp-feature"><div className="cp-feature-icon"><UserRound size={17}/></div><div><b>{label("حسابك تحت إدارتك","Your account")}</b><span className="cp-muted">{label("تابع حالة ملفك وطلباتك بسهولة.","Follow your profile and requests with ease.")}</span></div></div>
            </div>
          </aside>
        </div>
        {selectedCar && <div className="cp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCar(null); }}>
          <section className="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cp-request-title" dir={ar ? "rtl" : "ltr"}>
            <div className="cp-panel-title"><div><h2 id="cp-request-title">{requestType === "booking" ? label("طلب حجز سيارة","Request a vehicle booking") : label("استفسار عن السيارة","Vehicle enquiry")}</h2><div className="cp-muted">{selectedCar.make} {selectedCar.model} · {Number(selectedCar.daily_rate || 0).toLocaleString("en-US")} ₪ {label("لليوم","per day")}</div></div><button type="button" className="cp-modal-close" onClick={() => setSelectedCar(null)} aria-label={label("إغلاق","Close")}><X size={19}/></button></div>
            <form onSubmit={submitVehicleRequest}>
              <div className="cp-request-type"><button type="button" className={requestType === "booking" ? "active" : ""} onClick={() => setRequestType("booking")}>{label("طلب حجز","Booking request")}</button><button type="button" className={requestType === "inquiry" ? "active" : ""} onClick={() => setRequestType("inquiry")}>{label("استفسار","Enquiry")}</button></div>
              <label className="cp-field">{label("الاسم الكامل","Full name")}<input className="cp-input" required minLength={2} maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
              <label className="cp-field">{label("رقم الهاتف","Phone number")}<input className="cp-input" required minLength={5} maxLength={40} type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></label>
              {requestType === "booking" && <div className="cp-date-grid"><label className="cp-field">{label("تاريخ الاستلام","Pickup date")}<input className="cp-input" type="date" required min={new Date().toISOString().slice(0,10)} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="cp-field">{label("تاريخ الإرجاع","Return date")}<input className="cp-input" type="date" required min={startDate || new Date().toISOString().slice(0,10)} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>}
              <label className="cp-field">{label("رسالتك أو تفاصيل إضافية","Message or details")}<textarea className="cp-input cp-textarea" maxLength={2000} rows={4} value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder={label("اكتب سؤالك أو أي تفاصيل تساعدنا...","Write your question or any helpful details...")} /></label>
              <div className="cp-request-notice"><ShieldCheck size={17}/><span>{label("هذا طلب مبدئي فقط. لا يتم تأكيد الحجز قبل مراجعة الإدارة وربط حسابك بملف العميل واعتماد الهوية والرخصة.", "This is a preliminary request only. Booking is not confirmed until management reviews it and your customer profile, ID and licence are verified.")}</span></div>
              <div className="cp-request-actions"><button className="cp-btn cp-gold" type="submit" disabled={requestBusy || !customerName.trim() || !customerPhone.trim() || (requestType === "booking" && (!startDate || !endDate || endDate <= startDate))}>{requestBusy ? label("جارٍ الإرسال...","Sending...") : label("إرسال الطلب","Send request")}</button><button className="cp-btn cp-soft" type="button" onClick={() => setSelectedCar(null)}>{label("إلغاء","Cancel")}</button></div>
            </form>
          </section>
        </div>}
        <footer className="cp-footer">© {new Date().getFullYear()} ARKAN CO. · RENT A CAR</footer>
      </div>
    </main>
  );
}
