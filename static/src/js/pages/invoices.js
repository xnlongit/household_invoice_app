document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('invoices');

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

        const params = new URLSearchParams({ status: 'all', page: currentPage, limit });
        const data = await LC.api('/app/api/invoices?' + params);
        if (!data) return;

        countEl.textContent = `Hiển thị ${data.data.length} / ${data.total} hóa đơn`;

        if (data.data.length === 0) {
            tbody.innerHTML = '<div class="px-8 py-16 text-center text-on-surface-variant">Không có hóa đơn nào</div>';
        } else {
            tbody.innerHTML = data.data.map(function (inv) {
                const initials = LC.fmt.initials(inv.partner_name);
                const isDraft = inv.status === 'draft';
                return `
                <div class="grid grid-cols-12 gap-4 px-8 py-5 items-center hover:bg-surface-container-low transition-colors border-b border-surface-container-low last:border-0 invoice-row cursor-pointer"
                     data-id="${inv.id}">
                    <div class="col-span-2 font-bold text-on-surface">${inv.name}</div>
                    <div class="col-span-3 flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-sm flex-shrink-0">${initials}</div>
                        <div class="min-w-0">
                            <div class="font-bold text-on-surface truncate">${inv.partner_name}</div>
                            <div class="text-xs text-on-surface-variant truncate">${inv.partner_email}</div>
                        </div>
                    </div>
                    <div class="col-span-2 text-on-surface-variant font-medium text-sm">${inv.invoice_date || '-'}</div>
                    <div class="col-span-2 font-black text-on-surface">${LC.fmt.currency(inv.amount_total, inv.currency_symbol)}</div>
                    <div class="col-span-2">${LC.statusBadge(inv.status)}</div>
                    <div class="col-span-1 flex justify-center">
                        <button class="btn-delete-row p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" data-id="${inv.id}" data-draft="${isDraft}" title="Xóa hóa đơn">
                            <span class="material-symbols-outlined text-lg leading-none">delete</span>
                        </button>
                    </div>
                </div>`;
            }).join('');

            // Click vào row → sang chi tiết (bỏ qua nếu click nút xóa)
            tbody.querySelectorAll('.invoice-row').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.closest('.btn-delete-row')) return;
                    window.location.href = '/app/invoices/' + this.dataset.id;
                });
            });

            // Nút xóa
            tbody.querySelectorAll('.btn-delete-row').forEach(function (btn) {
                btn.addEventListener('click', async function (e) {
                    e.stopPropagation();
                    if (this.dataset.draft !== 'true') {
                        alert('Chỉ xóa được hóa đơn ở trạng thái Nháp.');
                        return;
                    }
                    if (!confirm('Xóa hóa đơn này? Hành động không thể hoàn tác.')) return;
                    const res = await LC.api('/app/api/invoices/' + this.dataset.id + '/delete', { method: 'POST' });
                    if (res && res.success) {
                        loadInvoices();
                    } else {
                        alert((res && res.error) || 'Không thể xóa hóa đơn');
                    }
                });
            });
        }

        renderPagination(data.page, data.total_pages, paginationEl);
    }

    function renderPagination(page, totalPages, container) {
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = `<button class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant/20 text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_left</span></button>`;
        for (let i = 1; i <= totalPages; i++) {
            const active = i === page;
            html += `<button class="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium ${active ? 'bg-primary text-on-primary font-bold shadow-sm' : 'bg-surface-container-lowest ring-1 ring-outline-variant/20 text-on-surface hover:bg-primary-container hover:text-on-primary-container'} transition-colors" data-page="${i}">${i}</button>`;
        }
        html += `<button class="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant/20 text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-sm">chevron_right</span></button>`;
        container.innerHTML = html;

        container.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (this.disabled) return;
                const p = parseInt(this.dataset.page);
                if (p >= 1 && p <= totalPages) {
                    currentPage = p;
                    loadInvoices();
                }
            });
        });
    }

    loadInvoices();
});
