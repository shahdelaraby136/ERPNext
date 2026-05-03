"""Bootstrap the Recruitment Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_recruitment_dashboard_data"
API_METHOD = "hr_recruitment_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Recruitment dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
week_end = frappe.utils.add_days(today, 7)
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Open positions (Job Opening status='Open') ----
open_positions = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Opening`
    WHERE status = 'Open'
""", as_dict=True)[0].cnt

# ---- Active applicants (not Hold/Rejected/Accepted) ----
active_applicants = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Applicant`
    WHERE status NOT IN ('Hold', 'Rejected', 'Accepted')
""", as_dict=True)[0].cnt

# ---- Applicants this month (use creation date — `applied_on` does not exist in v16) ----
new_applicants_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Applicant`
    WHERE DATE(creation) BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

# ---- Interviews this week (today .. today+7) ----
interviews_week = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabInterview`
    WHERE scheduled_on BETWEEN %(s)s AND %(e)s
""", {"s": today, "e": week_end}, as_dict=True)[0].cnt

# ---- Offers this month / last month ----
offers_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Offer`
    WHERE offer_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

offers_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Offer`
    WHERE offer_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

offers_delta_pct = None
if to_flt(offers_last) > 0:
    offers_delta_pct = ((to_flt(offers_month) - to_flt(offers_last)) / to_flt(offers_last)) * 100.0

# ---- Applicants series (last 12 months) — bucket by creation month ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(creation, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabJob Applicant`
    WHERE creation >= %(s)s
    GROUP BY DATE_FORMAT(creation, %(grp)s)
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

# ---- Open positions list (with applicant counts) ----
open_positions_rows = frappe.db.sql("""
    SELECT jo.name, jo.job_title, jo.department, jo.designation, jo.status,
           (SELECT COUNT(*) FROM `tabJob Applicant` ja
            WHERE ja.job_title = jo.name) AS applicant_count
    FROM `tabJob Opening` jo
    WHERE jo.status = 'Open'
    ORDER BY jo.creation DESC
    LIMIT 6
""", as_dict=True)

# ---- Active applicants (top 6 by creation desc) ----
active_applicant_rows = frappe.db.sql("""
    SELECT name, applicant_name, email_id, job_title, designation, status,
           DATE(creation) AS applied_on
    FROM `tabJob Applicant`
    WHERE status NOT IN ('Hold', 'Rejected', 'Accepted')
    ORDER BY creation DESC
    LIMIT 6
""", as_dict=True)

# ---- Upcoming interviews (today and later) ----
upcoming_interviews = frappe.db.sql("""
    SELECT name, job_applicant, designation, interview_type,
           scheduled_on, from_time, to_time, status
    FROM `tabInterview`
    WHERE scheduled_on >= %(d)s
    ORDER BY scheduled_on ASC, from_time ASC
    LIMIT 6
""", {"d": today}, as_dict=True)

# enrich interview rows with applicant_name (avoid join in case of permissions)
for row in upcoming_interviews:
    if row.get("job_applicant"):
        row["job_applicant_name"] = frappe.db.get_value(
            "Job Applicant", row["job_applicant"], "applicant_name"
        ) or row["job_applicant"]

frappe.response["message"] = {
    "stats": {
        "open_positions": open_positions or 0,
        "active_applicants": active_applicants or 0,
        "new_applicants_month": new_applicants_month or 0,
        "interviews_week": interviews_week or 0,
        "offers_month": offers_month or 0,
        "offers_last_month": offers_last or 0,
        "offers_delta_pct": offers_delta_pct,
    },
    "applicants_series": series,
    "open_positions": open_positions_rows,
    "active_applicants": active_applicant_rows,
    "upcoming_interviews": upcoming_interviews,
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
