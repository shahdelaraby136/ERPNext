frappe.pages['custom-erp-dashboard'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Custom ERP Dashboard'),
		single_column: true,
	});

	page.main.addClass('ce-dashboard');
	page.wrapper.find('.page-head').hide();

	const dashboard = new CustomERPDashboard(page);
	dashboard.render();
};

class CustomERPDashboard {
	constructor(page) {
		this.page = page;
		this.container = $(page.main);
		this.today = frappe.datetime.get_today();
	}

	render() {
		this.container.empty();
		this.container.append(`
			<div class="ce-hero">
				<div class="ce-hero-inner">
					<div class="ce-hero-text">
						<div class="ce-hero-eyebrow">${__('Welcome back')}</div>
						<h1 class="ce-hero-title">${frappe.session.user_fullname || frappe.session.user}</h1>
						<div class="ce-hero-sub">${this.greeting()} &middot; ${frappe.datetime.global_date_format(this.today)}</div>
					</div>
					<div class="ce-hero-actions">
						<button class="btn btn-light ce-hero-btn" data-action="new-appointment">
							<span class="ce-ic">📅</span> ${__('New Appointment')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-lab-test">
							<span class="ce-ic">🧪</span> ${__('New Lab Test')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-patient">
							<span class="ce-ic">🧑‍⚕️</span> ${__('New Patient')}
						</button>
					</div>
				</div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Today at a glance')}</div>
				<div class="ce-stats" id="ce-stats"></div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Quick actions')}</div>
				<div class="ce-quick-grid" id="ce-quick"></div>
			</div>

			<div class="ce-split">
				<div class="ce-panel" id="ce-appointments-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__("Today's appointments")}</div>
						<a class="ce-panel-link" href="/app/patient-appointment?appointment_date=${this.today}">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-appointments-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>

				<div class="ce-panel" id="ce-labtests-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__('Recent lab tests')}</div>
						<a class="ce-panel-link" href="/app/lab-test">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-labtests-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>
			</div>
		`);

		this.bindActions();
		this.renderStats();
		this.renderQuickActions();
		this.loadAppointments();
		this.loadLabTests();
	}

	greeting() {
		const h = new Date().getHours();
		if (h < 12) return __('Good morning');
		if (h < 18) return __('Good afternoon');
		return __('Good evening');
	}

	bindActions() {
		this.container.find('[data-action="new-appointment"]').on('click', () =>
			frappe.new_doc('Patient Appointment')
		);
		this.container.find('[data-action="new-lab-test"]').on('click', () =>
			frappe.new_doc('Lab Test')
		);
		this.container.find('[data-action="new-patient"]').on('click', () =>
			frappe.new_doc('Patient')
		);
	}

	renderStats() {
		const stats = [
			{
				key: 'appointments_today',
				label: __("Appointments today"),
				doctype: 'Patient Appointment',
				filters: { appointment_date: this.today },
				icon: '📅',
				tone: 'indigo',
				href: `/app/patient-appointment?appointment_date=${this.today}`,
			},
			{
				key: 'pending_labs',
				label: __('Lab tests pending'),
				doctype: 'Lab Test',
				filters: { status: ['in', ['Pending', 'In Progress']] },
				icon: '🧪',
				tone: 'teal',
				href: '/app/lab-test?status=Pending',
			},
			{
				key: 'active_patients',
				label: __('Active patients'),
				doctype: 'Patient',
				filters: { status: 'Active' },
				icon: '🧑‍⚕️',
				tone: 'violet',
				href: '/app/patient?status=Active',
			},
			{
				key: 'encounters_today',
				label: __('Encounters today'),
				doctype: 'Patient Encounter',
				filters: { encounter_date: this.today },
				icon: '🩺',
				tone: 'amber',
				href: `/app/patient-encounter?encounter_date=${this.today}`,
			},
		];

		const wrap = this.container.find('#ce-stats');
		stats.forEach((s) => {
			wrap.append(`
				<a class="ce-stat ce-stat-${s.tone}" href="${s.href}" data-key="${s.key}">
					<div class="ce-stat-icon">${s.icon}</div>
					<div class="ce-stat-body">
						<div class="ce-stat-label">${s.label}</div>
						<div class="ce-stat-value" id="ce-stat-${s.key}">
							<span class="ce-stat-skeleton"></span>
						</div>
					</div>
				</a>
			`);

			frappe
				.db
				.count(s.doctype, { filters: s.filters })
				.then((count) => {
					this.container
						.find(`#ce-stat-${s.key}`)
						.html(frappe.format(count, { fieldtype: 'Int' }));
				})
				.catch(() => {
					this.container.find(`#ce-stat-${s.key}`).html('—');
				});
		});
	}

	renderQuickActions() {
		const actions = [
			{ label: __('Doctors'),        icon: '🧑‍⚕️', tone: 'indigo',  href: '/app/healthcare-practitioner' },
			{ label: __('Appointments'),   icon: '📅',    tone: 'teal',    href: '/app/patient-appointment' },
			{ label: __('Encounters'),     icon: '🩺',    tone: 'violet',  href: '/app/patient-encounter' },
			{ label: __('Lab Tests'),      icon: '🧪',    tone: 'amber',   href: '/app/lab-test' },
			{ label: __('Patients'),       icon: '👥',    tone: 'rose',    href: '/app/patient' },
			{ label: __('Departments'),    icon: '🏥',    tone: 'slate',   href: '/app/medical-department' },
			{ label: __('Lab Templates'),  icon: '📋',    tone: 'indigo',  href: '/app/lab-test-template' },
			{ label: __('Items & Pricing'), icon: '💊',   tone: 'teal',    href: '/app/item' },
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

	loadAppointments() {
		frappe
			.db
			.get_list('Patient Appointment', {
				filters: { appointment_date: this.today },
				fields: ['name', 'patient_name', 'practitioner', 'appointment_time', 'status'],
				order_by: 'appointment_time asc',
				limit: 6,
			})
			.then((rows) => {
				const body = this.container.find('#ce-appointments-body').empty();
				if (!rows.length) {
					body.html(this.emptyState(__('No appointments today')));
					return;
				}
				rows.forEach((r) => {
					body.append(`
						<a class="ce-list-row" href="/app/patient-appointment/${encodeURIComponent(r.name)}">
							<div class="ce-list-time">${this.fmtTime(r.appointment_time)}</div>
							<div class="ce-list-main">
								<div class="ce-list-title">${frappe.utils.escape_html(r.patient_name || r.name)}</div>
								<div class="ce-list-sub">${frappe.utils.escape_html(r.practitioner || '')}</div>
							</div>
							<div class="ce-pill ce-pill-${this.statusTone(r.status)}">${frappe.utils.escape_html(r.status || '')}</div>
						</a>
					`);
				});
			})
			.catch(() => {
				this.container
					.find('#ce-appointments-body')
					.html(this.emptyState(__('Unable to load appointments')));
			});
	}

	loadLabTests() {
		frappe
			.db
			.get_list('Lab Test', {
				fields: ['name', 'patient_name', 'template', 'status', 'result_date'],
				order_by: 'modified desc',
				limit: 6,
			})
			.then((rows) => {
				const body = this.container.find('#ce-labtests-body').empty();
				if (!rows.length) {
					body.html(this.emptyState(__('No lab tests yet')));
					return;
				}
				rows.forEach((r) => {
					body.append(`
						<a class="ce-list-row" href="/app/lab-test/${encodeURIComponent(r.name)}">
							<div class="ce-list-badge">🧪</div>
							<div class="ce-list-main">
								<div class="ce-list-title">${frappe.utils.escape_html(r.patient_name || r.name)}</div>
								<div class="ce-list-sub">${frappe.utils.escape_html(r.template || '')}</div>
							</div>
							<div class="ce-pill ce-pill-${this.statusTone(r.status)}">${frappe.utils.escape_html(r.status || '')}</div>
						</a>
					`);
				});
			})
			.catch(() => {
				this.container
					.find('#ce-labtests-body')
					.html(this.emptyState(__('Unable to load lab tests')));
			});
	}

	statusTone(status) {
		const s = (status || '').toLowerCase();
		if (['completed', 'closed', 'approved', 'finalized'].includes(s)) return 'green';
		if (['cancelled', 'rejected'].includes(s)) return 'red';
		if (['in progress', 'scheduled', 'open'].includes(s)) return 'indigo';
		return 'gray';
	}

	fmtTime(t) {
		if (!t) return '—';
		const parts = String(t).split(':');
		if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
		return t;
	}

	emptyState(text) {
		return `<div class="ce-empty">${text}</div>`;
	}
}
