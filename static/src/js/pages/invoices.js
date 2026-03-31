document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('invoices');

    let currentStatus = 'all';
    let currentPage = 1;
    const limit = 20;

    async function loadInvoices() {
        const tbody = document.getElementById('invoice-list-body');
        const countEl = document.getElementById('invoice-count');
        const paginationEl = document.getElementById('pagination');

        tbody.innerHTML = `<div class="px-8 py-16 text-center text-on-surface-variant">
            <div class="skeleton h-6 w-1/2 mx-auto mb-3"></div>
            <div class="skeleton h-6 w-2/3 mx-auto mb-3"></div>
            <div class="skeleton h-6 w-1/3 mx-auto"></div>
        </div>`;

        const params = new URLSearchParams({ status: currentStatus, page: currentPage, limit });
        const data = await LC.api('/app/api/invoices?' + params);
        if (!data) return;

        countEl.textContent = `Hiển thị ${data.data.length} / ${data.total} hóa đơn`;

        if (data.data.length === 0) {
            tbody.innerHTML = '<div class="px-8 py-16 text-center text-on-surface-variant">Không có hóa đơn nào</div>';
        } else {
            tbody.innerHTML = data.data.map(function (inv) {
                const initials = LC.fmt.initials(inv.partner_name);
                return `
                <div class="grid grid-cols-12 gap-4 px-8 py-6 items-center hover:bg-surface-container-low cursor-pointer transition-colors group">
                    <div class="col-span-2 font-bold text-on-surface group-hover:text-primary transition-colors">${inv.name}</div>
                    <div class="col-span-4 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm">${initials}</div>
                        <div>
                            <div class="font-bold text-on-surface">${inv.partner_name}</div>
                            <div class="text-xs text-on-surface-variant">${inv.partner_email}</div>
                        </div>
                    </div>
                    <div class="col-span-2 text-on-surface-variant font-medium">${inv.invoice_date || '-'}</div>
                    <div class="col-span-2 font-black text-on-surface text-lg">
                        ${LC.fmt.currency(inv.amount_total, inv.currency_symbol)}
                    </div>
                    <div class="col-span-2 flex justify-end">${LC.statusBadge(inv.status)}</div>
                </div>`;
            }).join('');
        }

        renderPagination(data.page, data.total_pages, paginationEl);
    }

    function renderPagination(page, totalPages, container) {
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = `<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant/10 text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined">chevron_left</span></button>`;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === page;
            html += `<button class="w-10 h-10 flex items-center justify-center rounded-lg ${active ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container-lowest ring-1 ring-outline-variant/10 text-on-surface hover:bg-primary-container hover:text-on-primary-container'} transition-colors" data-page="${i}">${i}</button>`;
        }
        html += `<button class="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant/10 text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined">chevron_right</span></button>`;
        container.innerHTML = html;

        container.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const p = parseInt(this.dataset.page);
                if (!this.disabled && p >= 1 && p <= totalPages) {
                    currentPage = p;
                    loadInvoices();
                }
            });
        });
    }

    // Bộ lọc trạng thái
    document.querySelectorAll('[data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('[data-filter]').forEach(b => {
                b.classList.remove('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
                b.classList.add('text-on-surface-variant', 'font-medium');
            });
            this.classList.add('bg-surface-container-lowest', 'text-primary', 'font-bold', 'shadow-sm');
            this.classList.remove('text-on-surface-variant', 'font-medium');
            currentStatus = this.dataset.filter;
            currentPage = 1;
            loadInvoices();
        });
    });

    loadInvoices();
});
