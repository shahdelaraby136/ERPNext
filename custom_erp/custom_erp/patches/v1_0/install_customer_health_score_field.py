"""Add Customer.customer_health_score Custom Field used by the Selling dashboard.

Idempotent: safe to re-run on every migrate.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


def execute():
    if not frappe.db.exists("DocType", "Customer"):
        return

    create_custom_field(
        "Customer",
        {
            "fieldname": "customer_health_score",
            "label": "Customer Health Score",
            "fieldtype": "Float",
            "insert_after": "customer_group",
            "default": 0,
            "precision": 1,
            "description": "0–100 score used by the custom Selling dashboard. Higher = healthier.",
            "in_list_view": 0,
            "in_standard_filter": 1,
            "read_only": 0,
            "no_copy": 1,
        },
    )

    frappe.db.commit()
