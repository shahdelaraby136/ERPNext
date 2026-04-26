import json
import frappe


def create_workspace():
	name = "Custom ERP"
	if frappe.db.exists("Workspace", name):
		frappe.delete_doc("Workspace", name, force=1)
		frappe.db.commit()

	content = json.dumps(
		[
			{
				"id": "hdr1",
				"type": "header",
				"data": {"text": '<span class="h4"><b>Custom ERP</b></span>', "col": 12},
			},
			{"id": "sp1", "type": "spacer", "data": {"col": 12}},
			{"id": "cd1", "type": "card", "data": {"card_name": "Healthcare", "col": 4}},
			{"id": "cd2", "type": "card", "data": {"card_name": "Laboratory", "col": 4}},
			{"id": "cd3", "type": "card", "data": {"card_name": "Items & Pricing", "col": 4}},
		]
	)

	ws = frappe.get_doc(
		{
			"doctype": "Workspace",
			"title": name,
			"label": name,
			"module": "Custom ERP",
			"public": 1,
			"is_hidden": 0,
			"icon": "heart",
			"sequence_id": 100.0,
			"content": content,
			"shortcuts": [
				{"link_to": "Healthcare Practitioner", "type": "DocType", "label": "Doctors", "color": "Blue"},
				{"link_to": "Medical Department", "type": "DocType", "label": "Departments", "color": "Blue"},
				{"link_to": "Patient Appointment", "type": "DocType", "label": "Appointments", "color": "Blue"},
				{"link_to": "Patient Encounter", "type": "DocType", "label": "Encounters", "color": "Blue"},
				{"link_to": "Lab Test", "type": "DocType", "label": "Lab Tests", "color": "Blue"},
				{"link_to": "Item", "type": "DocType", "label": "Items", "color": "Blue"},
			],
			"links": [
				{"label": "Healthcare", "type": "Card Break", "link_count": 6, "hidden": 0},
				{"label": "Healthcare Practitioner", "link_to": "Healthcare Practitioner", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Medical Department", "link_to": "Medical Department", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Healthcare Service Unit", "link_to": "Healthcare Service Unit", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Healthcare Service Unit Type", "link_to": "Healthcare Service Unit Type", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Appointment Type", "link_to": "Appointment Type", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Practitioner Schedule", "link_to": "Practitioner Schedule", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Laboratory", "type": "Card Break", "link_count": 4, "hidden": 0},
				{"label": "Lab Test Template", "link_to": "Lab Test Template", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Lab Test", "link_to": "Lab Test", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Lab Test Sample", "link_to": "Lab Test Sample", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Lab Test UOM", "link_to": "Lab Test UOM", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Items & Pricing", "type": "Card Break", "link_count": 2, "hidden": 0},
				{"label": "Item", "link_to": "Item", "link_type": "DocType", "type": "Link", "hidden": 0},
				{"label": "Item Price", "link_to": "Item Price", "link_type": "DocType", "type": "Link", "hidden": 0},
			],
		}
	)
	ws.flags.ignore_permissions = True
	ws.insert(ignore_permissions=True)
	frappe.db.commit()
	print("INSERTED:", ws.name, "| exists:", frappe.db.exists("Workspace", ws.name))
