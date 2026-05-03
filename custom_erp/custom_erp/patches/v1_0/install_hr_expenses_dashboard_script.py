"""Bootstrap the Expenses Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_expenses_dashboard_data"
API_METHOD = "hr_expenses_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Expenses dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
three_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -2))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Pending claims (drafts + awaiting approval) ----
pending_claims = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabExpense Claim`
    WHERE docstatus = 0
       OR (docstatus = 1 AND COALESCE(approval_status, '') = 'Draft')
""", as_dict=True)[0].cnt

# ---- Claim totals this month / last month ----
month_row = frappe.db.sql("""
    SELECT COALESCE(SUM(total_claimed_amount), 0) AS claimed,
           COALESCE(SUM(total_sanctioned_amount), 0) AS sanctioned,
           COUNT(*) AS cnt
    FROM `tabExpense Claim`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0]

last_row = frappe.db.sql("""
    SELECT COALESCE(SUM(total_claimed_amount), 0) AS claimed
    FROM `tabExpense Claim`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0]

claims_delta_pct = None
if to_flt(last_row.claimed) > 0:
    claims_delta_pct = ((to_flt(month_row.claimed) - to_flt(last_row.claimed)) / to_flt(last_row.claimed)) * 100.0

# ---- Approved claims this month ----
approved_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabExpense Claim`
    WHERE docstatus = 1
      AND COALESCE(approval_status, '') = 'Approved'
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

# ---- Outstanding advances (paid, not yet fully claimed/returned) ----
outstanding_advances = frappe.db.sql("""
    SELECT COALESCE(SUM(GREATEST(advance_amount - claimed_amount - return_amount, 0)), 0) AS total
    FROM `tabEmployee Advance`
    WHERE docstatus = 1
""", as_dict=True)[0].total

# ---- Claim sanctioned series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(posting_date, %(fmt)s) AS m,
           COALESCE(SUM(total_sanctioned_amount), 0) AS total
    FROM `tabExpense Claim`
    WHERE docstatus = 1
      AND posting_date >= %(s)s
    GROUP BY DATE_FORMAT(posting_date, %(grp)s)
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

# ---- Top departments by sanctioned spend (last 3 months) ----
top_departments = frappe.db.sql("""
    SELECT department,
           COUNT(*) AS claim_count,
           COALESCE(SUM(total_sanctioned_amount), 0) AS total_sanctioned
    FROM `tabExpense Claim`
    WHERE docstatus = 1
      AND posting_date >= %(s)s
    GROUP BY department
    HAVING COALESCE(department, '') <> ''
    ORDER BY total_sanctioned DESC
    LIMIT 6
""", {"s": three_months_start}, as_dict=True)

# ---- Pending claims list (drafts, top 6 by posting_date desc) ----
pending_claim_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, department,
           approval_status, total_claimed_amount, total_sanctioned_amount, posting_date
    FROM `tabExpense Claim`
    WHERE docstatus = 0
       OR (docstatus = 1 AND COALESCE(approval_status, '') = 'Draft')
    ORDER BY posting_date DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent advances list (top 6 by posting_date desc) ----
recent_advances = frappe.db.sql("""
    SELECT name, employee, employee_name, department, status,
           advance_amount, paid_amount, claimed_amount, posting_date
    FROM `tabEmployee Advance`
    WHERE docstatus < 2
    ORDER BY posting_date DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "pending_claims": pending_claims or 0,
        "claimed_month": to_flt(month_row.claimed),
        "claimed_last_month": to_flt(last_row.claimed),
        "claims_delta_pct": claims_delta_pct,
        "approved_month": approved_month or 0,
        "outstanding_advances": to_flt(outstanding_advances),
    },
    "claims_series": series,
    "top_departments": top_departments,
    "pending_claims": pending_claim_rows,
    "recent_advances": recent_advances,
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
