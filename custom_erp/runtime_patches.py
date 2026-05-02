import frappe

_patches_applied = False


def apply_runtime_patches():
	global _patches_applied
	if _patches_applied:
		return
	_patch_item_wise_sales_history_default_company()
	_patches_applied = True


def _patch_item_wise_sales_history_default_company():
	# ERPNext's Item-wise Sales History report calls
	# get_descendants_of("Company", filters.get("company")) which raises
	# `TypeError: cannot unpack non-iterable NoneType object` when the
	# Selling dashboard chart runs it without a company filter.
	try:
		import erpnext.selling.report.item_wise_sales_history.item_wise_sales_history as mod
	except ImportError:
		return

	if getattr(mod, "_custom_erp_default_company_patch", False):
		return

	original_execute = mod.execute

	def execute(filters=None):
		filters = frappe._dict(filters or {})
		if not filters.get("company"):
			fallback = (
				frappe.defaults.get_user_default("Company")
				or frappe.db.get_single_value("Global Defaults", "default_company")
			)
			if not fallback:
				companies = frappe.get_all("Company", pluck="name", limit=1)
				fallback = companies[0] if companies else None
			if not fallback:
				return [], []
			filters["company"] = fallback
		return original_execute(filters)

	mod.execute = execute
	mod._custom_erp_default_company_patch = True
