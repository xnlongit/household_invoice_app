document.addEventListener('DOMContentLoaded', function () {
    LC.setActiveNav('invoices');

    let lineItems = [];
    let allProducts = [];
    let availableTaxes = [];
    let availableUoms = [];
    let selectedTax = null;
    let selectedAddUom = null;   // {id, name, category_id}
    let currentUomCategoryId = null;  // category của product đang chọn
    let searchTimer = null;
    let uomSearchTimer = null;

    // ================================================================
    // Tax selector
    // ================================================================
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
            return '<div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer tax-option '
                + (isSelected ? 'font-semibold text-primary' : 'text-on-surface')
                + '" data-tax-id="' + tax.id + '">' + escapeHtml(tax.name) + '</div>';
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
        const tax = availableTaxes.find(function (t) { return t.id === parseInt(option.dataset.taxId); });
        if (!tax) return;
        selectedTax = tax;
        taxSearch.value = tax.name;
        document.getElementById('tax-dropdown').classList.add('hidden');
    });

    // ================================================================
    // UOM selector (form thêm sản phẩm) — hoạt động giống Tax selector
    // ================================================================
    async function loadAddUoms(search) {
        const params = new URLSearchParams({ search: search || '' });
        if (currentUomCategoryId) params.set('category_id', currentUomCategoryId);
        const data = await LC.api('/app/api/uoms?' + params);
        if (data && data.data) {
            availableUoms = data.data;
            renderAddUomDropdown();
        }
    }

    function renderAddUomDropdown() {
        const dropdown = document.getElementById('add-uom-dropdown');
        if (!dropdown) return;
        if (availableUoms.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-on-surface-variant">Không tìm thấy đơn vị tính</div>';
            return;
        }
        dropdown.innerHTML = availableUoms.map(function (u) {
            const isSelected = selectedAddUom && selectedAddUom.id === u.id;
            return '<div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer add-uom-option '
                + (isSelected ? 'font-semibold text-primary' : 'text-on-surface')
                + '" data-uom-id="' + u.id + '" data-uom-name="' + escapeAttr(u.name) + '">'
                + escapeHtml(u.name)
                + '</div>';
        }).join('');
    }

    const addUomInput = document.getElementById('add-uom-input');
    const addUomDropdown = document.getElementById('add-uom-dropdown');

    addUomInput.addEventListener('focus', function () {
        loadAddUoms('');
        addUomDropdown.classList.remove('hidden');
    });
    addUomInput.addEventListener('input', function () {
        selectedAddUom = null;
        clearTimeout(uomSearchTimer);
        const val = this.value;
        uomSearchTimer = setTimeout(function () {
            loadAddUoms(val);
            addUomDropdown.classList.remove('hidden');
        }, 200);
    });
    addUomDropdown.addEventListener('click', function (e) {
        const option = e.target.closest('.add-uom-option');
        if (!option) return;
        e.stopPropagation();
        selectedAddUom = {
            id: parseInt(option.dataset.uomId),
            name: option.dataset.uomName,
            category_id: currentUomCategoryId,
        };
        addUomInput.value = selectedAddUom.name;
        addUomDropdown.classList.add('hidden');
    });

    // ================================================================
    // Đóng tất cả dropdown khi click ra ngoài
    // ================================================================
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#tax-selector-container')) {
            document.getElementById('tax-dropdown').classList.add('hidden');
            if (taxSearch.value === '') selectedTax = null;
        }
        if (!e.target.closest('#add-uom-container')) {
            addUomDropdown.classList.add('hidden');
            if (addUomInput.value === '') selectedAddUom = null;
        }
        if (!e.target.closest('[data-uom-cell]')) {
            document.querySelectorAll('.uom-dropdown').forEach(function (d) {
                d.classList.add('hidden');
            });
        }
    });

    // ================================================================
    // Product search
    // ================================================================
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
                return '<div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer flex justify-between items-center product-option"'
                    + ' data-id="' + (p.product_variant_id || p.id) + '"'
                    + ' data-name="' + escapeAttr(p.name) + '"'
                    + ' data-price="' + p.list_price + '"'
                    + ' data-uom-name="' + escapeAttr(p.uom_name || '') + '"'
                    + ' data-uom-id="' + (p.uom_id || '') + '"'
                    + ' data-uom-category-id="' + (p.uom_category_id || '') + '"'
                    + ' data-taxes="' + escapeAttr(JSON.stringify(p.taxes || [])) + '">'
                    + '<span class="font-medium text-on-surface">' + escapeHtml(p.name) + '</span>'
                    + '<span class="text-sm text-on-surface-variant">'
                    + LC.fmt.currency(p.list_price)
                    + (p.uom_name ? ' · ' + escapeHtml(p.uom_name) : '')
                    + (taxLabel ? ' · ' + escapeHtml(taxLabel) : '')
                    + '</span>'
                    + '</div>';
            }).join('');
            dropdown.querySelectorAll('.product-option').forEach(function (el) {
                el.addEventListener('click', function () {
                    const ps = document.getElementById('product-search');
                    ps.value = this.dataset.name;
                    ps.dataset.selectedId = this.dataset.id;

                    // Cập nhật UOM từ product và set category filter
                    const uomId = parseInt(this.dataset.uomId) || null;
                    const uomName = this.dataset.uomName || '';
                    const uomCategoryId = parseInt(this.dataset.uomCategoryId) || null;
                    currentUomCategoryId = uomCategoryId;
                    selectedAddUom = uomId ? { id: uomId, name: uomName, category_id: uomCategoryId } : null;
                    addUomInput.value = uomName;
                    availableUoms = [];

                    document.getElementById('product-price').value = this.dataset.price;
                    try {
                        const taxes = JSON.parse(this.dataset.taxes || '[]');
                        selectedTax = taxes.length ? taxes[0] : null;
                    } catch (e) { selectedTax = null; }
                    taxSearch.value = selectedTax ? selectedTax.name : '';
                    dropdown.classList.add('hidden');
                });
            });
        }
        dropdown.classList.remove('hidden');
    }

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

    // ================================================================
    // Thêm dòng sản phẩm
    // ================================================================
    document.getElementById('btn-add-item').addEventListener('click', function () {
        const name = productSearch ? productSearch.value.trim() : '';
        const pid = productSearch ? (productSearch.dataset.selectedId || null) : null;
        const qty = parseFloat(document.getElementById('product-qty').value) || 1;
        const price = parseFloat(document.getElementById('product-price').value) || 0;

        if (!name) { LC.toast('Vui lòng nhập tên sản phẩm', 'error'); return; }

        lineItems.push({
            product_id: pid || null,
            description: name,
            quantity: qty,
            uom_id: selectedAddUom ? selectedAddUom.id : null,
            uom_name: selectedAddUom ? selectedAddUom.name : '',
            uom_category_id: selectedAddUom ? selectedAddUom.category_id : null,
            price_unit: price,
            taxes: selectedTax ? [selectedTax] : [],
        });

        // Reset
        if (productSearch) {
            productSearch.value = '';
            productSearch.dataset.selectedId = '';
        }
        document.getElementById('product-qty').value = '1';
        document.getElementById('product-price').value = '';
        selectedTax = null;
        taxSearch.value = '';
        selectedAddUom = null;
        currentUomCategoryId = null;
        availableUoms = [];
        addUomInput.value = '';

        renderLineItems();
        updateSummary();
    });

    // ================================================================
    // Helpers
    // ================================================================
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escapeAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const cellInput = 'width:100%;background:transparent;border:none;outline:none;border-radius:4px;padding:2px 4px;box-sizing:border-box;';
    const cellInputFocusCls = 'focus:bg-surface-container-low';

    // ================================================================
    // UOM dropdown trong bảng (inline edit)
    // ================================================================
    async function openInlineUomDropdown(idx) {
        const container = document.getElementById('line-items-body');
        const drop = container.querySelector('[data-uom-drop="' + idx + '"]');
        if (!drop) return;

        container.querySelectorAll('.uom-dropdown').forEach(function (d) {
            if (d !== drop) d.classList.add('hidden');
        });
        if (!drop.classList.contains('hidden')) {
            drop.classList.add('hidden');
            return;
        }

        drop.innerHTML = '<div class="px-4 py-2 text-sm text-on-surface-variant">Đang tải...</div>';
        drop.classList.remove('hidden');

        const params = new URLSearchParams();
        if (lineItems[idx].uom_category_id) params.set('category_id', lineItems[idx].uom_category_id);
        const data = await LC.api('/app/api/uoms?' + params);

        if (!data || !data.data || data.data.length === 0) {
            drop.innerHTML = '<div class="px-4 py-2 text-sm text-on-surface-variant">Không có đơn vị tính</div>';
            return;
        }
        drop.innerHTML = data.data.map(function (u) {
            const isSel = lineItems[idx].uom_id === u.id;
            return '<div class="px-4 py-2 hover:bg-surface-container-low cursor-pointer text-sm whitespace-nowrap '
                + (isSel ? 'font-semibold text-primary' : 'text-on-surface')
                + '" data-sel-uom="' + idx + '" data-uom-id="' + u.id + '" data-uom-name="' + escapeAttr(u.name) + '">'
                + escapeHtml(u.name) + '</div>';
        }).join('');

        drop.querySelectorAll('[data-sel-uom]').forEach(function (opt) {
            opt.addEventListener('click', function (e) {
                e.stopPropagation();
                const i = parseInt(this.dataset.selUom);
                lineItems[i].uom_id = parseInt(this.dataset.uomId);
                lineItems[i].uom_name = this.dataset.uomName;
                renderLineItems();
            });
        });
    }

    // ================================================================
    // Render bảng dòng sản phẩm
    // ================================================================
    function renderLineItems() {
        const container = document.getElementById('line-items-body');
        if (lineItems.length === 0) {
            container.innerHTML = '<div class="px-6 py-8 text-center text-on-surface-variant text-sm">Chưa có sản phẩm. Thêm sản phẩm vào hóa đơn bên trên.</div>';
            return;
        }

        // Dùng table thay vì flex để căn đều
        container.innerHTML = lineItems.map(function (item, idx) {
            const taxLabel = item.taxes && item.taxes.length
                ? item.taxes.map(function(t) { return t.name; }).join(', ')
                : '—';
            const uomLabel = item.uom_name || '—';
            const uomCls = item.uom_name ? 'text-on-surface font-medium' : 'text-on-surface-variant';

            return '<div style="display:table-row">'
                // Mô tả 32%
                + '<div style="display:table-cell;width:32%;padding:10px 8px 10px 24px;vertical-align:middle;">'
                +   '<input type="text" value="' + escapeAttr(item.description) + '"'
                +   ' style="' + cellInput + '" class="font-semibold text-on-surface ' + cellInputFocusCls + '"'
                +   ' data-field="description" data-idx="' + idx + '" placeholder="Mô tả"/>'
                + '</div>'
                // SL 8%
                + '<div style="display:table-cell;width:8%;padding:10px 4px;vertical-align:middle;text-align:center;">'
                +   '<input type="number" min="1" value="' + item.quantity + '"'
                +   ' style="' + cellInput + 'text-align:center;" class="font-medium ' + cellInputFocusCls + '"'
                +   ' data-field="quantity" data-idx="' + idx + '"/>'
                + '</div>'
                // ĐVT 10%
                + '<div style="display:table-cell;width:10%;padding:10px 4px;vertical-align:middle;text-align:center;position:relative;" data-uom-cell="' + idx + '">'
                +   '<button type="button"'
                +     ' style="width:100%;text-align:center;background:transparent;border:none;cursor:pointer;border-radius:4px;padding:2px 4px;"'
                +     ' class="text-sm hover:bg-surface-container-low transition-colors ' + uomCls + '"'
                +     ' title="Nhấn để đổi đơn vị tính"'
                +     ' data-uom-btn="' + idx + '">' + escapeHtml(uomLabel) + '</button>'
                +   '<div class="uom-dropdown hidden" style="position:absolute;z-index:50;top:100%;left:0;min-width:130px;background:var(--color-surface-container-lowest,#fff);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);overflow:hidden;" data-uom-drop="' + idx + '"></div>'
                + '</div>'
                // Đơn giá 14%
                + '<div style="display:table-cell;width:14%;padding:10px 4px;vertical-align:middle;">'
                +   '<input type="number" min="0" value="' + item.price_unit + '"'
                +   ' style="' + cellInput + 'text-align:right;" class="font-medium ' + cellInputFocusCls + '"'
                +   ' data-field="price_unit" data-idx="' + idx + '"/>'
                + '</div>'
                // Thuế 20%
                + '<div style="display:table-cell;width:20%;padding:10px 8px;vertical-align:middle;text-align:right;" class="text-sm text-on-surface-variant">'
                +   escapeHtml(taxLabel)
                + '</div>'
                // Thành tiền 12%
                + '<div style="display:table-cell;width:12%;padding:10px 8px;vertical-align:middle;text-align:right;" class="font-bold text-primary" data-total-idx="' + idx + '">'
                +   LC.fmt.currency(item.quantity * item.price_unit)
                + '</div>'
                // Xóa 4%
                + '<div style="display:table-cell;width:4%;padding:10px 8px 10px 0;vertical-align:middle;text-align:right;">'
                +   '<button class="text-error hover:text-error-dim transition-colors" data-remove="' + idx + '">'
                +     '<span class="material-symbols-outlined text-sm">delete</span>'
                +   '</button>'
                + '</div>'
                + '</div>';
        }).join('');

        // Bọc trong display:table để đảm bảo align
        container.style.display = 'table';
        container.style.width = '100%';
        container.style.borderCollapse = 'collapse';

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
                const totalCell = container.querySelector('[data-total-idx="' + idx + '"]');
                if (totalCell) totalCell.textContent = LC.fmt.currency(lineItems[idx].quantity * lineItems[idx].price_unit);
                updateSummary();
            });
        });

        container.querySelectorAll('[data-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                lineItems.splice(parseInt(this.dataset.remove), 1);
                if (lineItems.length === 0) container.style.display = '';
                renderLineItems();
                updateSummary();
            });
        });

        container.querySelectorAll('[data-uom-btn]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openInlineUomDropdown(parseInt(this.dataset.uomBtn));
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

    // ================================================================
    // Gửi hóa đơn
    // ================================================================
    document.getElementById('btn-submit').addEventListener('click', async function () {
        if (lineItems.length === 0) { LC.toast('Vui lòng thêm ít nhất một sản phẩm', 'error'); return; }

        const customerName    = document.getElementById('customer-name').value.trim();
        const customerAddress = document.getElementById('customer-address').value.trim();
        const customerPhone   = document.getElementById('customer-phone').value.trim();
        const customerNote    = document.getElementById('customer-note').value.trim();
        const invoiceDate     = document.getElementById('invoice-date').value.trim();

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
                invoice_date:     invoiceDate,
                lines:            payload,
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

    document.getElementById('btn-discard').addEventListener('click', function () {
        if (confirm('Hủy bỏ hóa đơn này?')) window.location.href = '/app/invoices';
    });

    // Ngày mặc định hôm nay
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
