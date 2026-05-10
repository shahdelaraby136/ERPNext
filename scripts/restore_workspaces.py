"""
Restore any custom_erp workspaces that got deleted as 'orphan' during migrate.
Reads custom_erp/fixtures/workspace.json and re-inserts missing workspaces.
"""

import json
import frappe


def run():
    fixture_path = "/home/frappe/frappe-bench/apps/custom_erp/custom_erp/fixtures/workspace.json"

    try:
        with open(fixture_path) as f:
            workspaces = json.load(f)
    except FileNotFoundError:
        print("  no workspace fixture found, skipping")
        return

    restored = []
    skipped = []
    failed = []

    for w in workspaces:
        name = w.get("name")
        if not name:
            continue

        if frappe.db.exists("Workspace", name):
            skipped.append(name)
            continue

        payload = {k: v for k, v in w.items() if not k.startswith("_")}
        payload["doctype"] = "Workspace"

        try:
            doc = frappe.get_doc(payload)
            doc.insert(ignore_permissions=True)
            restored.append(name)
        except Exception as e:
            failed.append((name, str(e)[:100]))

    if restored:
        frappe.db.commit()

    print(f"  Restored: {len(restored)} | Already present: {len(skipped)} | Failed: {len(failed)}")
    for r in restored:
        print(f"    + {r}")
    for n, err in failed:
        print(f"    ! {n}: {err}")
