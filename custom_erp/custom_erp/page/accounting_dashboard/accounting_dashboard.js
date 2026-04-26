frappe.pages['accounting-dashboard'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Accounting Dashboard'),
		single_column: true,
	});
	page.main.addClass('ce-dashboard');
	page.wrapper.find('.page-head').hide();
	new AccountingDashboard(page).render();
};

class AccountingDashboard {
	constructor(page) {
		this.page = page;
		this.container = $(page.main);
		this.today = frappe.datetime.get_today();
		this.month_start = frappe.datetime.month_start();
	}

	render() {
		this.container.empty();
		this.container.append(`
			<div class="ce-hero ce-hero-acc">
				<div class="ce-hero-inner">
					<div class="ce-hero-text">
						<div class="ce-hero-eyebrow">${__('Accounting')}</div>
						<h1 class="ce-hero-title">${__('Finance Overview')}</h1>
						<div class="ce-hero-sub">${frappe.datetime.global_date_format(this.today)}</div>
					</div>
					<div class="ce-hero-actions">
						<button class="btn btn-light ce-hero-btn" data-action="new-sales-invoice">
							<span class="ce-ic">🧾</span> ${__('Sales Invoice')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-purchase-invoice">
							<span class="ce-ic">📥</span> ${__('Purchase Invoice')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-payment">
							<span class="ce-ic">💳</span> ${__('Payment Entry')}
						</button>
					</div>
				</div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Financial snapshot')}</div>
				<div class="ce-stats" id="ce-stats"></div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Quick actions')}</div>
				<div class="ce-quick-grid" id="ce-quick"></div>
			</div>

			<div class="ce-split">
				<div class="ce-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__('Overdue sales invoices')}</div>
						<a class="ce-panel-link" href="/app/sales-invoice?status=Overdue">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-overdue-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>

				<div class="ce-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__('Recent payments')}</div>
						<a class="ce-panel-link" href="/app/payment-entry">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-payments-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>
			</div>
		`);

		this.bindActions();
		this.renderStats();
		this.renderQuickActions();
		this.loadOverdue();
		this.loadPayments();
	}

	bindActions() {
		this.container.find('[data-action="new-sales-invoice"]').on('click', () => frappe.new_doc('Sales Invoice'));
		this.container.find('[data-action="new-purchase-invoice"]').on('click', () => frappe.new_doc('Purchase Invoice'));
		this.container.find('[data-action="new-payment"]').on('click', () => frappe.new_doc('Payment Entry'));
	}

	renderStats() {
		const stats = [
			{ key: 'unpaid_sales',    label: __('Unpaid sales invoices'),     doctype: 'Sales Invoice',    filters: { status: ['in', ['Unpaid', 'Overdue', 'Partly Paid']], docstatus: 1 }, icon: '🧾', tone: 'indigo', href: '/app/sales-invoice?status=Unpaid' },
			{ key: 'overdue_sales',   label: __('Overdue sales invoices'),    doctype: 'Sales Invoice',    filters: { status: 'Overdue', docstatus: 1 },                                   icon: '⚠️', tone: 'rose',   href: '/app/sales-invoice?status=Overdue' },
			{ key: 'unpaid_purchase', label: __('Unpaid purchase invoices'),  doctype: 'Purchase Invoice', filters: { status: ['in', ['Unpaid', 'Overdue', 'Partly Paid']], docstatus: 1 }, icon: '📥', tone: 'violet', href: '/app/purchase-invoice?status=Unpaid' },
			{ key: 'payments_today',  label: __('Payments today'),            doctype: 'Payment Entry',    filters: { posting_date: this.today, docstatus: 1 },                            icon: '💳', tone: 'teal',   href: `/app/payment-entry?posting_date=${this.today}` },
		];
		const wrap = this.container.find('#ce-stats');
		stats.forEach((s) => {
			wrap.append(`
				<a class="ce-stat ce-stat-${s.tone}" href="${s.href}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${s.label}</div>
						<div class="ce-stat-value" id="ce-stat-${s.key}"><span class="ce-stat-skeleton"></span></div>
					</div>
				</a>
			`);
			frappe.db.count(s.doctype, { filters: s.filters })
				.then((c) => this.container.find(`#ce-stat-${s.key}`).html(frappe.format(c, { fieldtype: 'Int' })))
				.catch(() => this.container.find(`#ce-stat-${s.key}`).html('—'));
		});
	}

	renderQuickActions() {
		const actions = [
			{ label: __('Sales Invoices'),    icon: '🧾', tone: 'indigo', href: '/app/sales-invoice' },
			{ label: __('Purchase Invoices'), icon: '📥', tone: 'teal',   href: '/app/purchase-invoice' },
			{ label: __('Payment Entries'),   icon: '💳', tone: 'violet', href: '/app/payment-entry' },
			{ label: __('Journal Entries'),   icon: '📒', tone: 'amber',  href: '/app/journal-entry' },
			{ label: __('Customers'),         icon: '🧑‍💼', tone: 'rose',  href: '/app/customer' },
			{ label: __('Suppliers'),         icon: '🏭', tone: 'slate',  href: '/app/supplier' },
			{ label: __('Chart of Accounts'), icon: '📊', tone: 'indigo', href: '/app/account/view/tree' },
			{ label: __('Accounts Reports'),  icon: '📈', tone: 'teal',   href: '/app/query-report/Accounts%20Receivable' },
		];
		const wrap = this.container.find('#ce-quick');
		actions.forEach((a) => {
			wrap.append(`
				<a class="ce-quick ce-quick-${a.tone}" href="${a.href}">
					<div class="ce-quick-icon">${a.icon}</div>
					<div class="ce-quick-label">${a.label}</div>
				</a>
			`);
		});
	}

	loadOverdue() {
		frappe.db.get_list('Sales Invoice', {
			filters: { status: 'Overdue', docstatus: 1 },
			fields: ['name', 'customer_name', 'grand_total', 'outstanding_amount', 'due_date', 'currency'],
			order_by: 'due_date asc',
			limit: 6,
		}).then((rows) => {
			const body = this.container.find('#ce-overdue-body').empty();
			if (!rows.length) { body.html(`<div class="ce-empty">${__('No overdue invoices 🎉')}</div>`); return; }
			rows.forEach((r) => {
				body.append(`
					<a class="ce-list-row" href="/app/sales-invoice/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">⚠️</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${frappe.utils.escape_html(r.customer_name || r.name)}</div>
							<div class="ce-list-sub">${__('Due')} ${frappe.datetime.str_to_user(r.due_date)}</div>
						</div>
						<div class="ce-pill ce-pill-red">${format_currency(r.outstanding_amount, r.currency)}</div>
					</a>
				`);
			});
		}).catch(() => {
			this.container.find('#ce-overdue-body').html(`<div class="ce-empty">${__('Unable to load invoices')}</div>`);
		});
	}

	loadPayments() {
		frappe.db.get_list('Payment Entry', {
			filters: { docstatus: 1 },
			fields: ['name', 'party', 'paid_amount', 'posting_date', 'payment_type', 'paid_from_account_currency'],
			order_by: 'posting_date desc, creation desc',
			limit: 6,
		}).then((rows) => {
			const body = this.container.find('#ce-payments-body').empty();
			if (!rows.length) { body.html(`<div class="ce-empty">${__('No payments yet')}</div>`); return; }
			rows.forEach((r) => {
				const tone = r.payment_type === 'Receive' ? 'green' : 'indigo';
				body.append(`
					<a class="ce-list-row" href="/app/payment-entry/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">💳</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${frappe.utils.escape_html(r.party || r.name)}</div>
							<div class="ce-list-sub">${frappe.datetime.str_to_user(r.posting_date)} &middot; ${frappe.utils.escape_html(r.payment_type || '')}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${format_currency(r.paid_amount, r.paid_from_account_currency)}</div>
					</a>
				`);
			});
		}).catch(() => {
			this.container.find('#ce-payments-body').html(`<div class="ce-empty">${__('Unable to load payments')}</div>`);
		});
	}
}
