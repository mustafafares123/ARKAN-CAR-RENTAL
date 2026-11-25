"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://blknmrmibgklnfqycxnq.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_kRGYnQJ4LY5bdtcfPy3Agw_G6U4hSyv";

type PortalLink = { id: string; company_id: string; customer_id: string | null; status: "pending" | "approved" | "rejected" };
type PortalRecord = { id: string; section: string; record_data: Record<string, any>; created_at: string };

export default function CustomerPortalPage() {
  const [client] = useState<SupabaseClient>(() => createClient(SUPABASE_URL, SUPABASE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [companyId, setCompanyId] = useState("");
  const [link, setLink] = useState<PortalLink | null>(null);
  const [records, setRecords] = useState<PortalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const loadPortal = useCallback(async (currentUser: User, requestedCompany?: string) => {
    setLoading(true);
    try {
      let query = client.from("customer_portal_links")
        .select("id,company_id,customer_id,status")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (requestedCompany) query = query.eq("company_id", requestedCompany);
      const { data, error } = await query;
      if (error) throw error;
      const currentLink = (data || [])[0] as PortalLink | undefined;
      setLink(currentLink || null);
      if (currentLink?.status === "approved" && currentLink.customer_id) {
        const { data: ownRecords, error: recordsError } = await client
          .from("arkan_records")
          .select("id,section,record_data,created_at")
          .eq("company_id", currentLink.company_id)
          .in("section", ["bookings", "contracts"])
          .order("created_at", { ascending: false });
        if (recordsError) throw recordsError;
        setRecords((ownRecords || []) as PortalRecord[]);
      } else {
        setRecords([]);
      }
    } catch (error: any) {
      setNotice(error?.message || "تعذر تحميل بيانات البوابة.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    const requestedCompany = new URLSearchParams(window.location.search).get("company") || "";
    setCompanyId(requestedCompany);
    client.auth.getSession().then(({ data }) => {
      const currentUser = data.session?.user || null;
      setUser(currentUser);
      if (currentUser) void loadPortal(currentUser, requestedCompany || undefined);
      else setLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) void loadPortal(currentUser, requestedCompany || undefined);
      else { setLink(null); setRecords([]); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [client, loadPortal]);

  async function authenticate() {
    setLoading(true);
    setNotice("");
    const result = mode === "signin"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });
    if (result.error) setNotice(result.error.message);
    else if (mode === "signup" && !result.data.session) setNotice("تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.");
    setLoading(false);
  }

  async function requestLink() {
    if (!user || !companyId) return;
    setLoading(true);
    setNotice("");
    const { error } = await client.from("customer_portal_links").insert({
      company_id: companyId,
      user_id: user.id,
      customer_id: null,
      status: "pending"
    });
    if (error) setNotice(error.message);
    else {
      setNotice("تم إرسال طلب ربط الحساب. سيظهر ملفك بعد مراجعة الشركة واعتماد الربط.");
      await loadPortal(user, companyId);
    }
    setLoading(false);
  }

  async function signOut() {
    await client.auth.signOut();
    setUser(null);
    setLink(null);
    setRecords([]);
  }

  const bookings = records.filter((record) => record.section === "bookings");
  const contracts = records.filter((record) => record.section === "contracts");

  return (
    <main dir="rtl" className="portal-shell">
      <style jsx>{`
        *{box-sizing:border-box}.portal-shell{min-height:100vh;background:#f4f6fa;color:#1d2939;padding:32px 18px;font-family:'IBM Plex Sans Arabic',Arial,sans-serif}
        .portal-wrap{max-width:980px;margin:0 auto}.portal-brand{display:flex;align-items:center;gap:13px;margin-bottom:28px}
        .brand-mark{height:48px;width:48px;border:1px solid #c9a45c;color:#c9a45c;background:#14253d;display:grid;place-items:center;border-radius:12px;font:bold 25px Arial}
        .portal-brand b{display:block;color:#14253d;font:800 18px Arial;letter-spacing:1px}.portal-brand small{display:block;color:#7a8798;font:600 10px Arial;letter-spacing:2px;margin-top:4px}
        .portal-card,.portal-panel{background:#fff;border:1px solid #e8edf3;border-radius:15px;padding:24px;margin-bottom:16px;box-shadow:0 8px 24px #14253d08}
        h1{font-size:23px;margin:0 0 8px;color:#14253d}h2{font-size:17px;margin:0 0 12px;color:#14253d}p{line-height:1.8;color:#667085;margin:8px 0}
        label{display:block;font-size:13px;color:#475467;margin:14px 0}input{display:block;width:100%;margin-top:7px;border:1px solid #d8e0ea;border-radius:9px;padding:12px;font:inherit}
        button{border:0;border-radius:9px;padding:12px 18px;font:600 13px inherit;cursor:pointer}.primary{background:#14253d;color:#fff}.secondary{background:#f4f6fa;color:#344054;border:1px solid #e8edf3}
        button:disabled{opacity:.5;cursor:not-allowed}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.notice{background:#fff8e9;border:1px solid #f0dfb9;color:#755b27;border-radius:10px;padding:12px;margin-bottom:14px}
        .status{display:inline-block;border-radius:30px;background:#f3f4f6;padding:6px 12px;font-size:12px;color:#344054}.status.approved{background:#e7f7ef;color:#16724a}.status.pending{background:#fff4df;color:#936414}.status.rejected{background:#fdecec;color:#a52e2e}
        .table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:560px}th,td{text-align:right;padding:12px;border-bottom:1px solid #edf1f5;font-size:13px}th{color:#667085;font-weight:600;background:#fafbfc}
        .muted{font-size:12px;color:#7a8798}.empty{padding:18px;text-align:center;color:#7a8798}
        @media(max-width:600px){.portal-shell{padding:18px 12px}.portal-card,.portal-panel{padding:17px}h1{font-size:20px}}
      `}</style>
      <div className="portal-wrap">
        <div className="portal-brand"><div className="brand-mark">A</div><div><b>ARKAN CO.</b><small>RENT A CAR · CUSTOMER PORTAL</small></div></div>
        {notice && <div className="notice">{notice}</div>}
        {!user ? (
          <section className="portal-card">
            <h1>بوابة عملاء ARKAN</h1>
            <p>سجّل الدخول لمتابعة حجوزاتك وعقودك. استخدم رابط الدعوة الذي أرسلته لك الشركة لطلب ربط حسابك.</p>
            <label>البريد الإلكتروني<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <div className="actions">
              <button className="primary" disabled={loading || !email || password.length < 6} onClick={authenticate}>{mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}</button>
              <button className="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "إنشاء حساب جديد" : "لدي حساب بالفعل"}</button>
            </div>
            {!companyId && <p className="muted">لربط حسابك، افتح رابط الدعوة الخاص بفرع ARKAN أولاً.</p>}
          </section>
        ) : loading ? (
          <section className="portal-card"><h1>بوابة عملاء ARKAN</h1><p>جارٍ تحميل بيانات حسابك...</p></section>
        ) : !link ? (
          <section className="portal-card">
            <h1>ربط حساب العميل</h1>
            <p>حسابك لم يُربط بعد بملف عميل في ARKAN. أرسل طلب الربط وسيقوم موظفو الشركة بمراجعة بياناتك قبل تفعيل الوصول.</p>
            <div className="actions"><button className="primary" disabled={!companyId || loading} onClick={requestLink}>طلب ربط حسابي</button><button className="secondary" onClick={signOut}>تسجيل الخروج</button></div>
          </section>
        ) : link.status === "pending" ? (
          <section className="portal-card"><h1>طلبك قيد المراجعة</h1><span className="status pending">بانتظار اعتماد الشركة</span><p>لن تتمكن من إرسال أو تأكيد حجز قبل ربط الحساب بملف العميل والتحقق من اكتمال البيانات.</p><div className="actions"><button className="secondary" onClick={signOut}>تسجيل الخروج</button></div></section>
        ) : link.status === "rejected" ? (
          <section className="portal-card"><h1>لم تتم الموافقة على الربط</h1><span className="status rejected">مرفوض</span><p>يرجى التواصل مع ARKAN لتصحيح بيانات الحساب ثم إعادة تقديم الطلب من رابط الدعوة.</p><div className="actions"><button className="secondary" onClick={signOut}>تسجيل الخروج</button></div></section>
        ) : (
          <>
            <section className="portal-card">
              <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}><div><h1>مرحباً بك في بوابة ARKAN</h1><p>تم اعتماد ربط حسابك بملف العميل.</p></div><span className="status approved">حساب معتمد</span></div>
              <div className="actions"><button className="secondary" onClick={() => user && void loadPortal(user, link.company_id)}>تحديث البيانات</button><button className="secondary" onClick={signOut}>تسجيل الخروج</button></div>
            </section>
            <section className="portal-panel"><h2>حجوزاتي</h2><div className="table-wrap"><table><thead><tr><th>السيارة</th><th>من تاريخ</th><th>إلى تاريخ</th><th>الحالة</th></tr></thead><tbody>{bookings.length ? bookings.map((record) => <tr key={record.id}><td>{record.record_data.car_label || "—"}</td><td>{record.record_data.start_date || "—"}</td><td>{record.record_data.end_date || "—"}</td><td>{record.record_data.status || "قيد المراجعة"}</td></tr>) : <tr><td colSpan={4} className="empty">لا توجد حجوزات مرتبطة بحسابك حتى الآن.</td></tr>}</tbody></table></div></section>
            <section className="portal-panel"><h2>عقودي</h2><div className="table-wrap"><table><thead><tr><th>رقم العقد</th><th>السيارة</th><th>بداية العقد</th><th>نهاية العقد</th><th>الإجمالي</th></tr></thead><tbody>{contracts.length ? contracts.map((record) => <tr key={record.id}><td>{record.record_data.contract_no || "—"}</td><td>{record.record_data.car_label || "—"}</td><td>{record.record_data.start_date || "—"}</td><td>{record.record_data.end_date || "—"}</td><td>{record.record_data.total_amount || "—"} {record.record_data.currency || "ILS"}</td></tr>) : <tr><td colSpan={5} className="empty">لا توجد عقود مرتبطة بحسابك حتى الآن.</td></tr>}</tbody></table></div></section>
            <section className="portal-card"><h2>الحجز الإلكتروني</h2><p>زر الحجز سيبقى معطلاً إلى أن يكتمل التحقق من بيانات العميل وتفعيل مسار الحجز الإلكتروني الآمن داخل ARKAN.</p><div className="actions"><button className="primary" disabled>الحجز غير متاح حالياً</button></div></section>
          </>
        )}
      </div>
    </main>
  );
}
