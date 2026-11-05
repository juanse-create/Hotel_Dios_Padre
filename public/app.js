const form = document.getElementById('loginForm');
const tipoInput = document.getElementById('tipo');
const usuarioInput = document.getElementById('usuario');
const passwordInput = document.getElementById('password');
const error = document.getElementById('error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: usuarioInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'No fue posible iniciar sesion');
    }

    if (data.usuario.rol !== tipoInput.value) {
      throw new Error(
        'El usuario no corresponde al tipo de acceso seleccionado',
      );
    }

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    location.href =
      ['Administrador', 'Superadministrador'].includes(data.usuario.rol)
        ? '/admin.html'
        : data.usuario.rol === 'Taquilla'
          ? '/taquilla.html'
          : '/camarista.html';
  } catch (err) {
    error.textContent = err.message || 'No fue posible iniciar sesion';
  }
});
