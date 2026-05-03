"""Bootstrap the Shift & Attendance Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe


SCRIPT_NAME = "hr_shift_dashboard_data"
API_METHOD = "hr_shift_dashboard_data"

SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Shift & Attendance dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Present today (Attendance status='Present') ----
present_today = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabAttendance`
    WHERE attendance_date = %(d)s
      AND status = 'Present'
      AND docstatus = 1
""", {"d": today}, as_dict=True)[0].cnt

# ---- Late today (late_entry = 1) ----
late_today = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabAttendance`
    WHERE attendance_date = %(d)s
      AND late_entry = 1
      AND docstatus = 1
""", {"d": today}, as_dict=True)[0].cnt

# ---- Working hours this month / last month ----
hours_month = frappe.db.sql("""
    SELECT COALESCE(SUM(working_hours), 0) AS total
    FROM `tabAttendance`
    WHERE attendance_date BETWEEN %(s)s AND %(e)s
      AND docstatus = 1
""", {"s": month_start, "e": today}, as_dict=True)[0].total

hours_last = frappe.db.sql("""
    SELECT COALESCE(SUM(working_hours), 0) AS total
    FROM `tabAttendance`
    WHERE attendance_date BETWEEN %(s)s AND %(e)s
      AND docstatus = 1
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

hours_delta_pct = None
if to_flt(hours_last) > 0:
    hours_delta_pct = ((to_flt(hours_month) - to_flt(hours_last)) / to_flt(hours_last)) * 100.0

# ---- Pending attendance requests ----
pending_requests = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabAttendance Request`
    WHERE docstatus = 0
""", as_dict=True)[0].cnt

# ---- Attendance series — present-day count per month (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(attendance_date, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabAttendance`
    WHERE attendance_date >= %(s)s
      AND status = 'Present'
      AND docstatus = 1
    GROUP BY DATE_FORMAT(attendance_date, %(grp)s)
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

# ---- Checked in today (latest checkins, top 8) ----
today_start = today + " 00:00:00"
today_end = today + " 23:59:59"
checked_in_today = frappe.db.sql("""
    SELECT name, employee, employee_name, time, log_type, shift, device_id
    FROM `tabEmployee Checkin`
    WHERE time BETWEEN %(s)s AND %(e)s
    ORDER BY time DESC
    LIMIT 8
""", {"s": today_start, "e": today_end}, as_dict=True)

# ---- Pending attendance requests (top 6) ----
pending_request_rows = frappe.db.sql("""
    SELECT name, employee, employee_name, from_date, to_date, reason
    FROM `tabAttendance Request`
    WHERE docstatus = 0
    ORDER BY from_date DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent shift assignments (top 6 by start date) ----
recent_assignments = frappe.db.sql("""
    SELECT name, employee, employee_name, shift_type, start_date, end_date, status
    FROM `tabShift Assignment`
    ORDER BY start_date DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "present_today": present_today or 0,
        "late_today": late_today or 0,
        "hours_month": to_flt(hours_month),
        "hours_last_month": to_flt(hours_last),
        "hours_delta_pct": hours_delta_pct,
        "pending_requests": pending_requests or 0,
    },
    "attendance_series": series,
    "checked_in_today": checked_in_today,
    "pending_requests": pending_request_rows,
    "recent_assignments": recent_assignments,
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
