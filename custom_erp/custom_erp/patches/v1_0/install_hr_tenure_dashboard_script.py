"""Bootstrap the Tenure Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_tenure_dashboard_data"
API_METHOD = "hr_tenure_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Tenure dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Active onboardings (boarding_status not Completed and docstatus < 2) ----
active_onboardings = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Onboarding`
    WHERE COALESCE(boarding_status, 'Pending') NOT IN ('Completed', 'Cancelled')
      AND docstatus < 2
""", as_dict=True)[0].cnt

# ---- Active separations ----
active_separations = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Separation`
    WHERE COALESCE(boarding_status, 'Pending') NOT IN ('Completed', 'Cancelled')
      AND docstatus < 2
""", as_dict=True)[0].cnt

# ---- Promotions this month / last month ----
promotions_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Promotion`
    WHERE docstatus = 1
      AND promotion_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

promotions_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Promotion`
    WHERE docstatus = 1
      AND promotion_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

promotions_delta_pct = None
if to_flt(promotions_last) > 0:
    promotions_delta_pct = ((to_flt(promotions_month) - to_flt(promotions_last)) / to_flt(promotions_last)) * 100.0

# ---- Transfers this month ----
transfers_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabEmployee Transfer`
    WHERE docstatus = 1
      AND transfer_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

# ---- Headcount events series (last 12 months): onboardings vs separations ----
onb_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(boarding_begins_on, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabEmployee Onboarding`
    WHERE boarding_begins_on >= %(s)s
      AND docstatus < 2
    GROUP BY DATE_FORMAT(boarding_begins_on, %(grp)s)
    ORDER BY m
""", {"s": twelve_months_start, "fmt": "%Y-%m-01", "grp": "%Y-%m"}, as_dict=True)

sep_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(boarding_begins_on, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabEmployee Separation`
    WHERE boarding_begins_on >= %(s)s
      AND docstatus < 2
    GROUP BY DATE_FORMAT(boarding_begins_on, %(grp)s)
    ORDER BY m
""", {"s": twelve_months_start, "fmt": "%Y-%m-01", "grp": "%Y-%m"}, as_dict=True)

onb_by_month = {row.m: int(row.total or 0) for row in onb_rows}
sep_by_month = {row.m: int(row.total or 0) for row in sep_rows}

series = []
cursor = twelve_months_start
for i in range(12):
    key = frappe.utils.formatdate(cursor, "yyyy-MM-01")
    label = frappe.utils.formatdate(cursor, "MMM yy")
    series.append({
        "label": label,
        "onboardings": onb_by_month.get(key, 0),
        "separations": sep_by_month.get(key, 0),
    })
    cursor = frappe.utils.add_months(cursor, 1)

# ---- Open grievances list ----
open_grievances = frappe.db.sql("""
    SELECT name, employee_name, designation, grievance_type, status, date
    FROM `tabEmployee Grievance`
    WHERE COALESCE(status, 'Open') NOT IN ('Resolved', 'Closed')
      AND docstatus < 2
    ORDER BY date DESC
    LIMIT 6
""", as_dict=True)

# ---- Active onboardings list ----
onboarding_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, department, designation,
           boarding_status, date_of_joining, boarding_begins_on
    FROM `tabEmployee Onboarding`
    WHERE COALESCE(boarding_status, 'Pending') NOT IN ('Completed', 'Cancelled')
      AND docstatus < 2
    ORDER BY boarding_begins_on DESC
    LIMIT 6
""", as_dict=True)

# ---- Active separations list ----
separation_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, department, designation,
           boarding_status, resignation_letter_date, boarding_begins_on
    FROM `tabEmployee Separation`
    WHERE COALESCE(boarding_status, 'Pending') NOT IN ('Completed', 'Cancelled')
      AND docstatus < 2
    ORDER BY resignation_letter_date DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "active_onboardings": active_onboardings or 0,
        "active_separations": active_separations or 0,
        "promotions_month": promotions_month or 0,
        "promotions_last_month": promotions_last or 0,
        "promotions_delta_pct": promotions_delta_pct,
        "transfers_month": transfers_month or 0,
    },
    "events_series": series,
    "open_grievances": open_grievances,
    "active_onboardings": onboarding_rows,
    "active_separations": separation_rows,
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
