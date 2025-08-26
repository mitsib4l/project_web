document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
            throw new Error('Λάθος email ή κωδικός');
        }
        const data = await response.json();
        // Save token (optional)
        localStorage.setItem('token', data.token);
        // Redirect to next page (π.χ. dashboard.html)
        window.location.href = '/dashboard.html';
    } catch (err) {
        errorDiv.textContent = err.message;
    }
});