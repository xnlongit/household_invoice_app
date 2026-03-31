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

    const status = STATUS_MAP[data.status] || { label: data.status, cls: 'bg-surface-container text-on-surface-variant' };
    const badge = document.getElementById('inv-status-badge');
    badge.textContent = status.label;
    badge.className = 'px-4 py-2 rounded-full text-sm font-bold ' + status.cls;

    // Dòng sản phẩm
    const linesEl = document.getElementById('inv-lines');
    if (!data.lines || data.lines.length === 0) {
        linesEl.innerHTML = '<div class="px-6 py-8 text-center text-on-surface-variant text-sm">Không có dòng sản phẩm.</div>';
    } else {
        linesEl.innerHTML = data.lines.map(function (line) {
            const taxLabel = line.taxes && line.taxes.length
                ? line.taxes.map(function(t) { return t.name; }).join(', ')
                : '—';
            return `<div class="px-6 py-5 flex items-center hover:bg-surface-container-low/20 transition-colors">
                <div class="w-[37%] font-semibold text-on-surface">${line.description}</div>
                <div class="w-[9%] text-center text-on-surface-variant">${line.quantity}</div>
                <div class="w-[16%] text-right text-on-surface-variant">${LC.fmt.currency(line.price_unit)}</div>
                <div class="w-[22%] text-right text-sm text-on-surface-variant">${taxLabel}</div>
                <div class="w-[16%] text-right font-bold text-primary">${LC.fmt.currency(line.price_subtotal)}</div>
            </div>`;
        }).join('');
    }

    // Tổng
    document.getElementById('inv-subtotal').textContent = LC.fmt.currency(data.amount_untaxed);
    document.getElementById('inv-tax').textContent = LC.fmt.currency(data.amount_tax);
    document.getElementById('inv-total').textContent = LC.fmt.currency(data.amount_total);

    // Cập nhật title
    document.title = data.name + ' | Hóa đơn';
});

function showError() {
    document.getElementById('invoice-loading').classList.add('hidden');
    document.getElementById('invoice-error').classList.remove('hidden');
}
