frappe.pages['hr-dashboard'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('HR Dashboard'),
		single_column: true,
	});
	page.main.addClass('ce-dashboard');
	page.wrapper.find('.page-head').hide();
	new HRDashboard(page).render();
};

class HRDashboard {
	constructor(page) {
		this.page = page;
		this.container = $(page.main);
		this.today = frappe.datetime.get_today();
		this.month_start = frappe.datetime.month_start();
	}

	render() {
		this.container.empty();
		this.container.append(`
			<div class="ce-hero ce-hero-hr">
				<div class="ce-hero-inner">
					<div class="ce-hero-text">
						<div class="ce-hero-eyebrow">${__('Human Resources')}</div>
						<h1 class="ce-hero-title">${__('HR Overview')}</h1>
						<div class="ce-hero-sub">${this.greeting()} &middot; ${frappe.datetime.global_date_format(this.today)}</div>
					</div>
					<div class="ce-hero-actions">
						<button class="btn btn-light ce-hero-btn" data-action="new-employee">
							<span class="ce-ic">👤</span> ${__('New Employee')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-leave">
							<span class="ce-ic">🏖️</span> ${__('Leave Application')}
						</button>
						<button class="btn btn-light ce-hero-btn" data-action="new-attendance">
							<span class="ce-ic">📝</span> ${__('Mark Attendance')}
						</button>
					</div>
				</div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Workforce snapshot')}</div>
				<div class="ce-stats" id="ce-stats"></div>
			</div>

			<div class="ce-section">
				<div class="ce-section-head">${__('Quick actions')}</div>
				<div class="ce-quick-grid" id="ce-quick"></div>
			</div>

			<div class="ce-split">
				<div class="ce-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__('Pending leave approvals')}</div>
						<a class="ce-panel-link" href="/app/leave-application?status=Open">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-leaves-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>

				<div class="ce-panel">
					<div class="ce-panel-head">
						<div class="ce-panel-title">${__("Today's attendance")}</div>
						<a class="ce-panel-link" href="/app/attendance?attendance_date=${this.today}">${__('View all')} →</a>
					</div>
					<div class="ce-panel-body" id="ce-attendance-body">
						<div class="ce-skeleton"></div>
						<div class="ce-skeleton"></div>
					</div>
				</div>
			</div>
		`);

		this.bindActions();
		this.renderStats();
		this.renderQuickActions();
		this.loadPendingLeaves();
		this.loadAttendance();
	}

	greeting() {
		const h = new Date().getHours();
		if (h < 12) return __('Good morning');
		if (h < 18) return __('Good afternoon');
		return __('Good evening');
	}

	bindActions() {
		this.container.find('[data-action="new-employee"]').on('click', () => frappe.new_doc('Employee'));
		this.container.find('[data-action="new-leave"]').on('click', () => frappe.new_doc('Leave Application'));
		this.container.find('[data-action="new-attendance"]').on('click', () => frappe.new_doc('Attendance'));
	}

	renderStats() {
		const stats = [
			{ key: 'active_employees', label: __('Active employees'),   doctype: 'Employee',          filters: { status: 'Active' },                         icon: '👥', tone: 'indigo', href: '/app/employee?status=Active' },
			{ key: 'attendance_today', label: __('Attendance today'),   doctype: 'Attendance',        filters: { attendance_date: this.today, status: 'Present' }, icon: '✅', tone: 'teal',   href: `/app/attendance?attendance_date=${this.today}` },
			{ key: 'pending_leaves',   label: __('Pending leaves'),     doctype: 'Leave Application', filters: { status: 'Open' },                           icon: '🏖️', tone: 'amber',  href: '/app/leave-application?status=Open' },
			{ key: 'open_jobs',        label: __('Open job postings'),  doctype: 'Job Opening',       filters: { status: 'Open' },                           icon: '💼', tone: 'violet', href: '/app/job-opening?status=Open' },
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
			{ label: __('Employees'),        icon: '👥', tone: 'indigo', href: '/app/employee' },
			{ label: __('Attendance'),       icon: '📋', tone: 'teal',   href: '/app/attendance' },
			{ label: __('Leave Apps'),       icon: '🏖️', tone: 'amber',  href: '/app/leave-application' },
			{ label: __('Salary Slips'),     icon: '💰', tone: 'violet', href: '/app/salary-slip' },
			{ label: __('Payroll Entry'),    icon: '🧾', tone: 'rose',   href: '/app/payroll-entry' },
			{ label: __('Job Openings'),     icon: '💼', tone: 'indigo', href: '/app/job-opening' },
			{ label: __('Job Applications'), icon: '📨', tone: 'teal',   href: '/app/job-applicant' },
			{ label: __('Appraisals'),       icon: '⭐', tone: 'amber',  href: '/app/appraisal' },
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

	loadPendingLeaves() {
		frappe.db.get_list('Leave Application', {
			filters: { status: 'Open' },
			fields: ['name', 'employee_name', 'leave_type', 'from_date', 'to_date', 'total_leave_days'],
			order_by: 'from_date asc',
			limit: 6,
		}).then((rows) => {
			const body = this.container.find('#ce-leaves-body').empty();
			if (!rows.length) { body.html(`<div class="ce-empty">${__('No pending leave requests')}</div>`); return; }
			rows.forEach((r) => {
				body.append(`
					<a class="ce-list-row" href="/app/leave-application/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">🏖️</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${frappe.utils.escape_html(r.employee_name || r.name)}</div>
							<div class="ce-list-sub">${frappe.utils.escape_html(r.leave_type || '')} &middot; ${frappe.datetime.str_to_user(r.from_date)} → ${frappe.datetime.str_to_user(r.to_date)}</div>
						</div>
						<div class="ce-pill ce-pill-amber">${r.total_leave_days || 0}d</div>
					</a>
				`);
			});
		}).catch(() => {
			this.container.find('#ce-leaves-body').html(`<div class="ce-empty">${__('Unable to load leaves')}</div>`);
		});
	}

	loadAttendance() {
		frappe.db.get_list('Attendance', {
			filters: { attendance_date: this.today },
			fields: ['name', 'employee_name', 'status', 'in_time', 'out_time'],
			order_by: 'in_time asc',
			limit: 6,
		}).then((rows) => {
			const body = this.container.find('#ce-attendance-body').empty();
			if (!rows.length) { body.html(`<div class="ce-empty">${__('No attendance records today')}</div>`); return; }
			rows.forEach((r) => {
				const tone = (r.status === 'Present') ? 'green' : (r.status === 'Absent' ? 'red' : 'gray');
				body.append(`
					<a class="ce-list-row" href="/app/attendance/${encodeURIComponent(r.name)}">
						<div class="ce-list-badge">👤</div>
						<div class="ce-list-main">
							<div class="ce-list-title">${frappe.utils.escape_html(r.employee_name || r.name)}</div>
							<div class="ce-list-sub">${this.fmtTime(r.in_time)} — ${this.fmtTime(r.out_time)}</div>
						</div>
						<div class="ce-pill ce-pill-${tone}">${frappe.utils.escape_html(r.status || '')}</div>
					</a>
				`);
			});
		}).catch(() => {
			this.container.find('#ce-attendance-body').html(`<div class="ce-empty">${__('Unable to load attendance')}</div>`);
		});
	}

	fmtTime(t) {
		if (!t) return '—';
		const d = new Date(t);
		if (!isNaN(d)) return d.toTimeString().slice(0, 5);
		const parts = String(t).split(':');
		return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : t;
	}
}
