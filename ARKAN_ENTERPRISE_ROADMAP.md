# ARKAN ENTERPRISE — Implementation Roadmap

## Guardrails
- Preserve the existing navy/gold visual identity, Arabic/English support, current records, and free-tier infrastructure.
- Use additive database migrations; do not delete or rewrite legacy data.
- Keep financial, contractual, destructive, and permission-sensitive actions behind explicit owner/admin approval.
- Every phase must pass schema/security checks and an application build/typecheck before promotion to production.

## Phase 1 — Security, data integrity, accounting
- Review existing RLS policies and privileged RPCs without breaking branch membership or customer portal workflows.
- Introduce approval requests for discounts, contract cancellation, large expenses, financial adjustments, and record deletion.
- Establish an Auto Pilot findings store with deduplication and manager/owner review states.
- Reconcile accounting sources and currencies before producing profit, cash-flow, or forecast figures.

## Phase 2 — Vehicle and customer intelligence
- Vehicle lifecycle profile: rental days, revenue, costs, incidents, maintenance, insurance, registration, and utilization.
- VIP customer tiers, loyalty points, rewards, receivables, and repeat-customer alerts.
- Digital pickup/return inspections with multiple photos, odometer, fuel, damage notes, and customer acknowledgement.
- Predictive maintenance based on date and mileage; searchable document archive with role-aware access.

## Phase 3 — Operations and automation
- Customer-facing availability, pricing, booking request, and request status.
- Approval-aware workflows, employee tasks, branch operations, reminders, and notification integrations.
- Prevent conflicting rentals using server-side validation and database locking already present in the project.

## Phase 4 — Owner intelligence
- Owner dashboard with daily operations, actual profit by currency, employee/branch performance, vehicle profitability, and pending approvals.
- Cash-flow and revenue forecasts with confidence ranges and explicit data-quality warnings.

## Phase 5 — ARKAN AUTO PILOT
- Detect overdue receivables, underperforming/idle vehicles, upcoming maintenance, expiring documents, unusual transactions, and booking conflicts.
- Explain each finding with evidence, impact, and a suggested action.
- Suggestions are advisory only; sensitive actions require an approved request and must never auto-execute.
