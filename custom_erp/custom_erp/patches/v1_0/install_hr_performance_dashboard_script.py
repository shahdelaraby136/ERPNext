"""Bootstrap the Performance Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_performance_dashboard_data"
API_METHOD = "hr_performance_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Performance dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Active appraisals (draft = docstatus 0) ----
active_appraisals = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabAppraisal`
    WHERE docstatus = 0
""", as_dict=True)[0].cnt

# ---- Open goals (status NOT in closed-like values) ----
open_goals = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabGoal`
    WHERE COALESCE(status, '') NOT IN ('Closed', 'Completed', 'Archived', 'Cancelled')
""", as_dict=True)[0].cnt

# ---- Submitted appraisals this month / last month ----
submitted_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt,
           COALESCE(AVG(NULLIF(final_score, 0)), 0) AS avg_score
    FROM `tabAppraisal`
    WHERE docstatus = 1
      AND DATE(modified) BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0]

submitted_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabAppraisal`
    WHERE docstatus = 1
      AND DATE(modified) BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

submitted_delta_pct = None
if to_flt(submitted_last) > 0:
    submitted_delta_pct = ((to_flt(submitted_month.cnt) - to_flt(submitted_last)) / to_flt(submitted_last)) * 100.0

# ---- Avg final score across all submitted appraisals ----
avg_score_row = frappe.db.sql("""
    SELECT COALESCE(AVG(NULLIF(final_score, 0)), 0) AS avg_score
    FROM `tabAppraisal`
    WHERE docstatus = 1
""", as_dict=True)[0]

# ---- Appraisals series (last 12 months) — bucket by start_date month ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(start_date, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabAppraisal`
    WHERE start_date >= %(s)s
      AND docstatus < 2
    GROUP BY DATE_FORMAT(start_date, %(grp)s)
    ORDER BY m
""", {"s": twelve_months_start, "fmt": "%Y-%m-01", "grp": "%Y-%m"}, as_dict=True)

series = []
cursor = twelve_months_start
by_month = {row.m: int(row.total or 0) for row in series_rows}
for i in range(12):
    key = frappe.utils.formatdate(cursor, "yyyy-MM-01")
    label = frappe.utils.formatdate(cursor, "MMM yy")
    series.append({"label": label, "value": by_month.get(key, 0)})
    cursor = frappe.utils.add_months(cursor, 1)

# ---- Top performers (avg score over submitted appraisals, last 12 months) ----
top_performers = frappe.db.sql("""
    SELECT a.employee AS employee,
           COALESCE(a.employee_name, a.employee) AS employee_name,
           a.department AS department,
           a.designation AS designation,
           AVG(NULLIF(a.final_score, 0)) AS avg_score,
           COUNT(*) AS appraisals_count
    FROM `tabAppraisal` a
    WHERE a.docstatus = 1
      AND a.start_date >= %(s)s
      AND a.final_score > 0
    GROUP BY a.employee
    ORDER BY avg_score DESC
    LIMIT 6
""", {"s": twelve_months_start}, as_dict=True)

# ---- Active appraisals list (drafts, top 6 by end_date) ----
active_appraisal_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, department, designation,
           appraisal_cycle, start_date, end_date, final_score
    FROM `tabAppraisal`
    WHERE docstatus = 0
    ORDER BY end_date ASC
    LIMIT 6
""", as_dict=True)

# ---- Open goals list (status not closed; top 6 by end_date) ----
open_goal_rows = frappe.db.sql("""
    SELECT name, goal_name, employee, employee_name, kra,
           start_date, end_date, status, appraisal_cycle
    FROM `tabGoal`
    WHERE COALESCE(status, '') NOT IN ('Closed', 'Completed', 'Archived', 'Cancelled')
    ORDER BY end_date ASC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "active_appraisals": active_appraisals or 0,
        "open_goals": open_goals or 0,
        "submitted_month": submitted_month.cnt or 0,
        "submitted_last_month": submitted_last or 0,
        "submitted_delta_pct": submitted_delta_pct,
        "avg_score": to_flt(avg_score_row.avg_score),
    },
    "appraisals_series": series,
    "top_performers": top_performers,
    "active_appraisals": active_appraisal_rows,
    "open_goals": open_goal_rows,
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
