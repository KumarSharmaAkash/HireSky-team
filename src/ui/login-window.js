document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMsg');
    const quitLink = document.getElementById('quitLink');

    if (quitLink) {
        quitLink.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.quit) window.electronAPI.quit();
        });
    }

    if (!form || !window.electronAPI || !window.electronAPI.login) {
        console.error('Login form or electronAPI.login not available');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.classList.remove('visible');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in…';

        try {
            const result = await window.electronAPI.login(emailInput.value.trim(), passwordInput.value);
            if (!result || !result.success) {
                errorMsg.textContent = (result && result.error) || 'Sign in failed. Please try again.';
                errorMsg.classList.add('visible');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
            }
            // On success, the main process hides this window and shows the
            // main overlay — nothing further to do here.
        } catch (err) {
            errorMsg.textContent = 'Something went wrong. Please try again.';
            errorMsg.classList.add('visible');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });
});
