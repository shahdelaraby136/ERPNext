"""Bootstrap the Selling Dashboard Server Script (Type: API).

Idempotent: re-running updates the script body in place.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field  # noqa: F401


SCRIPT_NAME = "selling_dashboard_data"
API_METHOD = "selling_dashboard_data"

# NOTE: outer string uses single quotes (''') so the inner SQL can use """ safely.
SCRIPT_BODY = r'''
# Server Script — Type: API
# Returns aggregated metrics for the custom Selling dashboard.
# Sandbox-safe: only frappe.* APIs.

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
ninety_days_ago = frappe.utils.add_days(today, -90)
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Revenue (this month) ----
rev_month = frappe.db.sql("""
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM `tabSales Invoice`
    WHERE docstatus = 1
      AND is_return = 0
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].total

# ---- Revenue (last month) ----
rev_last = frappe.db.sql("""
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM `tabSales Invoice`
    WHERE docstatus = 1
      AND is_return = 0
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

revenue_delta_pct = None
if to_flt(rev_last) > 0:
    revenue_delta_pct = ((to_flt(rev_month) - to_flt(rev_last)) / to_flt(rev_last)) * 100.0

# ---- Open Sales Orders ----
open_so = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(grand_total), 0) AS total
    FROM `tabSales Order`
    WHERE docstatus = 1
      AND status IN ('To Deliver and Bill', 'To Bill', 'To Deliver')
""", as_dict=True)[0]

# ---- Overdue Invoices ----
overdue = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(outstanding_amount), 0) AS total
    FROM `tabSales Invoice`
    WHERE docstatus = 1
      AND status = 'Overdue'
""", as_dict=True)[0]

# ---- Active customers (had a SI in last 90 days) ----
active_customers = frappe.db.sql("""
    SELECT COUNT(DISTINCT customer) AS cnt
    FROM `tabSales Invoice`
    WHERE docstatus = 1 AND posting_date >= %(s)s
""", {"s": ninety_days_ago}, as_dict=True)[0].cnt

# ---- Revenue series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(posting_date, %(fmt)s) AS m,
           COALESCE(SUM(grand_total), 0) AS total
    FROM `tabSales Invoice`
    WHERE docstatus = 1
      AND is_return = 0
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

# ---- Top customers by health score (Custom Field) ----
top_customers = []
has_health = frappe.db.exists("Custom Field", "Customer-customer_health_score")
if has_health:
    top_customers = frappe.db.sql("""
        SELECT name, customer_name, territory,
               COALESCE(customer_health_score, 0) AS health_score
        FROM `tabCustomer`
        WHERE disabled = 0
        ORDER BY COALESCE(customer_health_score, 0) DESC, modified DESC
        LIMIT 5
    """, as_dict=True)
else:
    # Fallback: top 5 customers by total invoiced last 90 days
    top_customers = frappe.db.sql("""
        SELECT si.customer AS name,
               COALESCE(c.customer_name, si.customer) AS customer_name,
               c.territory AS territory,
               LEAST(100, ROUND(SUM(si.grand_total) / NULLIF(MAX(t.peak), 0) * 100, 0)) AS health_score
        FROM `tabSales Invoice` si
        LEFT JOIN `tabCustomer` c ON c.name = si.customer
        JOIN (
            SELECT MAX(grand_total) AS peak
            FROM `tabSales Invoice`
            WHERE docstatus = 1 AND posting_date >= %(s)s
        ) t
        WHERE si.docstatus = 1
          AND si.posting_date >= %(s)s
        GROUP BY si.customer, c.customer_name, c.territory
        ORDER BY SUM(si.grand_total) DESC
        LIMIT 5
    """, {"s": ninety_days_ago}, as_dict=True)

# ---- Open SO list (top 6 by amount) ----
open_sales_orders = frappe.db.sql("""
    SELECT name, customer, customer_name, status, grand_total
    FROM `tabSales Order`
    WHERE docstatus = 1
      AND status IN ('To Deliver and Bill', 'To Bill', 'To Deliver')
    ORDER BY grand_total DESC
    LIMIT 6
""", as_dict=True)

# ---- Overdue invoice list (top 6 by outstanding) ----
overdue_invoices = frappe.db.sql("""
    SELECT name, customer, customer_name, due_date, outstanding_amount
    FROM `tabSales Invoice`
    WHERE docstatus = 1
      AND status = 'Overdue'
    ORDER BY outstanding_amount DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "revenue_month": to_flt(rev_month),
        "revenue_last_month": to_flt(rev_last),
        "revenue_delta_pct": revenue_delta_pct,
        "open_so_count": open_so.cnt or 0,
        "open_so_value": to_flt(open_so.total),
        "overdue_count": overdue.cnt or 0,
        "overdue_value": to_flt(overdue.total),
        "active_customers": active_customers or 0,
    },
    "revenue_series": series,
    "top_customers": top_customers,
    "open_sales_orders": open_sales_orders,
    "overdue_invoices": overdue_invoices,
}
'''.strip()


def execute():
    if not frappe.db.exists("DocType", "Server Script"):
        return

    existing = frappe.db.exists("Server Script", SCRIPT_NAME)
    if existing:
        doc = frappe.get_doc("Server Script", SCRIPT_NAME)
        doc.script_type = "API"
        doc.api_method = API_METHOD
        doc.allow_guest = 0
        doc.disabled = 0
        doc.script = SCRIPT_BODY
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.get_doc(
            {
                "doctype": "Server Script",
                "name": SCRIPT_NAME,
                "script_type": "API",
                "api_method": API_METHOD,
                "allow_guest": 0,
                "disabled": 0,
                "script": SCRIPT_BODY,
            }
        )
        doc.insert(ignore_permissions=True)

    frappe.db.commit()
