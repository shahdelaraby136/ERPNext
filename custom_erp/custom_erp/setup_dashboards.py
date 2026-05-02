"""Idempotent installer for custom dashboard Server Scripts.

Run from inside the bench container:
    bench --site <site> execute custom_erp.setup_dashboards.install_assets_dashboard
"""

import frappe


ASSETS_DASHBOARD_SCRIPT = r'''
# Server Script: assets_dashboard_data
# Returns KPIs + lists + category chart for /app/assets hub.

result = {}

# ---- KPIs ----
total_assets = frappe.db.count("Asset")
active_assets = frappe.db.count(
    "Asset",
    filters={"docstatus": 1, "status": ["not in", ["Sold", "Scrapped", "Decapitalized"]]},
)
maintenance_logs = frappe.db.count("Asset Maintenance Log")

sum_row = frappe.db.sql(
    "SELECT COALESCE(SUM(purchase_amount), 0) FROM `tabAsset` WHERE docstatus < 2",
    as_list=True,
)
total_value = float(sum_row[0][0]) if sum_row and sum_row[0] else 0.0

result["stats"] = {
    "total_assets": total_assets or 0,
    "active_assets": active_assets or 0,
    "maintenance_logs": maintenance_logs or 0,
    "total_value": total_value,
}

# ---- Asset value by category ----
result["value_by_category"] = frappe.db.sql(
    """
    SELECT COALESCE(NULLIF(asset_category, ''), 'Uncategorised') AS label,
           COALESCE(SUM(purchase_amount), 0) AS value
    FROM `tabAsset`
    WHERE docstatus < 2
    GROUP BY asset_category
    ORDER BY value DESC
    LIMIT 10
    """,
    as_dict=True,
)

# ---- Recent assets ----
result["recent_assets"] = frappe.get_all(
    "Asset",
    fields=["name", "asset_name", "asset_category", "status", "purchase_amount"],
    order_by="creation desc",
    limit=6,
)

# ---- Recent maintenance logs ----
result["maintenance_log_rows"] = frappe.get_all(
    "Asset Maintenance Log",
    fields=["name", "asset_name", "maintenance_type", "maintenance_status", "completion_date"],
    order_by="modified desc",
    limit=6,
)

# ---- Recent movements ----
result["movements"] = frappe.get_all(
    "Asset Movement",
    fields=["name", "purpose", "transaction_date", "company"],
    order_by="modified desc",
    limit=6,
)

frappe.response["message"] = result
'''


BUYING_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Buying dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Spend (this month) ----
spend_month = frappe.db.sql("""
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM `tabPurchase Invoice`
    WHERE docstatus = 1
      AND is_return = 0
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].total

# ---- Spend (last month) ----
spend_last = frappe.db.sql("""
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM `tabPurchase Invoice`
    WHERE docstatus = 1
      AND is_return = 0
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

spend_delta_pct = None
if to_flt(spend_last) > 0:
    spend_delta_pct = ((to_flt(spend_month) - to_flt(spend_last)) / to_flt(spend_last)) * 100.0

# ---- Open Purchase Orders ----
open_po = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(grand_total), 0) AS total
    FROM `tabPurchase Order`
    WHERE docstatus = 1
      AND status NOT IN ('Closed', 'Completed', 'Cancelled', 'Delivered')
""", as_dict=True)[0]

# ---- Overdue Purchase Invoices ----
overdue = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(outstanding_amount), 0) AS total
    FROM `tabPurchase Invoice`
    WHERE docstatus = 1
      AND status = 'Overdue'
""", as_dict=True)[0]

# ---- Active suppliers ----
active_suppliers = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabSupplier`
    WHERE disabled = 0
""", as_dict=True)[0].cnt

# ---- Spend series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(posting_date, %(fmt)s) AS m,
           COALESCE(SUM(grand_total), 0) AS total
    FROM `tabPurchase Invoice`
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

# ---- Top suppliers by spend (last 12 months) ----
top_suppliers = frappe.db.sql("""
    SELECT pi.supplier AS name,
           COALESCE(s.supplier_name, pi.supplier) AS supplier_name,
           s.supplier_group AS supplier_group,
           COALESCE(SUM(pi.grand_total), 0) AS spend
    FROM `tabPurchase Invoice` pi
    LEFT JOIN `tabSupplier` s ON s.name = pi.supplier
    WHERE pi.docstatus = 1
      AND pi.is_return = 0
      AND pi.posting_date >= %(s)s
    GROUP BY pi.supplier
    ORDER BY spend DESC
    LIMIT 6
""", {"s": twelve_months_start}, as_dict=True)

# ---- Open POs list (top 6 by amount) ----
open_purchase_orders = frappe.db.sql("""
    SELECT name, supplier, supplier_name, status, grand_total, transaction_date
    FROM `tabPurchase Order`
    WHERE docstatus = 1
      AND status NOT IN ('Closed', 'Completed', 'Cancelled', 'Delivered')
    ORDER BY grand_total DESC
    LIMIT 6
""", as_dict=True)

# ---- Overdue invoice list (top 6 by outstanding) ----
overdue_invoices = frappe.db.sql("""
    SELECT name, supplier, supplier_name, due_date, outstanding_amount
    FROM `tabPurchase Invoice`
    WHERE docstatus = 1
      AND status = 'Overdue'
    ORDER BY outstanding_amount DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "spend_month": to_flt(spend_month),
        "spend_last_month": to_flt(spend_last),
        "spend_delta_pct": spend_delta_pct,
        "open_po_count": open_po.cnt or 0,
        "open_po_value": to_flt(open_po.total),
        "overdue_count": overdue.cnt or 0,
        "overdue_value": to_flt(overdue.total),
        "total_suppliers": active_suppliers or 0,
    },
    "spend_series": series,
    "top_suppliers": top_suppliers,
    "open_purchase_orders": open_purchase_orders,
    "overdue_invoices": overdue_invoices,
}
'''


PROJECTS_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Projects dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- KPIs ----
active_projects = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabProject`
    WHERE status = 'Open' AND docstatus < 2
""", as_dict=True)[0].cnt

open_tasks = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabTask`
    WHERE COALESCE(status, '') NOT IN ('Completed', 'Cancelled', 'Template')
      AND docstatus < 2
""", as_dict=True)[0].cnt

overdue_tasks = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabTask`
    WHERE COALESCE(status, '') NOT IN ('Completed', 'Cancelled', 'Template')
      AND docstatus < 2
      AND exp_end_date IS NOT NULL
      AND exp_end_date < %(t)s
""", {"t": today}, as_dict=True)[0].cnt

hours_month = frappe.db.sql("""
    SELECT COALESCE(SUM(total_hours), 0) AS total
    FROM `tabTimesheet`
    WHERE docstatus = 1
      AND start_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].total

hours_last = frappe.db.sql("""
    SELECT COALESCE(SUM(total_hours), 0) AS total
    FROM `tabTimesheet`
    WHERE docstatus = 1
      AND start_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].total

hours_delta_pct = None
if to_flt(hours_last) > 0:
    hours_delta_pct = ((to_flt(hours_month) - to_flt(hours_last)) / to_flt(hours_last)) * 100.0

billable_month = frappe.db.sql("""
    SELECT COALESCE(SUM(total_billable_amount), 0) AS total
    FROM `tabTimesheet`
    WHERE docstatus = 1
      AND start_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].total

# ---- Hours series (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(start_date, %(fmt)s) AS m,
           COALESCE(SUM(total_hours), 0) AS total
    FROM `tabTimesheet`
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

# ---- Top active projects (by progress, then deadline) ----
top_projects = frappe.db.sql("""
    SELECT name, project_name, status, priority, customer,
           percent_complete, expected_end_date
    FROM `tabProject`
    WHERE status = 'Open' AND docstatus < 2
    ORDER BY
      CASE WHEN expected_end_date IS NULL THEN 1 ELSE 0 END,
      expected_end_date ASC,
      modified DESC
    LIMIT 6
""", as_dict=True)

# ---- Overdue tasks ----
overdue_task_rows = frappe.db.sql("""
    SELECT name, subject, project, status, priority, exp_end_date
    FROM `tabTask`
    WHERE COALESCE(status, '') NOT IN ('Completed', 'Cancelled', 'Template')
      AND docstatus < 2
      AND exp_end_date IS NOT NULL
      AND exp_end_date < %(t)s
    ORDER BY exp_end_date ASC
    LIMIT 6
""", {"t": today}, as_dict=True)

# ---- Recent timesheets ----
recent_timesheets = frappe.db.sql("""
    SELECT name, title, employee_name, parent_project,
           total_hours, total_billable_amount, start_date, status
    FROM `tabTimesheet`
    WHERE docstatus < 2
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "active_projects": active_projects or 0,
        "open_tasks": open_tasks or 0,
        "overdue_tasks": overdue_tasks or 0,
        "hours_month": to_flt(hours_month),
        "hours_last_month": to_flt(hours_last),
        "hours_delta_pct": hours_delta_pct,
        "billable_month": to_flt(billable_month),
    },
    "hours_series": series,
    "top_projects": top_projects,
    "overdue_task_rows": overdue_task_rows,
    "recent_timesheets": recent_timesheets,
}
'''


QUALITY_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Quality dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Inspections this month ----
inspections_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabQuality Inspection`
    WHERE docstatus < 2
      AND report_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

inspections_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabQuality Inspection`
    WHERE docstatus < 2
      AND report_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

inspections_delta_pct = None
if to_flt(inspections_last) > 0:
    inspections_delta_pct = ((to_flt(inspections_month) - to_flt(inspections_last)) / to_flt(inspections_last)) * 100.0

# ---- Rejected inspections (last 12 months) ----
rejected_count = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabQuality Inspection`
    WHERE docstatus < 2
      AND status = 'Rejected'
      AND report_date >= %(s)s
""", {"s": twelve_months_start}, as_dict=True)[0].cnt

# ---- Open Non Conformances ----
open_nc_count = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabNon Conformance`
    WHERE docstatus < 2
      AND COALESCE(status, '') NOT IN ('Closed', 'Cancelled', 'Resolved')
""", as_dict=True)[0].cnt

# ---- Open Quality Actions ----
open_actions_count = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabQuality Action`
    WHERE docstatus < 2
      AND COALESCE(status, '') NOT IN ('Completed', 'Closed', 'Cancelled')
""", as_dict=True)[0].cnt

# ---- Inspection trend (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(report_date, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabQuality Inspection`
    WHERE docstatus < 2
      AND report_date >= %(s)s
    GROUP BY DATE_FORMAT(report_date, %(grp)s)
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

# ---- Recent inspections ----
recent_inspections = frappe.db.sql("""
    SELECT name, item_code, item_name, status, inspection_type, report_date
    FROM `tabQuality Inspection`
    WHERE docstatus < 2
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

# ---- Open Non Conformances ----
# `procedure` is a MariaDB reserved word — must be backtick-quoted.
open_non_conformances = frappe.db.sql("""
    SELECT name, `procedure` AS procedure_name, status, full_name, modified
    FROM `tabNon Conformance`
    WHERE docstatus < 2
      AND COALESCE(status, '') NOT IN ('Closed', 'Cancelled', 'Resolved')
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

# ---- Open Quality Actions ----
open_actions = frappe.db.sql("""
    SELECT name, `procedure` AS procedure_name, status, `date` AS action_date
    FROM `tabQuality Action`
    WHERE docstatus < 2
      AND COALESCE(status, '') NOT IN ('Completed', 'Closed', 'Cancelled')
    ORDER BY
      CASE WHEN `date` IS NULL THEN 1 ELSE 0 END,
      `date` ASC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "inspections_month": inspections_month or 0,
        "inspections_last": inspections_last or 0,
        "inspections_delta_pct": inspections_delta_pct,
        "rejected_count": rejected_count or 0,
        "open_nc_count": open_nc_count or 0,
        "open_actions_count": open_actions_count or 0,
    },
    "inspection_series": series,
    "recent_inspections": recent_inspections,
    "open_non_conformances": open_non_conformances,
    "open_actions": open_actions,
}
'''


STOCK_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Stock dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Inventory value (SUM of tabBin.stock_value across all warehouses) ----
inv_row = frappe.db.sql("""
    SELECT COALESCE(SUM(stock_value), 0) AS total
    FROM `tabBin`
""", as_dict=True)[0]
inventory_value = to_flt(inv_row.total)

# ---- Stock item count ----
stock_items = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabItem`
    WHERE is_stock_item = 1 AND disabled = 0
""", as_dict=True)[0].cnt

# ---- Pending material requests ----
pending_mr = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabMaterial Request`
    WHERE docstatus = 1
      AND COALESCE(status, '') NOT IN ('Stopped', 'Cancelled', 'Received', 'Issued', 'Transferred')
""", as_dict=True)[0].cnt

# ---- Stock entries (this month / last month) ----
se_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabStock Entry`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

se_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabStock Entry`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

se_delta_pct = None
if to_flt(se_last) > 0:
    se_delta_pct = ((to_flt(se_month) - to_flt(se_last)) / to_flt(se_last)) * 100.0

# ---- Stock entries trend (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(posting_date, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabStock Entry`
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

# ---- Top warehouses by stock value ----
top_warehouses = frappe.db.sql("""
    SELECT b.warehouse AS name,
           COALESCE(w.warehouse_name, b.warehouse) AS warehouse_name,
           w.company AS company,
           COALESCE(SUM(b.stock_value), 0) AS stock_value,
           COUNT(DISTINCT b.item_code) AS item_count
    FROM `tabBin` b
    LEFT JOIN `tabWarehouse` w ON w.name = b.warehouse
    WHERE COALESCE(w.disabled, 0) = 0
    GROUP BY b.warehouse
    HAVING stock_value > 0 OR item_count > 0
    ORDER BY stock_value DESC
    LIMIT 6
""", as_dict=True)

# ---- Pending material requests (list) ----
pending_mr_rows = frappe.db.sql("""
    SELECT name, material_request_type, status, transaction_date, schedule_date, company
    FROM `tabMaterial Request`
    WHERE docstatus = 1
      AND COALESCE(status, '') NOT IN ('Stopped', 'Cancelled', 'Received', 'Issued', 'Transferred')
    ORDER BY
      CASE WHEN schedule_date IS NULL THEN 1 ELSE 0 END,
      schedule_date ASC
    LIMIT 6
""", as_dict=True)

# ---- Recent stock entries ----
recent_stock_entries = frappe.db.sql("""
    SELECT name, stock_entry_type, purpose, posting_date, company
    FROM `tabStock Entry`
    WHERE docstatus < 2
    ORDER BY modified DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "inventory_value": inventory_value,
        "stock_items": stock_items or 0,
        "pending_mr": pending_mr or 0,
        "se_month": se_month or 0,
        "se_last": se_last or 0,
        "se_delta_pct": se_delta_pct,
    },
    "stock_entry_series": series,
    "top_warehouses": top_warehouses,
    "pending_material_requests": pending_mr_rows,
    "recent_stock_entries": recent_stock_entries,
}
'''


SUBCONTRACTING_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Subcontracting dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Open Subcontracting Orders (count + total value) ----
open_sco = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS total
    FROM `tabSubcontracting Order`
    WHERE docstatus = 1
      AND COALESCE(status, '') NOT IN ('Closed', 'Completed', 'Cancelled', 'Delivered')
""", as_dict=True)[0]

# ---- Receipts (this month / last month) ----
sr_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS total
    FROM `tabSubcontracting Receipt`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0]

sr_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabSubcontracting Receipt`
    WHERE docstatus = 1
      AND posting_date BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0]

sr_delta_pct = None
if to_flt(sr_last.cnt) > 0:
    sr_delta_pct = ((to_flt(sr_month.cnt) - to_flt(sr_last.cnt)) / to_flt(sr_last.cnt)) * 100.0

# ---- Active Subcontracting BOMs ----
active_boms = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabSubcontracting BOM`
    WHERE COALESCE(is_active, 1) = 1
""", as_dict=True)[0].cnt

# ---- Receipts trend (last 12 months, count) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(posting_date, %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabSubcontracting Receipt`
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

# ---- Top subcontract suppliers (last 12 months, by SCO total) ----
top_suppliers = frappe.db.sql("""
    SELECT sco.supplier AS name,
           COALESCE(s.supplier_name, sco.supplier) AS supplier_name,
           s.supplier_group AS supplier_group,
           COALESCE(SUM(sco.total), 0) AS spend,
           COUNT(*) AS order_count
    FROM `tabSubcontracting Order` sco
    LEFT JOIN `tabSupplier` s ON s.name = sco.supplier
    WHERE sco.docstatus = 1
      AND sco.transaction_date >= %(s)s
    GROUP BY sco.supplier
    ORDER BY spend DESC
    LIMIT 6
""", {"s": twelve_months_start}, as_dict=True)

# ---- Open Subcontracting Orders (list) ----
open_subcontracting_orders = frappe.db.sql("""
    SELECT name, supplier, supplier_name, status, total, transaction_date, schedule_date
    FROM `tabSubcontracting Order`
    WHERE docstatus = 1
      AND COALESCE(status, '') NOT IN ('Closed', 'Completed', 'Cancelled', 'Delivered')
    ORDER BY total DESC
    LIMIT 6
""", as_dict=True)

# ---- Recent receipts ----
recent_receipts = frappe.db.sql("""
    SELECT name, supplier, supplier_name, total, total_qty, posting_date
    FROM `tabSubcontracting Receipt`
    WHERE docstatus = 1
    ORDER BY posting_date DESC, modified DESC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "open_sco_count": open_sco.cnt or 0,
        "open_sco_value": to_flt(open_sco.total),
        "receipts_month": sr_month.cnt or 0,
        "receipts_value_month": to_flt(sr_month.total),
        "receipts_last": sr_last.cnt or 0,
        "receipts_delta_pct": sr_delta_pct,
        "active_boms": active_boms or 0,
    },
    "receipts_series": series,
    "top_suppliers": top_suppliers,
    "open_subcontracting_orders": open_subcontracting_orders,
    "recent_receipts": recent_receipts,
}
'''


MANUFACTURING_DASHBOARD_SCRIPT = r'''
# Server Script - Type: API
# Returns aggregated metrics for the custom Manufacturing dashboard.
# Sandbox-safe: only frappe.* APIs (no `import`, no built-in `float`).

today = frappe.utils.today()
month_start = frappe.utils.get_first_day(today)
last_month_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -1))
last_month_end = frappe.utils.get_last_day(frappe.utils.add_months(today, -1))
twelve_months_start = frappe.utils.get_first_day(frappe.utils.add_months(today, -11))

def to_flt(v):
    return frappe.utils.flt(v or 0)

# ---- Open Work Orders (count + total qty) ----
open_wo = frappe.db.sql("""
    SELECT COUNT(*) AS cnt, COALESCE(SUM(qty - produced_qty), 0) AS pending_qty
    FROM `tabWork Order`
    WHERE docstatus = 1
      AND COALESCE(status, '') IN ('Not Started', 'In Process')
""", as_dict=True)[0]

# ---- Active BOMs ----
active_boms = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabBOM`
    WHERE is_active = 1 AND docstatus = 1
""", as_dict=True)[0].cnt

# ---- Open Job Cards ----
open_jc = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabJob Card`
    WHERE docstatus < 2
      AND COALESCE(status, '') IN ('Open', 'Work In Progress', 'Material Transferred')
""", as_dict=True)[0].cnt

# ---- Completed Work Orders this month / last month ----
completed_month = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabWork Order`
    WHERE docstatus = 1
      AND status = 'Completed'
      AND DATE(actual_end_date) BETWEEN %(s)s AND %(e)s
""", {"s": month_start, "e": today}, as_dict=True)[0].cnt

completed_last = frappe.db.sql("""
    SELECT COUNT(*) AS cnt
    FROM `tabWork Order`
    WHERE docstatus = 1
      AND status = 'Completed'
      AND DATE(actual_end_date) BETWEEN %(s)s AND %(e)s
""", {"s": last_month_start, "e": last_month_end}, as_dict=True)[0].cnt

completed_delta_pct = None
if to_flt(completed_last) > 0:
    completed_delta_pct = ((to_flt(completed_month) - to_flt(completed_last)) / to_flt(completed_last)) * 100.0

# ---- Completed WOs trend (last 12 months) ----
series_rows = frappe.db.sql("""
    SELECT DATE_FORMAT(DATE(actual_end_date), %(fmt)s) AS m,
           COUNT(*) AS total
    FROM `tabWork Order`
    WHERE docstatus = 1
      AND status = 'Completed'
      AND DATE(actual_end_date) >= %(s)s
    GROUP BY DATE_FORMAT(DATE(actual_end_date), %(grp)s)
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

# ---- Top items being produced (last 12 months by qty) ----
top_items = frappe.db.sql("""
    SELECT wo.production_item AS name,
           COALESCE(i.item_name, wo.production_item) AS item_name,
           i.item_group AS item_group,
           COALESCE(SUM(wo.qty), 0) AS planned_qty,
           COALESCE(SUM(wo.produced_qty), 0) AS produced_qty,
           COUNT(*) AS order_count
    FROM `tabWork Order` wo
    LEFT JOIN `tabItem` i ON i.name = wo.production_item
    WHERE wo.docstatus = 1
      AND DATE(COALESCE(wo.planned_start_date, wo.creation)) >= %(s)s
    GROUP BY wo.production_item
    ORDER BY produced_qty DESC, planned_qty DESC
    LIMIT 6
""", {"s": twelve_months_start}, as_dict=True)

# ---- Open Work Orders list ----
open_work_orders = frappe.db.sql("""
    SELECT name, production_item, status, qty, produced_qty,
           planned_start_date, planned_end_date
    FROM `tabWork Order`
    WHERE docstatus = 1
      AND COALESCE(status, '') IN ('Not Started', 'In Process')
    ORDER BY
      CASE WHEN planned_end_date IS NULL THEN 1 ELSE 0 END,
      planned_end_date ASC
    LIMIT 6
""", as_dict=True)

# ---- Open Job Cards ----
open_job_cards = frappe.db.sql("""
    SELECT name, production_item, operation, workstation, status,
           expected_start_date, expected_end_date
    FROM `tabJob Card`
    WHERE docstatus < 2
      AND COALESCE(status, '') IN ('Open', 'Work In Progress', 'Material Transferred')
    ORDER BY
      CASE WHEN expected_end_date IS NULL THEN 1 ELSE 0 END,
      expected_end_date ASC
    LIMIT 6
""", as_dict=True)

frappe.response["message"] = {
    "stats": {
        "open_wo_count": open_wo.cnt or 0,
        "open_wo_pending_qty": to_flt(open_wo.pending_qty),
        "active_boms": active_boms or 0,
        "open_jc": open_jc or 0,
        "completed_month": completed_month or 0,
        "completed_last": completed_last or 0,
        "completed_delta_pct": completed_delta_pct,
    },
    "completed_series": series,
    "top_items": top_items,
    "open_work_orders": open_work_orders,
    "open_job_cards": open_job_cards,
}
'''


def _upsert_server_script(name: str, script: str):
    if frappe.db.exists("Server Script", name):
        doc = frappe.get_doc("Server Script", name)
    else:
        doc = frappe.new_doc("Server Script")
        doc.name = name

    doc.script_type = "API"
    doc.api_method = name
    doc.allow_guest = 0
    doc.disabled = 0
    doc.script = script
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    print("OK: Server Script '{}' installed (script_type=API).".format(name))


def install_assets_dashboard():
    _upsert_server_script("assets_dashboard_data", ASSETS_DASHBOARD_SCRIPT)


def install_buying_dashboard():
    _upsert_server_script("buying_dashboard_data", BUYING_DASHBOARD_SCRIPT)


def install_projects_dashboard():
    _upsert_server_script("projects_dashboard_data", PROJECTS_DASHBOARD_SCRIPT)


def install_quality_dashboard():
    _upsert_server_script("quality_dashboard_data", QUALITY_DASHBOARD_SCRIPT)


def install_stock_dashboard():
    _upsert_server_script("stock_dashboard_data", STOCK_DASHBOARD_SCRIPT)


def install_subcontracting_dashboard():
    _upsert_server_script("subcontracting_dashboard_data", SUBCONTRACTING_DASHBOARD_SCRIPT)


def install_manufacturing_dashboard():
    _upsert_server_script("manufacturing_dashboard_data", MANUFACTURING_DASHBOARD_SCRIPT)


def install_all():
    install_assets_dashboard()
    install_buying_dashboard()
    install_projects_dashboard()
    install_quality_dashboard()
    install_stock_dashboard()
    install_subcontracting_dashboard()
    install_manufacturing_dashboard()
