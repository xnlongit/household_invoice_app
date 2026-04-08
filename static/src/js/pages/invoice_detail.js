document.addEventListener('DOMContentLoaded', async function () {
    LC.setActiveNav('invoices');

    const STATUS_MAP = {
        draft:   { label: 'Nháp',             cls: 'bg-surface-container text-on-surface-variant' },
        pending: { label: 'Chờ thanh toán',   cls: 'bg-amber-100 text-amber-700' },
        overdue: { label: 'Quá hạn',          cls: 'bg-red-100 text-red-700' },
        paid:    { label: 'Đã thanh toán',    cls: 'bg-green-100 text-green-700' },
    };

    const invoiceId = window.INVOICE_ID;
    if (!invoiceId) { showError(); return; }

    const data = await LC.api('/app/api/invoices/' + invoiceId);
    if (!data || data.error) { showError(); return; }

    // Ẩn loading, hiện nội dung
    document.getElementById('invoice-loading').classList.add('hidden');
    document.getElementById('invoice-content').classList.remove('hidden');

    // Header
    document.getElementById('inv-number').textContent = data.name;
    document.getElementById('inv-customer').textContent = data.customer_name || '—';
    document.getElementById('inv-date').textContent = data.invoice_date || '—';

    if (data.customer_address) {
        document.getElementById('inv-address').textContent = data.customer_address;
        document.getElementById('inv-address-wrap').classList.remove('hidden');
        document.getElementById('inv-address-wrap').classList.add('flex');
    }
    if (data.customer_phone) {
        document.getElementById('inv-phone').textContent = data.customer_phone;
        document.getElementById('inv-phone-wrap').classList.remove('hidden');
        document.getElementById('inv-phone-wrap').classList.add('flex');
    }
    if (data.customer_note) {
        document.getElementById('inv-note').textContent = data.customer_note;
        document.getElementById('inv-note-wrap').classList.remove('hidden');
        document.getElementById('inv-note-wrap').classList.add('flex');
    }

    const status = STATUS_MAP[data.status] || { label: data.status, cls: 'bg-surface-container text-on-surface-variant' };
    const badge = document.getElementById('inv-status-badge');
    badge.textContent = status.label;
    badge.className = 'px-4 py-2 rounded-full text-sm font-bold ' + status.cls;

    // Dòng sản phẩm
    const linesEl = document.getElementById('inv-lines');
    if (!data.lines || data.lines.length === 0) {
        linesEl.innerHTML = '<div class="px-6 py-8 text-center text-on-surface-variant text-sm">Không có dòng sản phẩm.</div>';
    } else {
        linesEl.style.display = 'table';
        linesEl.style.width = '100%';
        linesEl.style.borderCollapse = 'collapse';
        linesEl.innerHTML = data.lines.map(function (line) {
            const taxLabel = line.taxes && line.taxes.length
                ? line.taxes.map(function(t) { return t.name; }).join(', ')
                : '—';
            const uomLabel = line.uom_name || '—';
            return '<div style="display:table-row;" class="hover:bg-surface-container-low/20 transition-colors">'
                + '<div style="display:table-cell;width:32%;padding:14px 8px 14px 24px;" class="font-semibold text-on-surface">' + escapeHtml(line.description) + '</div>'
                + '<div style="display:table-cell;width:8%;padding:14px 4px;text-align:center;" class="text-on-surface-variant">' + line.quantity + '</div>'
                + '<div style="display:table-cell;width:10%;padding:14px 4px;text-align:center;" class="text-sm text-on-surface-variant">' + escapeHtml(uomLabel) + '</div>'
                + '<div style="display:table-cell;width:14%;padding:14px 4px;text-align:right;" class="text-on-surface-variant">' + LC.fmt.currency(line.price_unit) + '</div>'
                + '<div style="display:table-cell;width:20%;padding:14px 8px;text-align:right;" class="text-sm text-on-surface-variant">' + escapeHtml(taxLabel) + '</div>'
                + '<div style="display:table-cell;width:16%;padding:14px 24px 14px 8px;text-align:right;" class="font-bold text-primary">' + LC.fmt.currency(line.price_subtotal) + '</div>'
                + '</div>';
        }).join('');
    }

    // Tổng
    document.getElementById('inv-subtotal').textContent = LC.fmt.currency(data.amount_untaxed);
    document.getElementById('inv-tax').textContent = LC.fmt.currency(data.amount_tax);
    document.getElementById('inv-total').textContent = LC.fmt.currency(data.amount_total);

    // Cập nhật title
    document.title = data.name + ' | Hóa đơn';

    // Nút in hóa đơn — luôn hiển thị
    const btnPrint = document.getElementById('btn-print-invoice');
    if (btnPrint) {
        btnPrint.addEventListener('click', function() {
            window.open('/report/pdf/household_invoice_app.report_household_invoice/' + invoiceId, '_blank');
        });
    }

    // Nút xóa — chỉ hiện khi nháp
    if (data.status === 'draft') {
        const btnDelete = document.getElementById('btn-delete-invoice');
        btnDelete.classList.remove('hidden');
        btnDelete.classList.add('flex');
        btnDelete.addEventListener('click', async function () {
            if (!confirm('Xóa hóa đơn ' + data.name + '? Hành động không thể hoàn tác.')) return;
            const res = await LC.api('/app/api/invoices/' + invoiceId + '/delete', { method: 'POST' });
            if (res && res.success) {
                window.location.href = '/app/invoices';
            } else {
                alert((res && res.error) || 'Không thể xóa hóa đơn');
            }
        });
    }
});

function showError() {
    document.getElementById('invoice-loading').classList.add('hidden');
    document.getElementById('invoice-error').classList.remove('hidden');
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
