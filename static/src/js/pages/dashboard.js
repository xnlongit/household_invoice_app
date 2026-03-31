document.addEventListener('DOMContentLoaded', async function () {
    LC.setActiveNav('dashboard');

    const data = await LC.api('/app/api/dashboard');
    if (!data) return;

    // Thống kê
    document.getElementById('stat-revenue').textContent = LC.fmt.currency(data.total_revenue);
    document.getElementById('stat-outstanding').textContent = LC.fmt.currency(data.total_outstanding);
    document.getElementById('stat-clients').textContent = data.active_clients;
    document.getElementById('stat-pending').textContent = data.pending_count + ' chờ';

    // Hóa đơn gần đây
    const tbody = document.getElementById('recent-invoices-body');
    if (!data.recent_invoices || data.recent_invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-10 text-center text-on-surface-variant">Chưa có hóa đơn nào</td></tr>';
        return;
    }

    tbody.innerHTML = data.recent_invoices.map(function (inv) {
        const initials = LC.fmt.initials(inv.partner_name);
        return `
        <tr class="hover:bg-surface-container-low transition-colors group">
            <td class="px-6 py-5">
                <span class="font-bold text-on-surface group-hover:text-primary transition-colors">${inv.name}</span>
            </td>
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-bold">${initials}</div>
                    <span class="text-on-surface">${inv.partner_name}</span>
                </div>
            </td>
            <td class="px-6 py-5 text-on-surface-variant">${inv.invoice_date || '-'}</td>
            <td class="px-6 py-5">${LC.statusBadge(inv.status)}</td>
            <td class="px-6 py-5 text-right font-bold font-headline text-on-surface">
                ${LC.fmt.currency(inv.amount_total, inv.currency_symbol)}
            </td>
        </tr>`;
    }).join('');
});
