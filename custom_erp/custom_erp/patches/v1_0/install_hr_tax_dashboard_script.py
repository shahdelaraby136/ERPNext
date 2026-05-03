"""Bootstrap the Tax & Benefits Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_tax_dashboard_data"
API_METHOD = "hr_tax_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Tax & Benefits dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Active tax declarations (submitted) and total exemption ----
declaration_row = frappe.db.sql("""
    SELECT COUNT(*) AS cnt,
           COALESCE(SUM(total_exemption_amount), 0) AS total_exempt
    FROM `tabEmployee Tax Exemption Declaration`
    WHERE docstatus = 1
""", as_dict=True)[0]

# ---- Benefit applications this month (count) ----
benefit_apps_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Benefit Application`
    WHERE docstatus = 1
      AND DATE(date) BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

# ---- Benefit claims this month (sum claimed_amount) ----
claims_month = frappe.db.sql("""
    SELECT COALESCE(SUM(claimed_amount), 0) AS total
    FROM `tabEmployee Benefit Claim`
    WHERE docstatus = 1
      AND DATE(payroll_date) BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].total

# ---- Benefit claims last month (for delta %) ----
claims_last = frappe.db.sql("""
    SELECT COALESCE(SUM(claimed_amount), 0) AS total
    FROM `tabEmployee Benefit Claim`
    WHERE docstatus = 1
      AND DATE(payroll_date) BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

claims_delta_pct = None
if to_flt(claims_last) > 0:
    claims_delta_pct = ((to_flt(claims_month) - to_flt(claims_last)) / to_flt(claims_last)) * 100.0

# ---- Benefit claims series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(payroll_date, %(fmt)s) AS m,
           COALESCE(SUM(claimed_amount), 0) AS total
    FROM `tabEmployee Benefit Claim`
    WHERE docstatus = 1
      AND payroll_date >= %(s)s
    GROUP BY DATE_FORMAT(payroll_date, %(grp)s)
    ORDER BY m
""", {"s": twelve_months_start, "fmt": "%Y-%m-01", "grp": "%Y-%m"}, as_dict=True)

series = []
cursor = twelve_months_start
by_month = {row.m: to_flt(row.total) for row in series_rows}
for i in range(12):
    key = frappe.utils.formatdate(cursor, "yyyy-MM-01")
    label = frappe.utils.formatdate(cursor, "MMM yy")
    series.append({"label": label, "value": by_month.get(key, 0)})
    cursor = frappe.utils.add_months(cursor, 1)

# ---- Active tax slabs (not disabled) ----
active_slabs = frappe.db.sql("""
    SELECT name, effective_from, standard_tax_exemption_amount, disabled
    FROM `tabIncome Tax Slab`
    WHERE COALESCE(disabled, 0) = 0
    ORDER BY effective_from DESC
    LIMIT 6
""", as_dict=True)

# ---- Pending tax declarations (drafts) ----
pending_declarations = frappe.db.sql("""
    SELECT name, employee, employee_name, payroll_period,
           total_declared_amount, total_exemption_amount
    FROM `tabEmployee Tax Exemption Declaration`
    WHERE docstatus = 0
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent benefit claims (top 6 by payroll_date desc) ----
recent_claims = frappe.db.sql("""
    SELECT name, employee, employee_name, payroll_date,
           claimed_amount, max_amount_eligible
    FROM `tabEmployee Benefit Claim`
    WHERE docstatus = 1
    ORDER BY payroll_date DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "active_declarations": declaration_row.cnt or 0,
        "total_exemption": to_flt(declaration_row.total_exempt),
        "benefit_apps_month": benefit_apps_month or 0,
        "claims_month": to_flt(claims_month),
        "claims_last_month": to_flt(claims_last),
        "claims_delta_pct": claims_delta_pct,
    },
    "claims_series": series,
    "active_slabs": active_slabs,
    "pending_declarations": pending_declarations,
    "recent_claims": recent_claims,
}
'''.strip()


def execute():
    """Create or update the Server Script."""
    if frappe.db.exists("Server Script", SCRIPT_NAME):
        doc = frappe.get_doc("Server Script", SCRIPT_NAME)
        doc.script = SCRIPT_BODY
        doc.script_type = "API"
        doc.api_method = API_METHOD
        doc.disabled = 0
        doc.save(ignore_permissions=True)
    else:
        frappe.get_doc({
            "doctype": "Server Script",
            "name": SCRIPT_NAME,
            "script_type": "API",
            "api_method": API_METHOD,
            "script": SCRIPT_BODY,
            "disabled": 0,
        }).insert(ignore_permissions=True)
    frappe.db.commit()
