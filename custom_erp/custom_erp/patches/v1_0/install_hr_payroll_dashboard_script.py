"""Bootstrap the Payroll Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_payroll_dashboard_data"
API_METHOD = "hr_payroll_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Payroll dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Net pay (this month) ----
np_month = frappe.db.sql("""
    SELECT COALESCE(SUM(net_pay), 0) AS total,
           COUNT(DISTINCT employee) AS employees,
           COUNT(*) AS slips,
           COALESCE(AVG(net_pay), 0) AS avg_pay
    FROM `tabSalary Slip`
    WHERE docstatus = 1
      AND start_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0]

# ---- Net pay (last month) — for delta % ----
np_last = frappe.db.sql("""
    SELECT COALESCE(SUM(net_pay), 0) AS total
    FROM `tabSalary Slip`
    WHERE docstatus = 1
      AND start_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

payroll_delta_pct = None
if to_flt(np_last) > 0:
    payroll_delta_pct = ((to_flt(np_month.total) - to_flt(np_last)) / to_flt(np_last)) * 100.0

# ---- Pending / draft slips ----
pending = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabSalary Slip`
    WHERE docstatus = 0
""", as_dict=True)[0].cnt

# ---- Net pay series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(start_date, %(fmt)s) AS m,
           COALESCE(SUM(net_pay), 0) AS total
    FROM `tabSalary Slip`
    WHERE docstatus = 1
      AND start_date >= %(s)s
    GROUP BY DATE_FORMAT(start_date, %(grp)s)
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

# ---- Top employees by net pay (this month) ----
top_employees = frappe.db.sql("""
    SELECT ss.employee AS employee,
           COALESCE(ss.employee_name, ss.employee) AS employee_name,
           ss.department AS department,
           ss.designation AS designation,
           COALESCE(SUM(ss.net_pay), 0) AS net_pay,
           COUNT(*) AS slip_count
    FROM `tabSalary Slip` ss
    WHERE ss.docstatus = 1
      AND ss.start_date BETWEEN %(s)s AND %(e)s
    GROUP BY ss.employee
    ORDER BY net_pay DESC
    LIMIT 6
""", {"s": month_start, "e": today}, as_dict=True)

# ---- Pending slip rows (drafts, top 6 by net_pay) ----
pending_slips = frappe.db.sql("""
    SELECT name, employee, employee_name, department, designation,
           net_pay, posting_date, start_date, end_date
    FROM `tabSalary Slip`
    WHERE docstatus = 0
    ORDER BY posting_date DESC, net_pay DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent payroll entries (top 6 by start date) ----
recent_entries = frappe.db.sql("""
    SELECT name, payroll_frequency, company, status, start_date, end_date
    FROM `tabPayroll Entry`
    ORDER BY start_date DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "payroll_month": to_flt(np_month.total),
        "payroll_last_month": to_flt(np_last),
        "payroll_delta_pct": payroll_delta_pct,
        "employees_paid": np_month.employees or 0,
        "pending_slips": pending or 0,
        "draft_slips": pending or 0,
        "avg_net_pay": to_flt(np_month.avg_pay),
    },
    "netpay_series": series,
    "top_employees": top_employees,
    "pending_slips": pending_slips,
    "recent_entries": recent_entries,
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
