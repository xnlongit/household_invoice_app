// Tiện ích dùng chung cho ứng dụng LedgerCurator
window.LC = window.LC || {};

LC.fmt = {
    currency(amount, symbol) {
        symbol = symbol || '₫';
        const num = Number(amount || 0);
        return num.toLocaleString('vi-VN') + ' ' + symbol;
    },
    initials(name) {
        if (!name) return '??';
        return name.trim().split(/\s+/).slice(0, 2)
            .map(w => w[0]).join('').toUpperCase();
    },
};

LC.statusBadge = function(status) {
    const map = {
        paid:    ['bg-tertiary-container text-on-tertiary-container', 'bg-tertiary', 'Đã TT'],
        overdue: ['bg-error-container/20 text-error', 'bg-error', 'Quá hạn'],
        draft:   ['bg-surface-container-high text-on-surface-variant', 'bg-outline', 'Nháp'],
        pending: ['bg-secondary-container text-on-secondary-container', 'bg-secondary', 'Chờ TT'],
    };
    const [chip, dot, label] = map[status] || map.draft;
    return `<span class="inline-flex items-center gap-1.5 px-3 py-1 ${chip} rounded-full text-xs font-bold">
        <span class="w-1.5 h-1.5 rounded-full ${dot}"></span>${label}</span>`;
};

LC.api = async function(url, opts) {
    opts = opts || {};
    const resp = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
    });
    if (resp.status === 401) {
        window.location.href = '/app/login';
        return null;
    }
    return resp.json();
};

LC.toast = function(msg, type) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type || 'success'}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
};

// Highlight nav đang active
LC.setActiveNav = function(page) {
    document.querySelectorAll('[data-nav]').forEach(a => {
        const active = a.dataset.nav === page;
        a.classList.toggle('text-primary', active);
        a.classList.toggle('font-bold', active);
        a.classList.toggle('border-b-2', active);
        a.classList.toggle('border-primary', active);
        a.classList.toggle('text-on-surface-variant', !active);
        a.classList.toggle('font-medium', !active);
    });
    document.querySelectorAll('[data-sidenav]').forEach(a => {
        const active = a.dataset.sidenav === page;
        if (active) {
            a.classList.add('bg-white', 'text-primary', 'shadow-sm');
            a.classList.remove('text-on-surface-variant', 'hover:bg-white/50');
        } else {
            a.classList.remove('bg-white', 'text-primary', 'shadow-sm');
            a.classList.add('text-on-surface-variant', 'hover:bg-white/50');
        }
    });
};
