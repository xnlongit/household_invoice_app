document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('invoices');

    let lineItems = [];
    let allProducts = [];
    let availableTaxes = [];
    let selectedTax = null;  // single select
    let searchTimer = null;

    // ---- Tax selector ----
    async function loadTaxes(search) {
        const params = new URLSearchParams({ search: search || '' });
        const data = await LC.api('/app/api/taxes?' + params);
        if (data && data.data) {
            availableTaxes = data.data;
            renderTaxDropdown();
        }
    }

    function renderTaxDropdown() {
        const dropdown = document.getElementById('tax-dropdown');
        if (!dropdown) return;
        if (availableTaxes.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-on-surface-variant">Không tìm thấy thuế nào</div>';
            return;
        }
        dropdown.innerHTML = availableTaxes.map(function (tax) {
            const isSelected = selectedTax && selectedTax.id === tax.id;
            return '<div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer tax-option ' + (isSelected ? 'font-semibold text-primary' : 'text-on-surface') + '" data-tax-id="' + tax.id + '">'
                + escapeAttr(tax.name)
                + '</div>';
        }).join('');
    }

    const taxSearch = document.getElementById('tax-search');
    taxSearch.addEventListener('focus', function () {
        loadTaxes('');
        document.getElementById('tax-dropdown').classList.remove('hidden');
    });
    taxSearch.addEventListener('input', function () {
        selectedTax = null;
        loadTaxes(this.value);
        document.getElementById('tax-dropdown').classList.remove('hidden');
    });
    document.getElementById('tax-dropdown').addEventListener('click', function (e) {
        const option = e.target.closest('.tax-option');
        if (!option) return;
        e.stopPropagation();
        const id = parseInt(option.dataset.taxId);
        const tax = availableTaxes.find(function (t) { return t.id === id; });
        if (!tax) return;
        selectedTax = tax;
        taxSearch.value = tax.name;
        document.getElementById('tax-dropdown').classList.add('hidden');
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#tax-selector-container')) {
            document.getElementById('tax-dropdown').classList.add('hidden');
            // Nếu user xóa text thì clear selection
            if (taxSearch.value === '') selectedTax = null;
        }
    });

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
                    document.getElementById('product-price').value = this.dataset.price;
                    try {
                        const taxes = JSON.parse(decodeURIComponent(this.dataset.taxes || '[]'));
                        selectedTax = taxes.length ? taxes[0] : null;
                    } catch (e) { selectedTax = null; }
                    taxSearch.value = selectedTax ? selectedTax.name : '';
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

        lineItems.push({ product_id: pid || null, description: name, quantity: qty, price_unit: price, taxes: selectedTax ? [selectedTax] : [] });

        // Reset ô nhập
        if (productSearch) { productSearch.value = ''; productSearch.dataset.selectedId = ''; productSearch.dataset.selectedPrice = ''; }
        document.getElementById('product-qty').value = '1';
        document.getElementById('product-price').value = '';
        selectedTax = null;
        taxSearch.value = '';

        renderLineItems();
        updateSummary();
    });

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const cellInput = 'width:100%;background:transparent;border:none;outline:none;border-radius:4px;padding:2px 4px;';
    const cellInputFocusCls = 'focus:bg-surface-container-low';

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
            return `<div class="px-6 py-3 flex items-center hover:bg-surface-container-low/30 transition-colors">
                <div style="width:37%;flex-shrink:0;min-width:0;padding-right:8px">
                    <input type="text" value="${escapeAttr(item.description)}"
                        style="${cellInput}" class="font-semibold text-on-surface ${cellInputFocusCls}"
                        data-field="description" data-idx="${idx}" placeholder="Mô tả"/>
                </div>
                <div style="width:9%;flex-shrink:0">
                    <input type="number" min="1" value="${item.quantity}"
                        style="${cellInput}text-align:center;" class="font-medium ${cellInputFocusCls}"
                        data-field="quantity" data-idx="${idx}"/>
                </div>
                <div style="width:16%;flex-shrink:0">
                    <input type="number" min="0" value="${item.price_unit}"
                        style="${cellInput}text-align:right;" class="font-medium ${cellInputFocusCls}"
                        data-field="price_unit" data-idx="${idx}"/>
                </div>
                <div style="width:22%;flex-shrink:0;text-align:right" class="text-sm text-on-surface-variant px-2">${taxLabel}</div>
                <div style="width:12%;flex-shrink:0;text-align:right" class="font-bold text-primary" data-total-idx="${idx}">${LC.fmt.currency(item.quantity * item.price_unit)}</div>
                <div style="width:4%;flex-shrink:0;display:flex;justify-content:flex-end">
                    <button class="text-error hover:text-error-dim transition-colors" data-remove="${idx}">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('input[data-field]').forEach(function (input) {
            input.addEventListener('input', function () {
                const idx = parseInt(this.dataset.idx);
                const field = this.dataset.field;
                if (field === 'quantity') {
                    lineItems[idx].quantity = parseFloat(this.value) || 1;
                } else if (field === 'price_unit') {
                    lineItems[idx].price_unit = parseFloat(this.value) || 0;
                } else {
                    lineItems[idx].description = this.value;
                }
                const totalCell = container.querySelector(`[data-total-idx="${idx}"]`);
                if (totalCell) totalCell.textContent = LC.fmt.currency(lineItems[idx].quantity * lineItems[idx].price_unit);
                updateSummary();
            });
        });

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

        const customerName    = document.getElementById('customer-name').value.trim();
        const customerAddress = document.getElementById('customer-address').value.trim();
        const customerPhone   = document.getElementById('customer-phone').value.trim();
        const customerNote    = document.getElementById('customer-note').value.trim();
        // type="date" trả về yyyy-mm-dd trực tiếp
        const invoiceDate = document.getElementById('invoice-date').value.trim();

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
            body: JSON.stringify({
                customer_name:    customerName,
                customer_address: customerAddress,
                customer_phone:   customerPhone,
                customer_note:    customerNote,
                invoice_date: invoiceDate,
                lines: payload,
            }),
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

    // Ngày lập hóa đơn — mặc định hôm nay
    const dateInput = document.getElementById('invoice-date');
    if (dateInput) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        dateInput.value = today.getFullYear() + '-' + mm + '-' + dd;
    }
    renderLineItems();
    updateSummary();
    loadProducts('');
});
