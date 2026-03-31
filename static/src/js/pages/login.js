document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('login-form');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const errorBox = document.getElementById('login-error');

    function setLoading(loading) {
        if (loading) {
            btnText.textContent = 'Đang đăng nhập...';
            btnIcon.textContent = 'hourglass_empty';
            form.querySelectorAll('input, button').forEach(el => el.disabled = true);
        } else {
            btnText.textContent = 'Đăng nhập';
            btnIcon.textContent = 'arrow_forward';
            form.querySelectorAll('input, button').forEach(el => el.disabled = false);
        }
    }

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
    }

    function hideError() {
        errorBox.classList.add('hidden');
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        hideError();

        const login = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!login || !password) {
            showError('Vui lòng nhập email và mật khẩu');
            return;
        }

        setLoading(true);
        try {
            const resp = await fetch('/app/api/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password }),
            });
            const data = await resp.json();
            if (data.success) {
                window.location.href = '/app/dashboard';
            } else {
                showError(data.error || 'Đăng nhập thất bại');
                setLoading(false);
            }
        } catch (err) {
            showError('Lỗi kết nối. Vui lòng thử lại.');
            setLoading(false);
        }
    });
});
