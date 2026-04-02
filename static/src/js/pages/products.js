document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('products');

    let currentPage = 1;
    let searchTimer = null;
    const limit = 20;

    async function loadProducts(search) {
        const tbody = document.getElementById('product-list-body');
        const countEl = document.getElementById('product-count');
        const paginationEl = document.getElementById('pagination');

        tbody.innerHTML = `<tr class="product-table__row--loading"><td colspan="4" class="product-table__cell--loading px-6 py-16 text-center text-on-surface-variant">
            <div class="skeleton h-6 w-1/2 mx-auto mb-3"></div>
            <div class="skeleton h-6 w-2/3 mx-auto"></div></td></tr>`;

        const params = new URLSearchParams({ page: currentPage, limit, search: search || '' });
        const data = await LC.api('/app/api/products?' + params);
        if (!data) return;

        countEl.textContent = data.total + ' sản phẩm';

        if (data.data.length === 0) {
            tbody.innerHTML = '<tr class="product-table__row--empty"><td colspan="4" class="product-table__cell--empty px-6 py-16 text-center text-on-surface-variant">Không tìm thấy sản phẩm nào</td></tr>';
        } else {
            tbody.innerHTML = data.data.map(function (p) {
                return `
                <tr class="product-table__row hover:bg-surface-container-low/30 transition-colors">
                    <td class="product-table__cell--category px-6 py-5 text-sm text-on-surface-variant">${p.categ_name || '—'}</td>
                    <td class="product-table__cell--name px-6 py-5">
                        <div class="product-table__product-name font-medium text-on-surface">${p.name}</div>
                        ${p.default_code ? `<div class="product-table__product-sku text-xs text-on-surface-variant">SKU: ${p.default_code}</div>` : ''}
                    </td>
                    <td class="product-table__cell--price px-6 py-5 text-right font-bold text-on-surface">${LC.fmt.currency(p.list_price)}</td>
                    <td class="product-table__cell--uom px-6 py-5 text-sm text-on-surface-variant">${p.uom_name || '—'}</td>
                </tr>`;
            }).join('');
        }

        renderPagination(data.page, data.total_pages, paginationEl, search);
    }

    function renderPagination(page, totalPages, container, search) {
        if (totalPages <= 1) { container.innerHTML = ''; return; }
        let html = `<button class="w-8 h-8 flex items-center justify-center rounded-lg text-outline-variant hover:bg-surface-container-high transition-colors" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-lg">chevron_left</span></button>`;
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            html += `<button class="w-8 h-8 flex items-center justify-center rounded-lg ${i === page ? 'bg-primary text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'} text-xs font-bold transition-colors" data-page="${i}">${i}</button>`;
        }
        if (totalPages > 5) html += `<span class="px-1 text-outline-variant">...</span><button class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high text-xs font-bold" data-page="${totalPages}">${totalPages}</button>`;
        html += `<button class="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
            <span class="material-symbols-outlined text-lg">chevron_right</span></button>`;
        container.innerHTML = html;

        container.querySelectorAll('button[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const p = parseInt(this.dataset.page);
                if (!this.disabled && p >= 1 && p <= totalPages) {
                    currentPage = p;
                    loadProducts(document.getElementById('search-input').value);
                }
            });
        });
    }

    // Tìm kiếm
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                currentPage = 1;
                loadProducts(searchInput.value);
            }, 350);
        });
    }

    loadProducts('');
});
