/* Custom Recruitment Workspace Redesign — same brand theme as the other hubs.
   Hijacks /app/recruitment and renders Hero + KPIs + chart + lists.
   Data comes from Server Script: hr_recruitment_dashboard_data
*/

(function () {
	const TAG = '[ce-recr]';
	const log = (...a) => { try { console.log(TAG, ...a); } catch (e) {} };

	log('script loaded');

	const BRAND_PALETTE = {
		primary: '#2563EB',
		dark:    '#1E40AF',
		accent:  '#3B82F6',
	};

	function isRecrPath() {
		try {
			const r = (window.frappe && frappe.get_route && frappe.get_route()) || [];
			const path = (window.location.pathname || '');
			const hash = (window.location.hash || '');
			for (let i = 0; i < Math.min(r.length, 3); i++) {
				const seg = (r[i] || '').toString().toLowerCase();
				if (seg === 'recruitment') return true;
			}
			const p = path.toLowerCase();
			if (p === '/app/recruitment' || p.startsWith('/app/recruitment/') || p.startsWith('/app/recruitment?')) return true;
			const h = hash.toLowerCase();
			if (h.includes('/recruitment')) return true;
			return false;
		} catch (e) { log('route check error', e); return false; }
	}

	let observer = null;
	let mounted = false;

	function findHost() {
		const candidates = [
			'.layout-main-section .desk-page',
			'.layout-main-section .codex-editor',
			'.layout-main-section .workspace-tab',
			'.layout-main-section .container',
			'.layout-main-section',
		];
		for (const sel of candidates) {
			const el = document.querySelector(sel);
			if (el) return { el, sel };
		}
		return null;
	}

	function ensureBodyFlag(on) {
		document.body.classList.toggle('ce-recr-active', !!on);
	}

	function mount() {
		const found = findHost();
		if (!found) { log('no host yet, will retry'); return false; }
		log('mount target:', found.sel);

		const layout = document.querySelector('.layout-main-section');
		if (!layout) return false;

		let root = layout.querySelector(':scope > .ce-recr-root');
		if (!root) {
			root = document.createElement('div');
			root.className = 'ce-recr-root ce-theme-brand';
			layout.insertBefore(root, layout.firstChild);
		}
		ensureBodyFlag(true);
		render(root);
		mounted = true;
		return true;
	}

	function unmount() {
		mounted = false;
		ensureBodyFlag(false);
		document.querySelectorAll('.ce-recr-root').forEach(n => n.remove());
		log('unmounted');
	}

	function render(root) {
		const today = (window.frappe && frappe.datetime && frappe.datetime.global_date_format)
			? frappe.datetime.global_date_format(frappe.datetime.get_today())
			: new Date().toDateString();

		root.innerHTML = `
			<div class="ce-hero ce-hero-recr">
				<div class="ds-container">
					<div class="ce-hero-inner">
						<div class="ce-hero-text">
							<div class="ce-hero-eyebrow">${esc(__('Recruitment'))}</div>
							<h1 class="ce-hero-title">${esc(__('Recruitment Dashboard'))}</h1>
							<div class="ce-hero-sub">${esc(today)}</div>
						</div>
						<div class="ce-hero-actions">
							<button class="btn ce-hero-btn" data-action="new-opening">💼 ${esc(__('Job Opening'))}</button>
							<button class="btn ce-hero-btn" data-action="new-applicant">👤 ${esc(__('Job Applicant'))}</button>
							<button class="btn ce-hero-btn" data-action="new-offer">📨 ${esc(__('Job Offer'))}</button>
							<button class="btn ce-hero-btn" data-action="new-interview">🎤 ${esc(__('Interview'))}</button>
						</div>
					</div>
				</div>
			</div>

			<div class="ds-container">
				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Recruitment pulse'))}</div>
					<div class="ds-grid" id="ce-recr-stats">
						${[1,2,3,4].map(()=>'<div class="ds-col-3 ce-card ce-skeleton-card"></div>').join('')}
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ce-section-head">${esc(__('Quick actions'))}</div>
					<div class="ds-grid" id="ce-recr-quick"></div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-8 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Applicants — last 12 months'))}</div>
								<a class="ce-panel-link" href="/app/job-applicant">${esc(__('All applicants'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-recr-chart" style="min-height:260px;"></div>
						</div>
						<div class="ds-col-4 ce-panel ce-panel-tall">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Open positions'))}</div>
								<a class="ce-panel-link" href="/app/job-opening?status=Open">${esc(__('All openings'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-recr-openings">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>

				<section class="ds-section--md">
					<div class="ds-grid">
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Active applicants'))}</div>
								<a class="ce-panel-link" href="/app/job-applicant">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-recr-applicants">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
						<div class="ds-col-6 ce-panel">
							<div class="ce-panel-head">
								<div class="ce-panel-title">${esc(__('Upcoming interviews'))}</div>
								<a class="ce-panel-link" href="/app/interview">${esc(__('View all'))} →</a>
							</div>
							<div class="ce-panel-body" id="ce-recr-interviews">
								<div class="ce-skeleton"></div><div class="ce-skeleton"></div>
							</div>
						</div>
					</div>
				</section>
			</div>
		`;

		bindActions(root);
		renderQuickActions(root.querySelector('#ce-recr-quick'));
		loadData(root);
	}

	function esc(s) {
		try { return frappe.utils.escape_html(s == null ? '' : String(s)); }
		catch (e) {
			return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
		}
	}

	function bindActions(root) {
		const newDoc = (dt) => () => frappe.new_doc(dt);
		const map = {
			'new-opening':   newDoc('Job Opening'),
			'new-applicant': newDoc('Job Applicant'),
			'new-offer':     newDoc('Job Offer'),
			'new-interview': newDoc('Interview'),
		};
		root.querySelectorAll('[data-action]').forEach(b => {
			b.addEventListener('click', () => { const a = b.dataset.action; if (map[a]) map[a](); });
		});
	}

	function renderQuickActions(host) {
		if (!host) return;
		const items = [
			{ label: __('New Job Opening'),   icon: '💼', href: '/app/job-opening/new' },
			{ label: __('New Job Applicant'), icon: '👤', href: '/app/job-applicant/new' },
			{ label: __('New Job Offer'),     icon: '📨', href: '/app/job-offer/new' },
			{ label: __('New Interview'),     icon: '🎤', href: '/app/interview/new' },
			{ label: __('Job Openings'),      icon: '📂', href: '/app/job-opening' },
			{ label: __('Job Applicants'),    icon: '🗂️', href: '/app/job-applicant' },
			{ label: __('Interviews'),        icon: '📋', href: '/app/interview' },
			{ label: __('Staffing Plans'),    icon: '📊', href: '/app/staffing-plan' },
		];
		host.innerHTML = items.map(i => `
			<a class="ds-col-3 ce-quick ce-quick-rose" href="${i.href}">
				<div class="ce-quick-icon">${i.icon}</div>
				<div class="ce-quick-label">${esc(i.label)}</div>
			</a>
		`).join('');
	}

	function loadData(root) {
		log('loading data from server script: hr_recruitment_dashboard_data');
		frappe.call({
			method: 'hr_recruitment_dashboard_data',
			callback: (r) => {
				log('server script response:', r);
				const data = (r && r.message) || {};
				renderStats(root.querySelector('#ce-recr-stats'), data.stats || {});
				renderChart(root.querySelector('#ce-recr-chart'), data.applicants_series || []);
				renderRows(root.querySelector('#ce-recr-openings'),   data.open_positions || [],     openingRow,   __('No open positions'));
				renderRows(root.querySelector('#ce-recr-applicants'), data.active_applicants || [],  applicantRow, __('No active applicants'));
				renderRows(root.querySelector('#ce-recr-interviews'), data.upcoming_interviews || [], interviewRow, __('No upcoming interviews'));
			},
			error: (e) => {
				log('server script call failed:', e);
				const stats = root.querySelector('#ce-recr-stats');
				if (stats) stats.innerHTML = `<div class="ce-empty">${esc(__('Could not load dashboard data — make sure Server Script "hr_recruitment_dashboard_data" is enabled.'))}</div>`;
			},
		});
	}

	function renderStats(host, s) {
		if (!host) return;
		const cards = [
			{ label: __('Open positions'),         value: (s.open_positions || 0),                                       icon: '💼' },
			{ label: __('Active applicants'),      value: (s.active_applicants || 0), sub: (s.new_applicants_month || 0) + ' ' + __('this month'), icon: '👤' },
			{ label: __('Interviews this week'),   value: (s.interviews_week || 0),                                      icon: '🎤' },
			{ label: __('Offers (this month)'),    value: (s.offers_month || 0),       delta: s.offers_delta_pct,         icon: '📨' },
		];
		host.innerHTML = cards.map(c => `
			<div class="ds-col-3 ce-card ce-card-brand">
				<div class="ce-card-top">
					<div class="ce-card-icon">${c.icon}</div>
					${typeof c.delta === 'number' ? `<div class="ce-delta ${c.delta >= 0 ? 'up' : 'down'}">${c.delta >= 0 ? '▲' : '▼'} ${Math.abs(c.delta).toFixed(1)}%</div>` : ''}
				</div>
				<div class="ce-card-value">${esc(String(c.value))}</div>
				<div class="ce-card-label">${esc(c.label)}</div>
				${c.sub ? `<div class="ce-card-sub">${esc(String(c.sub))}</div>` : ''}
			</div>
		`).join('');
	}

	function renderChart(el, series) {
		if (!el) return;
		el.innerHTML = '';
		if (!series.length) { el.innerHTML = `<div class="ce-empty">${esc(__('No applicant history'))}</div>`; return; }
		try {
			new frappe.Chart(el, {
				type: 'bar',
				colors: [BRAND_PALETTE.primary],
				height: 260,
				axisOptions: { xAxisMode: 'tick' },
				barOptions: { spaceRatio: 0.4 },
				data: { labels: series.map(p => p.label), datasets: [{ name: __('Applicants'), values: series.map(p => p.value || 0) }] },
			});
		} catch (e) {
			log('chart render failed', e);
			el.innerHTML = `<div class="ce-empty">${esc(__('Chart library not available'))}</div>`;
		}
	}

	function renderRows(host, items, rowFn, emptyMsg) {
		if (!host) return;
		if (!items.length) { host.innerHTML = `<div class="ce-empty">${esc(emptyMsg)}</div>`; return; }
		host.innerHTML = items.map(rowFn).join('');
	}

	function openingRow(o) {
		return `
			<a class="ce-row" href="/app/job-opening/${encodeURIComponent(o.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(o.job_title || o.name)}</div>
					<div class="ce-row-sub">${esc(o.department || o.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(String(o.applicant_count || 0))}</div>
					<div class="ce-row-sub">${esc(__('applicants'))}</div>
				</div>
			</a>`;
	}

	function applicantRow(a) {
		return `
			<a class="ce-row" href="/app/job-applicant/${encodeURIComponent(a.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(a.applicant_name || a.name)}</div>
					<div class="ce-row-sub">${esc(a.job_title || a.designation || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(a.status || '')}</div>
					<div class="ce-row-sub">${esc(a.applied_on || '')}</div>
				</div>
			</a>`;
	}

	function interviewRow(i) {
		return `
			<a class="ce-row" href="/app/interview/${encodeURIComponent(i.name)}">
				<div class="ce-row-main">
					<div class="ce-row-title">${esc(i.job_applicant_name || i.job_applicant || i.name)}</div>
					<div class="ce-row-sub">${esc(i.designation || i.interview_type || '')}</div>
				</div>
				<div class="ce-row-side">
					<div class="ce-amount">${esc(i.scheduled_on || '')}</div>
					<div class="ce-row-sub">${esc(i.from_time || '')}</div>
				</div>
			</a>`;
	}

	function tick() {
		const want = isRecrPath();
		log('tick: isRecrPath =', want, 'mounted =', mounted);
		if (want && !mounted) {
			if (!mount()) { /* retry */ }
		} else if (!want && mounted) {
			unmount();
		} else if (want && mounted) {
			ensureBodyFlag(true);
		}
	}

	function startObserver() {
		if (observer) return;
		observer = new MutationObserver(() => {
			if (isRecrPath() && !document.querySelector('.ce-recr-root')) {
				log('observer: workspace DOM changed, attempting mount');
				mount();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}

	function bindRouter() {
		if (window.frappe && frappe.router && typeof frappe.router.on === 'function') {
			frappe.router.on('change', () => {
				log('router change fired; route =', JSON.stringify(frappe.get_route()));
				const want = isRecrPath();
				if (!want) { unmount(); }
				else { mounted = false; tick(); }
			});
			log('router bound');
			return true;
		}
		return false;
	}

	function init() {
		log('init starting; readyState:', document.readyState);
		let n = 0;
		const iv = setInterval(() => {
			n++;
			if (bindRouter() || n > 80) {
				clearInterval(iv);
				if (n > 80) log('frappe.router never became available');
				startObserver();
				tick();
			}
		}, 100);

		window.addEventListener('load', () => setTimeout(tick, 200));
		let attempts = 0;
		const retry = setInterval(() => {
			attempts++;
			if (attempts > 50) { clearInterval(retry); return; }
			if (mounted) { clearInterval(retry); return; }
			if (isRecrPath()) tick();
		}, 200);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
