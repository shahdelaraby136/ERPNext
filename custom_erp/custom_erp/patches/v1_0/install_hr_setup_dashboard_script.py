"""Bootstrap the HR Setup Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_setup_dashboard_data"
API_METHOD = "hr_setup_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom HR Setup dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Active employees ----
active_employees = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee`
    WHERE status = 'Active'
""", as_dict=True)[0].cnt

# ---- New joiners this month / last month ----
joiners_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee`
    WHERE date_of_joining BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

joiners_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee`
    WHERE date_of_joining BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

joiners_delta_pct = None
if to_flt(joiners_last) > 0:
    joiners_delta_pct = ((to_flt(joiners_month) - to_flt(joiners_last)) / to_flt(joiners_last)) * 100.0

# ---- Departments / Designations counts ----
departments = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabDepartment`
    WHERE COALESCE(disabled, 0) = 0
""", as_dict=True)[0].cnt

designations = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabDesignation`
""", as_dict=True)[0].cnt

# ---- New joiners series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(date_of_joining, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabEmployee`
    WHERE date_of_joining >= %(s)s
    GROUP BY DATE_FORMAT(date_of_joining, %(grp)s)
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

# ---- Top departments by active employee count ----
top_departments = frappe.db.sql("""
    SELECT e.department AS department,
           d.parent_department AS parent_department,
           COUNT(*) AS employee_count
    FROM `tabEmployee` e
    LEFT JOIN `tabDepartment` d ON d.name = e.department
    WHERE e.status = 'Active'
    GROUP BY e.department
    HAVING COALESCE(e.department, '') <> ''
    ORDER BY employee_count DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent employees (top 6 by date_of_joining desc) ----
recent_employees = frappe.db.sql("""
    SELECT name, employee_name, employee_number, date_of_joining,
           department, designation, branch, status
    FROM `tabEmployee`
    ORDER BY date_of_joining DESC
    LIMIT 6
""", as_dict=True)

# ---- Top designations by active employee count ----
top_designations = frappe.db.sql("""
    SELECT designation,
           COUNT(*) AS employee_count
    FROM `tabEmployee`
    WHERE status = 'Active'
    GROUP BY designation
    HAVING COALESCE(designation, '') <> ''
    ORDER BY employee_count DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "active_employees": active_employees or 0,
        "joiners_month": joiners_month or 0,
        "joiners_last_month": joiners_last or 0,
        "joiners_delta_pct": joiners_delta_pct,
        "departments": departments or 0,
        "designations": designations or 0,
    },
    "joiners_series": series,
    "top_departments": top_departments,
    "recent_employees": recent_employees,
    "top_designations": top_designations,
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
