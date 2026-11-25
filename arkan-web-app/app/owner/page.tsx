"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import OwnerCommand from "../owner-command";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://blknmrmibgklnfqycxnq.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_kRGYnQJ4LY5bdtcfPy3Agw_gG6U4hSyv";
type Row = { id: string; [key: string]: any };

export default function OwnerPage() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [role, setRole] = useState("");
  const [cars, setCars] = useState<Row[]>([]);
  const [contracts, setContracts] = useState<Row[]>([]);
  const [cash, setCash] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [findings, setFindings] = useState<Row[]>([]);
  const [debts, setDebts] = useState<Row[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("جارٍ الاتصال ببيانات ARKAN...");

  const refresh = useCallback(async (sb: SupabaseClient, company: string, branch: string) => {
    const [carResult, recordResult, approvalResult, findingResult] = await Promise.all([
      sb.from("cars").select("*").eq("company_id", company).eq("branch_id", branch),
      sb.from("arkan_records").select("id,section,record_data,created_at").eq("company_id", company).eq("branch_id", branch).order("created_at", { ascending: false }).limit(2000),
      sb.from("approval_requests").select("*").eq("company_id", company).order("created_at", { ascending: false }).limit(100),
      sb.from("autopilot_findings").select("*").eq("company_id", company).order("last_seen_at", { ascending: false }).limit(100)
    ]);
    if (carResult.error) throw carResult.error;
    if (recordResult.error) throw recordResult.error;
    if (approvalResult.error) throw approvalResult.error;
    if (findingResult.error) throw findingResult.error;
    const records = (recordResult.data || []).map((item: any) => ({ ...item.record_data, id: item.id, created_at: item.created_at }));
    const contractsData = records.filter((r: any) => r.section === "contracts");
    const cashData = records.filter((r: any) => r.section === "cash");
    setCars(carResult.data || []);
    setContracts(contractsData);
    setCash(cashData);
    setApprovals(approvalResult.data || []);
    setFindings(findingResult.data || []);
    const receiptTypes = ["قبض", "قبض نقدي", "مقبوض", "استلام", "إيراد", "ايراد", "receipt", "income", "received"];
    const outstanding = contractsData.map((contract: any) => {
      const received = cashData.filter((entry: any) => entry.contract_no === contract.contract_no && receiptTypes.includes(String(entry.kind || "").trim().toLowerCase())).reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
      return { ...contract, outstanding: Math.max(0, Number(contract.total_amount || 0) - received) };
    }).filter((contract: any) => contract.outstanding > 0);
    setDebts(outstanding);
  }, []);

  useEffect(() => {
    const sb = createClient(URL, KEY);
    setClient(sb);
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await sb.auth.getUser();
        if (!auth.user) { if (alive) setMessage("يرجى تسجيل الدخول إلى ARKAN أولاً، ثم افتح هذه الصفحة من نفس المتصفح."); return; }
        const { data: company, error: companyError } = await sb.rpc("create_or_get_my_company", { company_name: "ARKAN CO. – RENT A CAR" });
        if (companyError) throw companyError;
        const { data: membership, error: membershipError } = await sb.from("company_members").select("role").eq("company_id", company).eq("user_id", auth.user.id).single();
        if (membershipError) throw membershipError;
        if (!["owner", "admin", "manager", "accountant"].includes(membership.role || "")) throw new Error("ليس لديك صلاحية الوصول إلى لوحة المالك.");
        const { data: branches, error: branchError } = await sb.from("branches").select("id,is_active,is_default").eq("company_id", company).eq("is_active", true).order("created_at", { ascending: true });
        if (branchError) throw branchError;
        if (!branches?.length) throw new Error("لا يوجد فرع نشط مرتبط بحسابك.");
        const branch = branches.find((item: any) => item.is_default)?.id || branches[0].id;
        if (!alive) return;
        setRole(membership.role || "");
        setCompanyId(company);
        setBranchId(branch);
        await refresh(sb, company, branch);
        if (alive) setMessage("");
      } catch (error: any) {
        if (alive) setMessage(error?.message || "تعذر تحميل لوحة المالك.");
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  async function createApproval(request: { request_type: string; reason: string; amount?: number; currency: string }) {
    if (!client || !companyId || !branchId) return;
    setBusy(true);
    try {
      const { data: auth } = await client.auth.getUser();
      const { error } = await client.from("approval_requests").insert({
        company_id: companyId, branch_id: branchId, requested_by: auth.user?.id,
        request_type: request.request_type, reason: request.reason,
        amount: request.amount ?? null, currency: request.currency, status: "pending"
      });
      if (error) throw error;
      await refresh(client, companyId, branchId);
    } finally { setBusy(false); }
  }

  async function reviewApproval(id: string, status: "approved" | "rejected") {
    if (!client || !companyId || !["owner", "admin"].includes(role)) return;
    setBusy(true);
    try {
      const { data: auth } = await client.auth.getUser();
      const { error } = await client.from("approval_requests").update({
        status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString()
      }).eq("id", id).eq("company_id", companyId).eq("status", "pending");
      if (error) throw error;
      await refresh(client, companyId, branchId);
    } finally { setBusy(false); }
  }

  if (message) return <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6f9", padding: 24, fontFamily: "Arial,sans-serif" }}><section style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 560, width: "100%", boxShadow: "0 12px 40px #14253d12" }}><h1 style={{ color: "#14253d" }}>ARKAN OWNER</h1><p>{message}</p></section></main>;
  return <main style={{ minHeight: "100vh", padding: 24, background: "#f4f6f9", color: "#14253d", fontFamily: "Arial,sans-serif" }}><div style={{ maxWidth: 1440, margin: "0 auto" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><a href="/" style={{ color: "#14253d" }}>← العودة إلى ARKAN</a><button disabled={busy} onClick={() => client && refresh(client, companyId, branchId)} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #c9a45c", background: "white", cursor: "pointer" }}>تحديث البيانات</button></div><OwnerCommand ar={true} role={role} cars={cars} contracts={contracts} cash={cash} debts={debts} alerts={[]} approvals={approvals} findings={findings} onOpen={(section) => { window.location.href = "/?section=" + encodeURIComponent(section); }} onCreateApproval={createApproval} onReviewApproval={reviewApproval}/></div></main>;
}
