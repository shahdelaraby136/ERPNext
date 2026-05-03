"""Bootstrap the Leaves Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_leaves_dashboard_data"
API_METHOD = "hr_leaves_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Leaves dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Pending approvals (status=Open, not yet approved/rejected) ----
pending_count = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabLeave Application`
    WHERE status = 'Open'
      AND docstatus < 2
""", as_dict=True)[0].cnt

# ---- On leave today (approved leaves where today is in [from_date, to_date]) ----
on_leave_today = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabLeave Application`
    WHERE status = 'Approved'
      AND docstatus = 1
      AND %(d)s BETWEEN from_date AND to_date
""", {"d": today}, as_dict=True)[0].cnt

# ---- Leave days this month (approved + submitted) ----
month_row = frappe.db.sql("""
    SELECT COALESCE(SUM(total_leave_days), 0) AS days,
           COUNT(DISTINCT employee) AS emps
    FROM `tabLeave Application`
    WHERE status = 'Approved'
      AND docstatus = 1
      AND from_date <= %(e)s
      AND to_date >= %(s)s
""", {"s": month_start, "e": today}, as_dict=True)[0]

# ---- Leave days last month (for delta %) ----
last_days = frappe.db.sql("""
    SELECT COALESCE(SUM(total_leave_days), 0) AS days
    FROM `tabLeave Application`
    WHERE status = 'Approved'
      AND docstatus = 1
      AND from_date <= %(e)s
      AND to_date >= %(s)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].days

leave_delta_pct = None
if to_flt(last_days) > 0:
    leave_delta_pct = ((to_flt(month_row.days) - to_flt(last_days)) / to_flt(last_days)) * 100.0

# ---- Avg days per employee (this month) ----
avg_days = 0
if month_row.emps and to_flt(month_row.emps) > 0:
    avg_days = to_flt(month_row.days) / to_flt(month_row.emps)

# ---- Leave-days series (last 12 months) — bucketed by from_date month ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(from_date, %(fmt)s) AS m,
           COALESCE(SUM(total_leave_days), 0) AS total
    FROM `tabLeave Application`
    WHERE status = 'Approved'
      AND docstatus = 1
      AND from_date >= %(s)s
    GROUP BY DATE_FORMAT(from_date, %(grp)s)
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

# ---- On leave today rows ----
on_leave_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, leave_type, from_date, to_date, total_leave_days
    FROM `tabLeave Application`
    WHERE status = 'Approved'
      AND docstatus = 1
      AND %(d)s BETWEEN from_date AND to_date
    ORDER BY to_date ASC
    LIMIT 8
""", {"d": today}, as_dict=True)

# ---- Pending applications (status=Open) ----
pending_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, leave_type, from_date, to_date, total_leave_days, status
    FROM `tabLeave Application`
    WHERE status = 'Open'
      AND docstatus < 2
    ORDER BY from_date ASC
    LIMIT 6
""", as_dict=True)

# ---- Recent applications (any status, last 30 days) ----
recent_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, leave_type, from_date, to_date, total_leave_days, status
    FROM `tabLeave Application`
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "pending_count": pending_count or 0,
        "on_leave_today": on_leave_today or 0,
        "leave_days_month": to_flt(month_row.days),
        "leave_days_last_month": to_flt(last_days),
        "leave_delta_pct": leave_delta_pct,
        "avg_days_per_emp": to_flt(avg_days),
        "employees_on_leave_month": month_row.emps or 0,
    },
    "leaves_series": series,
    "on_leave_today": on_leave_rows,
    "pending_apps": pending_rows,
    "recent_apps": recent_rows,
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
