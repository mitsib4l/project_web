document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  // Determine role based on email domain
  let role = '';
  if (email.endsWith('@ac.upatras.gr')) {
    role = 'student';
  } else if (email.endsWith('@prof.upatras.gr')) {
    role = 'professor';
  } else if (email.endsWith('@sec.upatras.gr')) {
    role = 'secretariat';
  }

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      localStorage.setItem('token', data.token);
      // Use determined role for redirect
      if (role === 'student') {
        window.location.href = 'student.html';
      } else if (role === 'professor') {
        window.location.href = 'professor.html';
      } else if (role === 'secretariat') {
        window.location.href = 'secretary.html';
      } else {
        document.getElementById('login-error').textContent = 'Άγνωστος ρόλος.';
      }
    } else {
      document.getElementById('login-error').textContent = 'Λανθασμένα στοιχεία.';
    }
  } catch (err) {
    document.getElementById('login-error').textContent = 'Σφάλμα σύνδεσης.';
  }
});