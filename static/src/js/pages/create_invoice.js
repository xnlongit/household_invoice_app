document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('invoices');

    let lineItems = [];
    let allProducts = [];
    let searchTimer = null;

    // Tải sản phẩm cho autocomplete
    async function loadProducts(search) {
        const params = new URLSearchParams({ limit: 50, search: search || '' });
        const data = await LC.api('/app/api/products?' + params);
        if (data && data.data) {
            allProducts = data.data;
            renderProductDropdown(data.data);
        }
    }

    function renderProductDropdown(products) {
        const dropdown = document.getElementById('product-dropdown');
        if (!dropdown) return;
        if (products.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-on-surface-variant">Không tìm thấy sản phẩm</div>';
        } else {
            dropdown.innerHTML = products.map(function (p) {
                const taxLabel = p.taxes && p.taxes.length
                    ? p.taxes.map(function(t) { return t.name; }).join(', ')
                    : '';
                return `<div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer flex justify-between items-center product-option"
                    data-id="${p.product_variant_id || p.id}"
                    data-name="${p.name}"
                    data-price="${p.list_price}"
                    data-taxes="${encodeURIComponent(JSON.stringify(p.taxes || []))}">
                    <span class="font-medium text-on-surface">${p.name}</span>
                    <span class="text-sm text-on-surface-variant">${LC.fmt.currency(p.list_price)}${taxLabel ? ' · ' + taxLabel : ''}</span>
                </div>`;
            }).join('');
            dropdown.querySelectorAll('.product-option').forEach(function (el) {
                el.addEventListener('click', function () {
                    document.getElementById('product-search').value = this.dataset.name;
                    document.getElementById('product-search').dataset.selectedId = this.dataset.id;
                    document.getElementById('product-search').dataset.selectedPrice = this.dataset.price;
                    document.getElementById('product-search').dataset.selectedTaxes = this.dataset.taxes;
                    document.getElementById('product-price').value = this.dataset.price;
                    dropdown.classList.add('hidden');
                });
            });
        }
        dropdown.classList.remove('hidden');
    }

    // Ô tìm kiếm sản phẩm
    const productSearch = document.getElementById('product-search');
    if (productSearch) {
        productSearch.addEventListener('input', function () {
            clearTimeout(searchTimer);
            const val = this.value;
            searchTimer = setTimeout(function () { loadProducts(val); }, 300);
        });
        productSearch.addEventListener('focus', function () {
            if (allProducts.length) renderProductDropdown(allProducts);
            else loadProducts('');
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#product-search-container')) {
                document.getElementById('product-dropdown').classList.add('hidden');
            }
        });
    }

    // Thêm dòng sản phẩm
    document.getElementById('btn-add-item').addEventListener('click', function () {
        const name = productSearch ? productSearch.value.trim() : '';
        const pid = productSearch ? productSearch.dataset.selectedId : null;
        const qty = parseFloat(document.getElementById('product-qty').value) || 1;
        const price = parseFloat(document.getElementById('product-price').value) || 0;

        if (!name) { LC.toast('Vui lòng nhập tên sản phẩm', 'error'); return; }

        let taxes = [];
        try { taxes = JSON.parse(decodeURIComponent(productSearch ? (productSearch.dataset.selectedTaxes || '[]') : '[]')); } catch (e) {}

        lineItems.push({ product_id: pid || null, description: name, quantity: qty, price_unit: price, taxes: taxes });

        // Reset ô nhập
        if (productSearch) { productSearch.value = ''; productSearch.dataset.selectedId = ''; productSearch.dataset.selectedPrice = ''; productSearch.dataset.selectedTaxes = ''; }
        document.getElementById('product-qty').value = '1';
        document.getElementById('product-price').value = '';

        renderLineItems();
        updateSummary();
    });

    function renderLineItems() {
        const container = document.getElementById('line-items-body');
        if (lineItems.length === 0) {
            container.innerHTML = '<div class="px-6 py-8 text-center text-on-surface-variant text-sm">Chưa có sản phẩm. Thêm sản phẩm vào hóa đơn bên trên.</div>';
            return;
        }
        container.innerHTML = lineItems.map(function (item, idx) {
            const taxLabel = item.taxes && item.taxes.length
                ? item.taxes.map(function(t) { return t.name; }).join(', ')
                : '—';
            return `<div class="px-6 py-5 flex items-center hover:bg-surface-container-low/30 transition-colors">
                <div class="w-[37%]">
                    <p class="font-semibold text-on-surface">${item.description}</p>
                </div>
                <div class="w-[9%] text-center font-medium">${item.quantity}</div>
                <div class="w-[16%] text-right font-medium">${LC.fmt.currency(item.price_unit)}</div>
                <div class="w-[22%] text-right text-sm text-on-surface-variant">${taxLabel}</div>
                <div class="w-[12%] text-right font-bold text-primary">${LC.fmt.currency(item.quantity * item.price_unit)}</div>
                <div class="w-[4%] flex justify-end">
                    <button class="text-error hover:text-error-dim transition-colors" data-remove="${idx}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('[data-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                lineItems.splice(parseInt(this.dataset.remove), 1);
                renderLineItems();
                updateSummary();
            });
        });
    }

    function updateSummary() {
        const subtotal = lineItems.reduce(function (s, i) { return s + i.quantity * i.price_unit; }, 0);
        let tax = 0;
        lineItems.forEach(function(item) {
            const lineTotal = item.quantity * item.price_unit;
            (item.taxes || []).forEach(function(t) { tax += lineTotal * t.amount / 100; });
        });
        const total = subtotal + tax;
        document.getElementById('summary-subtotal').textContent = LC.fmt.currency(subtotal);
        document.getElementById('summary-tax').textContent = LC.fmt.currency(tax);
        document.getElementById('summary-total').textContent = LC.fmt.currency(total);
    }

    // Gửi hóa đơn
    document.getElementById('btn-submit').addEventListener('click', async function () {
        if (lineItems.length === 0) { LC.toast('Vui lòng thêm ít nhất một sản phẩm', 'error'); return; }

        const customerName = document.getElementById('customer-name').value.trim();
        const rawDate = document.getElementById('invoice-date').value.trim();
        // Chuyển dd/mm/yyyy → yyyy-mm-dd cho API
        let invoiceDate = '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            const [d, mo, y] = rawDate.split('/');
            invoiceDate = y + '-' + mo + '-' + d;
        }

        this.disabled = true;
        this.textContent = 'Đang tạo...';

        const payload = lineItems.map(function(item) {
            return {
                product_id: item.product_id,
                description: item.description,
                quantity: item.quantity,
                price_unit: item.price_unit,
                tax_ids: (item.taxes || []).map(function(t) { return t.id; }),
            };
        });
        const data = await LC.api('/app/api/invoices/create', {
            method: 'POST',
            body: JSON.stringify({ customer_name: customerName, invoice_date: invoiceDate, lines: payload }),
        });

        if (!data) return;
        if (data.success) {
            LC.toast('Tạo hóa đơn ' + data.name + ' thành công!', 'success');
            setTimeout(function () { window.location.href = '/app/invoices/' + data.invoice_id; }, 1000);
        } else {
            LC.toast(data.error || 'Không thể tạo hóa đơn', 'error');
            this.disabled = false;
            this.textContent = 'Xác nhận & Gửi hóa đơn';
        }
    });

    // Hủy bỏ
    document.getElementById('btn-discard').addEventListener('click', function () {
        if (confirm('Hủy bỏ hóa đơn này?')) window.location.href = '/app/invoices';
    });

    // Ngày lập hóa đơn — định dạng dd/mm/yyyy
    const dateInput = document.getElementById('invoice-date');
    if (dateInput) {
        // Giá trị mặc định: hôm nay
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        dateInput.value = dd + '/' + mm + '/' + today.getFullYear();

        // Auto-format: tự chèn dấu / khi nhập
        dateInput.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 8);
            if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
            if (v.length >= 6) v = v.slice(0, 5) + '/' + v.slice(5);
            this.value = v;
        });
    }
    renderLineItems();
    updateSummary();
    loadProducts('');
});
