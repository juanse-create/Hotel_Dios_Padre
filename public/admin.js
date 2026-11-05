const token = localStorage.getItem('token'),
  user = JSON.parse(localStorage.getItem('usuario') || 'null');
if (!token || !['Administrador', 'Superadministrador'].includes(user?.rol)) location.href = '/';
const api = async (url, opt = {}) => {
  const isForm = opt.body instanceof FormData;
  const headers = { Authorization: 'Bearer ' + token, ...opt.headers };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch('/api' + url, {
      ...opt,
      headers,
      signal: opt.signal || controller.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok)
      throw Error(
        Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Error',
      );
    return d;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Error(
        'El servidor tardó demasiado en responder. Intenta de nuevo.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
const modules = [
  ['Panel Principal ', 'dashboard', '<i class="fa-solid fa-house"></i>'],
  ['Habitaciones', 'habitaciones', '<i class="fa-solid fa-bed"></i>'],
  [
    'Reservaciones',
    'reservaciones',
    '<i class="fa-solid fa-calendar-days"></i>',
  ],
  ['Recepción', 'recepcion', '<i class="fa-solid fa-bell"></i>'],
  ['Limpieza', 'limpieza', '<i class="fa-solid fa-broom"></i>'],
  ['Usuarios', 'usuarios', '<i class="fa-solid fa-user-gear"></i>'],
  [
    'Tipos de Habitaciónes',
    'tipos-habitacion',
    '<i class="fa-solid fa-key"></i>',
  ],
  ['Reportes', 'reportes', '<i class="fa-solid fa-chart-line"></i>'],
];
if (user?.rol === 'Superadministrador') modules.push(['Cortesías', 'cortesias', '<i class="fa-solid fa-percent"></i>']);
// Inyectamos el icono junto al nombre (x[2] es el icono y x[0] el texto)
nav.innerHTML = modules
  .map(
    (x) =>
      `<button onclick="load('${x[1]}','${x[0]}')">${x[2]} ${x[0]}</button>`,
  )
  .join('');
function logout() {
  localStorage.clear();
  location.href = '/';
}
function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (m) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[m],
  );
}
function table(rows) {
  if (!rows?.length) return '<div class="box empty">Sin registros</div>';
  const ks = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  return `<div class="box table-wrap"><table><thead><tr>${ks.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${ks.map((k) => `<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
async function load(id, label) {
  title.textContent = label;
  content.innerHTML = '<div class="box">Cargando...</div>';
  try {
    if (id === 'dashboard') return await dash();
    if (id === 'habitaciones') return await habitaciones();
    if (id === 'reservaciones') return await reservaciones();
    if (id === 'recepcion') return await recepcion();
    if (id === 'limpieza') return await limpieza();
    if (id === 'usuarios') return await usuarios();
    if (id === 'cortesias') return await cortesias();
    if (id === 'reportes') return await reportes();
    return await crud(id);
  } catch (e) {
    content.innerHTML = `<div class="box error"><strong>No se pudo cargar el módulo.</strong><p>${esc(e.message)}</p><button class=primary onclick="load('${esc(id)}','${esc(label)}')">Reintentar</button></div>`;
  }
}
async function dash() {
  const d = await api('/reportes/dashboard');
  content.innerHTML = `<div class=cards><div class=card>Ocupación<strong>${d.porcentajeOcupacion}%</strong></div><div class=card>Reservaciones confirmadas<strong>${d.reservacionesConfirmadas}</strong></div>${d.estados.map((x) => `<div class=card>${esc(x.nombre)}<strong>${x.total}</strong></div>`).join('')}</div>`;
}
function urlFotoHabitacion(fotoUrl) {
  if (!fotoUrl) return '';
  let ruta = String(fotoUrl).trim().replaceAll('\\', '/');
  ruta = ruta.replace(/^.*\/public\//i, '/').replace(/^public\//i, '/');
  if (!/^https?:\/\//i.test(ruta) && !ruta.startsWith('/')) ruta = `/${ruta}`;
  return `${ruta}${ruta.includes('?') ? '&' : '?'}v=${Date.now()}`;
}
function habitacionCard(h) {
  const foto = urlFotoHabitacion(h.fotoUrl);
  return `<article class="room-card ${h.activa ? '' : 'inactive'}"><div class="room-photo">${foto ? `<img src="${esc(foto)}" alt="Habitación ${esc(h.numero)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class=room-photo-error hidden><i class="fa-regular fa-image"></i> No se pudo cargar la imagen</span>` : '<span class=room-photo-empty><i class="fa-regular fa-image"></i> Sin fotografía</span>'}</div><div class="room-body"><div class="room-title"><h3>Habitación ${esc(h.numero)}</h3><span class="badge">${esc(h.estado?.nombre || 'Sin estado')}</span></div><p><i class="fa-solid fa-layer-group"></i> Piso ${esc(h.piso ?? '-')} · ${esc(h.tipo?.nombre || 'Sin tipo')}</p><p>${esc(h.observaciones || 'Sin observaciones')}</p><div class="room-actions"><button class=room-edit-button onclick='editarHabitacion(${JSON.stringify(h).replace(/'/g, '&#39;')})'><i class="fa-regular fa-pen-to-square"></i> Editar</button><label class="file-button"><i class="fa-solid fa-camera"></i> ${foto ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/png,image/jpeg,image/webp" onchange="subirFoto(${h.id},this)"></label>${foto ? `<button class=room-remove-photo onclick="eliminarFoto(${h.id})"><i class="fa-regular fa-image"></i> Quitar</button>` : ''}<button class="danger room-delete-button" onclick="eliminarHabitacion(${h.id})" title="Eliminar habitación"><i class="fa-regular fa-trash-can"></i></button></div></div></article>`;
}
async function habitaciones() {
  const [rows, tipos] = await Promise.all([
    api('/habitaciones'),
    api('/tipos-habitacion'),
  ]);
  const estados = [
    { id: 1, nombre: 'Disponible' },
    { id: 2, nombre: 'En proceso de reservación' },
    { id: 3, nombre: 'Reservada' },
    { id: 4, nombre: 'Ocupada' },
    { id: 5, nombre: 'Pendiente de limpieza' },
    { id: 6, nombre: 'Sucia' },
    { id: 7, nombre: 'En proceso' },
    { id: 8, nombre: 'Limpia' },
    { id: 9, nombre: 'Fuera de servicio' },
  ];
  window.tiposHabitacion = tipos;
  window.estadosHabitacion = estados;
  const estadoInicial =
    estados.find((e) => e.nombre === 'Disponible')?.id ?? estados[0]?.id ?? '';
  content.innerHTML = `
  <section class="reservation-hero">
    <div>
      <h2>Habitaciones</h2>
      <p>Administra los datos, estados y fotografías de cada habitación.</p>
    </div>
    <div class="instant-badge">Control Total</div>
  </section>

  <div class="box room-form-box">
    <h3 id="habitacionFormTitulo">Nueva habitación</h3>

    <form id="habitacionForm" class="room-form">
      <input type="hidden" name="id">

      <label>
        <span>Número de habitación *</span>
       <input
          name="numero"
          type="text"
          placeholder="Ej. 101"
          required
          minlength="1"
          maxlength="4"
          inputmode="numeric"
          pattern="[0-9]{1,4}"
          title="Ingresa únicamente números"
        >
      </label>

      <label>
        <span>Piso</span>
        <input
          name="piso"
          type="number"
          placeholder="Ej. 1"
          min="0"
          max="20"
          step="1"
          inputmode="numeric"
        >
      </label>

      <label>
        <span>Tipo de habitación *</span>
        <select name="tipoId" required>
          <option value="">Selecciona un tipo</option>

          ${tipos
            .map(
              (tipo) =>
                `<option value="${tipo.id}">${esc(tipo.nombre)}</option>`,
            )
            .join('')}
        </select>
      </label>

      <label>
        <span>Estado *</span>
        <select name="estadoId" required>
          <option value="">Selecciona un estado</option>

          ${estados
            .map(
              (estado) => `
                <option
                  value="${estado.id}"
                  ${
                    Number(estado.id) === Number(estadoInicial)
                      ? 'selected'
                      : ''
                  }
                >
                  ${esc(estado.nombre)}
                </option>
              `,
            )
            .join('')}
        </select>
      </label>

      <label class="wide">
        <span>Observaciones</span>
        <textarea
          name="observaciones"
          placeholder="Detalles o notas de la habitación"
          maxlength="1000"
        ></textarea>
      </label>

      <div class="room-form-actions">
        <button class="primary" type="submit">
          <i class="fa-solid fa-floppy-disk"></i>
          Guardar habitación
        </button>

        <button
          class="primary danger"
          type="button"
          onclick="limpiarHabitacionForm()"
        >
          <i class="fa-solid fa-ban"></i>
          Cancelar edición
        </button>
      </div>
    </form>
  </div>

  <div class="room-grid">
    ${rows.map(habitacionCard).join('')}
  </div>
`;
  habitacionForm.onsubmit = guardarHabitacion;
  habitacionForm.numero.addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  });

  habitacionForm.piso.addEventListener('input', (event) => {
    const valor = event.target.value.replace(/\D/g, '').slice(0, 3);

    if (valor === '') {
      event.target.value = '';
      return;
    }

    event.target.value = Math.min(Number(valor), 20);
  });
}
async function guardarHabitacion(e) {
  e.preventDefault();

  const form = e.currentTarget;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const datos = Object.fromEntries(new FormData(form));
  const id = datos.id;

  delete datos.id;

  datos.numero = datos.numero.trim();

  datos.piso = datos.piso === '' ? null : Number(datos.piso);

  datos.tipoId = Number(datos.tipoId);
  datos.estadoId = Number(datos.estadoId);

  datos.observaciones =
    datos.observaciones.trim() === '' ? null : datos.observaciones.trim();

  try {
    await api(id ? `/habitaciones/${id}` : '/habitaciones', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(datos),
    });

    await habitaciones();
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la habitación');
  }
}
function editarHabitacion(h) {
  const f = document.getElementById('habitacionForm');
  f.id.value = h.id;
  f.numero.value = h.numero;
  f.piso.value = h.piso ?? '';
  f.tipoId.value = h.tipoId ?? '';
  f.estadoId.value = h.estadoId ?? 1;
  f.observaciones.value = h.observaciones ?? '';
  habitacionFormTitulo.textContent = 'Editar habitación ' + h.numero;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function limpiarHabitacionForm() {
  habitaciones();
}
async function subirFoto(id, input) {
  if (!input.files[0]) return;
  const etiqueta = input.closest('.file-button');
  const textoOriginal = etiqueta.innerHTML;
  etiqueta.classList.add('uploading');
  const fd = new FormData();
  fd.append('foto', input.files[0]);
  try {
    await api(`/habitaciones/${id}/foto`, { method: 'POST', body: fd });
    await habitaciones();
  } catch (error) {
    etiqueta.classList.remove('uploading');
    etiqueta.innerHTML = textoOriginal;
    alert(error.message);
  }
}
async function eliminarFoto(id) {
  if (!confirm('¿Quitar la fotografía?')) return;
  await api(`/habitaciones/${id}/foto`, { method: 'DELETE' });
  habitaciones();
}
async function eliminarHabitacion(id) {
  if (
    !confirm(
      'La habitación se desactivará para conservar su historial. ¿Continuar?',
    )
  )
    return;
  await api(`/habitaciones/${id}`, { method: 'DELETE' });
  habitaciones();
}

async function crud(id) {
  const rows = await api('/' + id);
  let fields =
    id === 'huespedes'
      ? [
          'nombre',
          'apellidoPaterno',
          'apellidoMaterno',
          'telefono',
          'correo',
          'direccion',
          'identificacion',
        ]
      : id === 'usuarios'
        ? [
            'nombre',
            'apellidoPaterno',
            'correo',
            'usuario',
            'password',
            'rolId',
          ]
        : ['nombre', 'descripcion', 'capacidad', 'camas', 'precio'];
  content.innerHTML = `<div class=box><form id=f>${fields.map((x) => `<input name=${x} placeholder="${x}" ${x === 'password' ? 'type=password' : ''}>`).join('')}<button class=primary>Guardar</button></form></div>${table(rows)}`;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    await api('/' + id, { method: 'POST', body: JSON.stringify(d) });
    crud(id);
  };
}
function detalleHabitaciones(raw) {
  return String(raw || '')
    .split(',')
    .filter(Boolean)
    .map((x) => {
      const [numero, foto] = x.split('|');
      return `<div class="selected-room">${foto ? `<img src="${esc(foto)}">` : ''}<span>Hab. ${esc(numero)}</span></div>`;
    })
    .join('');
}
function reservaCard(r) {
  return `<article class="reservation-card"><div><span class="folio">${esc(r.folio)}</span><span class="status status-${String(r.estado).toLowerCase().replaceAll(' ', '-')}">${esc(r.estado)}</span></div><h3>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</h3><p>${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</p><div class="selected-rooms">${detalleHabitaciones(r.habitaciones_detalle)}</div><small>Registró: ${esc(r.recepcionista_nombre || 'Recepción')}</small><div class="actions">${r.estado === 'En proceso' ? `<button class=primary onclick="cambiarReserva(${r.id},'Confirmada')">Confirmar</button>` : ''}${!['Cancelada', 'Finalizada'].includes(r.estado) ? `<button onclick='editarReserva(${JSON.stringify(r).replace(/'/g, '&#39;')})'>Modificar</button><button class=danger onclick="cambiarReserva(${r.id},'Cancelada')">Cancelar</button>` : ''}</div></article>`;
}
async function reservaciones() {
  const [rows, hues] = await Promise.all([
    api('/reservaciones'),
    api('/huespedes'),
  ]);
  window.huespedesReserva = hues;
  content.innerHTML = `<section class="reservation-hero"><div><p class="eyebrow">Módulo de recepción</p><h2>Nueva reservación</h2><p>Consulta disponibilidad, selecciona visualmente las habitaciones y confirma la estancia.</p></div></section><div class="box"><form id="reservaForm"><input type=hidden name=id><select name=huespedId required><option value="">Selecciona huésped</option>${hues.map((h) => `<option value=${h.id}>${esc(h.nombre)} ${esc(h.apellidoPaterno || '')}</option>`)}</select><input name=fechaInicio type=date required><input name=fechaFin type=date required><input name=adultos type=number min=1 value=1><input name=menores type=number min=0 value=0><button type=button class=primary onclick="buscarDisponibles()">Buscar disponibilidad</button></form><div id="availableRooms" class="available-grid"></div><div class="reservation-submit"><label><input id=confirmarReserva type=checkbox checked> Confirmar reservación inmediatamente</label><button class=primary onclick="guardarReserva()">Guardar reservación</button><button onclick="limpiarReserva()">Limpiar</button></div></div><div class="section-title"><h2>Reservaciones registradas</h2><button onclick="api('/reservaciones/liberar-expiradas',{method:'POST'}).then(()=>reservaciones())">Liberar bloqueos vencidos</button></div><div class="reservation-grid">${rows.map(reservaCard).join('')}</div>`;
}
async function buscarDisponibles() {
  const f = reservaForm;
  if (!f.fechaInicio.value || !f.fechaFin.value)
    return alert('Selecciona las fechas');
  const rooms = await api(
    `/reservaciones/disponibles?inicio=${encodeURIComponent(f.fechaInicio.value)}&fin=${encodeURIComponent(f.fechaFin.value)}`,
  );
  availableRooms.innerHTML = rooms.length
    ? rooms
        .map(
          (h) =>
            `<label class="available-room"><input type=checkbox name=habitacionIds value=${h.id}><div class="room-photo">${h.fotoUrl ? `<img src="${esc(h.fotoUrl)}">` : '<span>Sin foto</span>'}</div><strong>Habitación ${esc(h.numero)}</strong><span>${esc(h.tipo?.nombre || 'Sin tipo')} · Piso ${esc(h.piso ?? '-')}</span></label>`,
        )
        .join('')
    : '<p>No hay habitaciones disponibles para esas fechas.</p>';
}
async function guardarReserva() {
  const f = reservaForm;
  const ids = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].map((x) => Number(x.value));
  const d = {
    huespedId: Number(f.huespedId.value),
    fechaInicio: f.fechaInicio.value,
    fechaFin: f.fechaFin.value,
    adultos: Number(f.adultos.value),
    menores: Number(f.menores.value),
    habitacionIds: ids,
    confirmar: confirmarReserva.checked,
  };
  if (!d.huespedId || !ids.length)
    return alert('Selecciona huésped y habitación');
  const id = f.id.value;
  await api(id ? `/reservaciones/${id}` : '/reservaciones', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(d),
  });
  reservaciones();
}
async function editarReserva(r) {
  await reservaciones();
  const f = reservaForm;
  f.id.value = r.id;
  f.huespedId.value = r.huesped_id;
  f.fechaInicio.value = String(r.fecha_inicio).slice(0, 10);
  f.fechaFin.value = String(r.fecha_fin).slice(0, 10);
  if (f.cortesiaPorcentaje) f.cortesiaPorcentaje.value = Number(r.cortesia_porcentaje || 0);
  f.adultos.value = r.adultos;
  f.menores.value = r.menores;
  await buscarDisponibles();
  const nums = String(r.habitaciones_detalle || '')
    .split(',')
    .map((x) => x.split('|')[0]);
  const all = await api('/habitaciones');
  all
    .filter((h) => nums.includes(String(h.numero)))
    .forEach((h) => {
      const cb = document.querySelector(
        `input[name=habitacionIds][value="${h.id}"]`,
      );
      if (cb) cb.checked = true;
    });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function limpiarReserva() {
  reservaciones();
}
async function cambiarReserva(id, estado) {
  if (estado === 'Cancelada' && !confirm('¿Cancelar esta reservación?')) return;
  await api(`/reservaciones/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
  reservaciones();
}
async function recepcion() {
  const [res, h] = await Promise.all([
    api('/reservaciones'),
    api('/recepcion/historial'),
  ]);
  content.innerHTML = `<div class=cards><div class=box><h3>Check-in</h3><form id=fi><input name=reservacionId type=number placeholder="ID reservación"><textarea name=observaciones placeholder=Observaciones></textarea><button class=primary>Registrar</button></form></div><div class=box><h3>Check-out</h3><form id=fo><input name=reservacionId type=number placeholder="ID reservación"><textarea name=observaciones placeholder=Observaciones></textarea><button class=primary>Registrar</button></form></div></div><h3>Reservaciones</h3>${table(res)}<h3>Historial</h3>${table(h)}`;
  fi.onsubmit = (e) => sendForm(e, '/recepcion/checkin', recepcion);
  fo.onsubmit = (e) => sendForm(e, '/recepcion/checkout', recepcion);
}
async function sendForm(e, url, cb) {
  e.preventDefault();
  await api(url, {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
  });
  cb();
}
async function limpieza() {
  const [rows, hs, us, obs] = await Promise.all([
    api('/limpieza'),
    api('/habitaciones'),
    api('/usuarios'),
    api('/limpieza/observaciones'),
  ]);
  const cams = us.filter((x) => x.rol?.nombre === 'Camarista');
  content.innerHTML = `<div class=box><form id=f><select name=habitacionId>${hs.filter((x) => x.activa).map((x) => `<option value=${x.id}>${esc(x.numero)}</option>`)}</select><select name=camaristaId>${cams.map((x) => `<option value=${x.id}>${esc(x.nombre)}</option>`)}</select><input name=fecha type=date value=${new Date().toISOString().slice(0, 10)}><button class=primary>Asignar</button></form></div><h3>Asignaciones</h3>${table(rows)}<h3>Observaciones</h3>${table(obs)}`;
  f.onsubmit = (e) => sendForm(e, '/limpieza/asignar', limpieza);
}
// CRUD completo para los catálogos visibles en el panel.
const camposCrud = {
  huespedes: [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'direccion',
    'identificacion',
  ],
  usuarios: [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'usuario',
    'password',
    'rolId',
  ],
  'tipos-habitacion': ['nombre', 'descripcion', 'capacidad', 'camas', 'precio'],
};
async function crud(id) {
  const rows = await api('/' + id),
    fields = camposCrud[id] || ['nombre'];
  const visibles = fields.filter((x) => x !== 'password');
  content.innerHTML = `<section class="reservation-hero">
    <div>
      <p class="eyebrow">Gestión de Precios</p>
      <h2>Precio Por Habitaciones</h2>
      <p>Administra los datos de las Habitaciones.</p>
    </div>
    <div class="instant-badge">Inventario de Habitaciones</div>
  </section><div class=box><h3 id=crudTitle>Nuevo registro</h3><form id=f><input type=hidden name=id>${fields.map((x) => `<input name=${x} placeholder="${x}" ${x === 'password' ? 'type=password' : ''} ${x === 'nombre' ? 'required' : ''}>`).join('')}<button class=primary><i class="fa-solid fa-floppy-disk"></i> Guardar</button><button class="primary danger" type=button onclick="crud('${id}')"><i class="fa-solid fa-ban"></i> Cancelar edición</button></form></div><div class="box table-wrap"><table><thead><tr>${visibles.map((x) => `<th>${esc(x)}</th>`).join('')}<th>Acciones</th></tr></thead><tbody>${rows.map((r) => `<tr>${visibles.map((x) => `<td>${esc(r[x] ?? (x === 'rolId' ? r.rol?.nombre : ''))}</td>`).join('')}<td class=actions><button class="btn-editar" onclick='editarCrud(${JSON.stringify(id)},${JSON.stringify(r).replace(/'/g, '&#39;')})'><i class="fa-solid fa-pen-to-square"></i> Editar</button><button class="danger btn-eliminar" onclick="eliminarCrud('${id}',${r.id})"><i class="fa-solid fa-trash-can"></i> Eliminar</button></td></tr>`).join('')}</tbody></table></div>`;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)),
      itemId = d.id;
    delete d.id;
    if (itemId && !d.password) delete d.password;
    await api('/' + id + (itemId ? '/' + itemId : ''), {
      method: itemId ? 'PATCH' : 'POST',
      body: JSON.stringify(d),
    });
    crud(id);
  };
}
function editarCrud(id, row) {
  const form = document.getElementById('f');
  form.id.value = row.id;
  (camposCrud[id] || []).forEach((campo) => {
    if (campo !== 'password' && form[campo])
      form[campo].value =
        row[campo] ?? (campo === 'rolId' ? row.rol?.id : '') ?? '';
  });
  crudTitle.textContent = 'Editar registro';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function eliminarCrud(id, itemId) {
  if (!confirm('¿Eliminar este registro de la base de datos?')) return;
  try {
    await api(`/${id}/${itemId}`, { method: 'DELETE' });
    crud(id);
  } catch (e) {
    alert(
      e.message +
        '. Si tiene historial relacionado, el registro no puede eliminarse.',
    );
  }
}

function reservaCard(r) {
  return `<article class="reservation-card"><div><span class="folio">${esc(r.folio)}</span><span class="status status-${String(r.estado).toLowerCase().replaceAll(' ', '-')}">${esc(r.estado)}</span></div><h3>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</h3><p>${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</p><div class="selected-rooms">${detalleHabitaciones(r.habitaciones_detalle)}</div><small>Registró: ${esc(r.recepcionista_nombre || 'Recepción')}</small><div class="actions">${r.estado === 'En proceso' ? `<button class=primary onclick="cambiarReserva(${r.id},'Confirmada')">Confirmar</button>` : ''}${!['Cancelada', 'Finalizada'].includes(r.estado) ? `<button onclick='editarReserva(${JSON.stringify(r).replace(/'/g, '&#39;')})'>Modificar</button><button class=danger onclick="cambiarReserva(${r.id},'Cancelada')">Cancelar</button>` : ''}<button class=danger onclick="eliminarReserva(${r.id})">Eliminar</button></div></article>`;
}
async function reservaciones() {
  const rows = await api('/reservaciones');
  content.innerHTML = `<section class="reservation-hero"><div><p class="eyebrow">Módulo de recepción</p><h2>Nueva reservación</h2><p>1. Captura al huésped y las fechas. 2. Busca y elige la habitación. 3. Guarda la reservación.</p></div></section><div class="box"><form id="reservaForm"><input type=hidden name=id><input type=hidden name=huespedId><h3>Datos del huésped</h3><input name=nombre placeholder="Nombre" required><input name=apellidoPaterno placeholder="Apellido paterno" required><input name=apellidoMaterno placeholder="Apellido materno"><input name=telefono placeholder="Teléfono" required><input name=correo type=email placeholder="Correo"><input name=identificacion placeholder="Identificación"><textarea name=direccion placeholder="Dirección"></textarea><h3>Datos de la estancia</h3><input name=fechaInicio type=date required><input name=fechaFin type=date required><input name=adultos type=number min=1 value=1><input name=menores type=number min=0 value=0><button type=button class=primary onclick="buscarDisponibles()">Buscar disponibilidad</button></form><div id="availableRooms" class="available-grid"></div><div class="reservation-submit"><label><input id=confirmarReserva type=checkbox checked> Confirmar reservación inmediatamente</label><button class=primary onclick="guardarReserva()">Guardar reservación</button><button onclick="limpiarReserva()">Limpiar</button></div></div><div class="section-title"><h2>Reservaciones registradas</h2><button onclick="api('/reservaciones/liberar-expiradas',{method:'POST'}).then(()=>reservaciones())">Liberar bloqueos vencidos</button></div><div class="reservation-grid">${rows.map(reservaCard).join('')}</div>`;
}
async function guardarReserva() {
  const f = reservaForm;
  if (!f.reportValidity()) return;
  const ids = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].map((x) => Number(x.value));
  if (!ids.length) return alert('Selecciona al menos una habitación');
  const d = {
    huespedId: Number(f.huespedId.value) || undefined,
    huesped: {
      nombre: f.nombre.value,
      apellidoPaterno: f.apellidoPaterno.value,
      apellidoMaterno: f.apellidoMaterno.value,
      telefono: f.telefono.value,
      correo: f.correo.value,
      identificacion: f.identificacion.value,
      direccion: f.direccion.value,
    },
    fechaInicio: f.fechaInicio.value,
    fechaFin: f.fechaFin.value,
    adultos: Number(f.adultos.value),
    menores: Number(f.menores.value),
    habitacionIds: ids,
    confirmar: confirmarReserva.checked,
  };
  const id = f.id.value;
  await api(id ? `/reservaciones/${id}` : '/reservaciones', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(d),
  });
  reservaciones();
}
async function editarReserva(r) {
  const huesped = await api(`/huespedes/${r.huesped_id}`);
  await reservaciones();
  const f = reservaForm;
  f.id.value = r.id;
  f.huespedId.value = r.huesped_id;
  [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'identificacion',
    'direccion',
  ].forEach((campo) => (f[campo].value = huesped[campo] || ''));
  f.fechaInicio.value = String(r.fecha_inicio).slice(0, 10);
  f.fechaFin.value = String(r.fecha_fin).slice(0, 10);
  if (f.cortesiaPorcentaje) f.cortesiaPorcentaje.value = Number(r.cortesia_porcentaje || 0);
  f.adultos.value = r.adultos;
  f.menores.value = r.menores;
  await buscarDisponibles();
  const nums = String(r.habitaciones_detalle || '')
    .split(',')
    .map((x) => x.split('|')[0]);
  const all = await api('/habitaciones');
  all
    .filter((h) => nums.includes(String(h.numero)))
    .forEach((h) => {
      const cb = document.querySelector(
        `input[name=habitacionIds][value="${h.id}"]`,
      );
      if (cb) cb.checked = true;
    });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function eliminarReserva(id) {
  if (
    !confirm(
      '¿Eliminar definitivamente esta reservación? La habitación volverá a estar disponible.',
    )
  )
    return;
  await api(`/reservaciones/${id}`, { method: 'DELETE' });
  reservaciones();
}

// Flujo presencial: la reservación queda confirmada inmediatamente y Recepción
// continúa con el check-in/check-out.
function campo(label, control, ancho = '') {
  return `<label class="form-field ${ancho}"><span>${label}</span>${control}</label>`;
}

function reservaCard(r) {
  return `<article class="reservation-card"><div><span class="folio">${esc(r.folio)}</span><span class="status status-${String(r.estado).toLowerCase().replaceAll(' ', '-')}">${esc(r.estado)}</span></div><h3>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</h3><p>${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</p><div class="selected-rooms">${detalleHabitaciones(r.habitaciones_detalle)}</div><small>Registró: ${esc(r.recepcionista_nombre || 'Recepción')}</small><div class="actions">${!['Cancelada', 'Finalizada'].includes(r.estado) ? `<button onclick='editarReserva(${JSON.stringify(r).replace(/'/g, '&#39;')})'>Editar</button><button class=danger onclick="cambiarReserva(${r.id},'Cancelada')">Cancelar</button>` : ''}<button class=danger onclick="eliminarReserva(${r.id})">Eliminar</button></div></article>`;
}

async function reservaciones() {
  const rows = await api('/reservaciones');
  content.innerHTML = `<section class="reservation-hero"><div><p class="eyebrow">Atención presencial</p><h2>Registrar cliente y estancia</h2><p>La reservación se confirma inmediatamente. Después podrás realizar el check-in desde Recepción.</p></div><div class="instant-badge">Confirmación inmediata</div></section><div class="box reservation-form-box"><form id="reservaForm"><input type=hidden name=id><input type=hidden name=huespedId><fieldset><legend>1. Datos del cliente</legend><div class=form-grid>${campo('Nombre *', '<input name=nombre placeholder="Ej. María" required>')}${campo('Apellido paterno *', '<input name=apellidoPaterno placeholder="Ej. Hernández" required>')}${campo('Apellido materno', '<input name=apellidoMaterno placeholder="Ej. López">')}${campo('Teléfono *', '<input name=telefono type=tel placeholder="Ej. 772 123 4567" required>')}${campo('Correo electrónico', '<input name=correo type=email placeholder="cliente@correo.com">')}${campo('Identificación', '<input name=identificacion placeholder="INE, pasaporte, etc.">')}${campo('Dirección', '<textarea name=direccion placeholder="Domicilio del cliente"></textarea>', 'wide')}</div></fieldset><fieldset><legend>2. Datos de la estancia</legend><div class=form-grid>${campo('Fecha de entrada *', '<input name=fechaInicio type=date required>')}${campo('Fecha de salida *', '<input name=fechaFin type=date required>')}${campo('Adultos *', '<input name=adultos type=number min=1 value=1 required>')}${campo('Menores', '<input name=menores type=number min=0 value=0>')}</div><button type=button class="primary search-rooms" onclick="buscarDisponibles()">Buscar habitaciones disponibles</button></fieldset></form><section class=room-selection><h3>3. Selecciona la habitación</h3><p class=helper>Elige una o más habitaciones disponibles para las fechas indicadas.</p><div id="availableRooms" class="available-grid empty-selection">Primero selecciona las fechas y busca disponibilidad.</div></section><div class="reservation-submit"><span class="confirmation-note">✓ Se guardará como <strong>Confirmada</strong></span><button class=primary onclick="guardarReserva()">Confirmar y guardar reservación</button><button onclick="limpiarReserva()">Limpiar formulario</button></div></div><div class="section-title"><h2>Reservaciones registradas</h2></div><div class="reservation-grid">${rows.map(reservaCard).join('')}</div>`;
}

async function guardarReserva() {
  const f = reservaForm;
  if (!f.reportValidity()) return;
  const ids = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].map((x) => Number(x.value));
  if (!ids.length) return alert('Selecciona al menos una habitación');
  const d = {
    huespedId: Number(f.huespedId.value) || undefined,
    huesped: {
      nombre: f.nombre.value,
      apellidoPaterno: f.apellidoPaterno.value,
      apellidoMaterno: f.apellidoMaterno.value,
      telefono: f.telefono.value,
      correo: f.correo.value,
      identificacion: f.identificacion.value,
      direccion: f.direccion.value,
    },
    fechaInicio: f.fechaInicio.value,
    fechaFin: f.fechaFin.value,
    adultos: Number(f.adultos.value),
    menores: Number(f.menores.value),
    habitacionIds: ids,
    confirmar: true,
  };
  const id = f.id.value;
  await api(id ? `/reservaciones/${id}` : '/reservaciones', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(d),
  });
  alert(
    id ? 'Reservación actualizada' : 'Reservación confirmada correctamente',
  );
  reservaciones();
}

async function recepcion() {
  const [res, historial] = await Promise.all([
    api('/reservaciones'),
    api('/recepcion/historial'),
  ]);
  const confirmadas = res.filter((r) => r.estado === 'Confirmada');
  const activas = res.filter(
    (r) => !['Cancelada', 'Finalizada'].includes(r.estado),
  );
  const opciones = (rows) =>
    `<option value="">Selecciona una reservación</option>${rows.map((r) => `<option value=${r.id}>${esc(r.folio)} · ${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')} · Hab. ${esc(String(r.habitaciones_detalle || '').split('|')[0])}</option>`).join('')}`;
  content.innerHTML = `<section class="reservation-hero reception-hero"><div><p class=eyebrow>Operación de recepción</p><h2>Llegadas y salidas</h2><p>Selecciona una reservación confirmada para registrar la llegada o salida del cliente.</p></div></section><div class="reception-grid"><div class="box operation-card"><span class=step-number>1</span><h3>Registrar check-in</h3><p>Confirma que el cliente llegó y entrega la habitación.</p><form id=fi class=operation-form>${campo('Reservación confirmada *', `<select name=reservacionId required>${opciones(confirmadas)}</select>`, 'wide')}${campo('Observaciones de llegada', '<textarea name=observaciones placeholder="Equipaje, solicitudes o notas"></textarea>', 'wide')}<button class=primary>Registrar llegada</button></form></div><div class="box operation-card checkout-card"><span class=step-number>2</span><h3>Registrar check-out</h3><p>Finaliza la estancia y envía la habitación a limpieza.</p><form id=fo class=operation-form>${campo('Reservación activa *', `<select name=reservacionId required>${opciones(activas)}</select>`, 'wide')}${campo('Observaciones de salida', '<textarea name=observaciones placeholder="Daños, objetos olvidados o notas"></textarea>', 'wide')}<button class=primary>Registrar salida</button></form></div></div><div class=section-title><h2>Reservaciones disponibles</h2><button onclick="load('reservaciones','Reservaciones')">Nueva reservación</button></div>${table(res)}<div class=section-title><h2>Historial de recepción</h2></div>${table(historial)}`;
  fi.onsubmit = (e) => sendForm(e, '/recepcion/checkin', recepcion);
  fo.onsubmit = (e) => sendForm(e, '/recepcion/checkout', recepcion);
}

let origenReserva = 'reservaciones';
function formularioReservaHtml(titulo) {
  return `<section class="reservation-hero"><div><p class=eyebrow>Atención presencial</p><h2>${titulo}</h2><p>Captura al cliente, consulta disponibilidad y confirma su habitación inmediatamente.</p></div><div class=instant-badge>Confirmación Inmediata</div></section><div class="box reservation-form-box"><form id=reservaForm><input type=hidden name=id><input type=hidden name=huespedId><fieldset><legend>1. Datos del cliente</legend><div class=form-grid>${campo('Nombre *', '<input name=nombre placeholder="Ej. María" required>')}${campo('Apellido paterno *', '<input name=apellidoPaterno placeholder="Ej. Hernández" required>')}${campo('Apellido materno', '<input name=apellidoMaterno placeholder="Ej. López">')}${campo('Teléfono *', '<input name=telefono type=tel placeholder="Ej. 772 123 4567" required>')}${campo('Correo electrónico', '<input name=correo type=email placeholder="cliente@correo.com">')}${campo('Identificación', '<input name=identificacion placeholder="INE o pasaporte">')}${campo('Dirección', '<textarea name=direccion placeholder="Domicilio del cliente"></textarea>', 'wide')}</div></fieldset><fieldset><legend>2. Datos de la estancia</legend><div class=form-grid>${campo('Fecha de entrada *', '<input name=fechaInicio type=date required>')}${campo('Fecha de salida *', '<input name=fechaFin type=date required>')}${campo('Adultos *', '<input name=adultos type=number min=1 value=1 required>')}${campo('Menores', '<input name=menores type=number min=0 value=0>')}</div><div class="form-btn-container"><button type=button class="btn-search action-btn" onclick="buscarDisponibles()"><i class="fa-solid fa-magnifying-glass"></i> Buscar habitaciones</button></div></fieldset></form><section class=room-selection><h3>3. Selecciona la habitación</h3><p class=helper>Las fotografías te ayudarán a identificar cada habitación.</p><div id=availableRooms class="available-grid empty-selection">Primero selecciona las fechas y busca disponibilidad.</div></section><div class=reservation-submit><span class=confirmation-note>✓ Se guardará como <strong>Confirmada</strong></span><button class="primary create-button" onclick="guardarReserva()"><i class="fa-solid fa-floppy-disk"></i> Crear reservación</button><button class="primary danger" type="button" onclick="limpiarReservaActual()"><i class="fa-solid fa-broom"></i> Limpiar</button></div></div>`;
}
function reservaCard(r) {
  return `<article class=reservation-card><div><span class=folio>${esc(r.folio)}</span><span class="status status-${String(r.estado).toLowerCase().replaceAll(' ', '-')}">${esc(r.estado)}</span></div><h3>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</h3><p>${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</p><div class=selected-rooms>${detalleHabitaciones(r.habitaciones_detalle)}</div><small>Registró: ${esc(r.recepcionista_nombre || 'Recepción')}</small><div class=actions>${!['Cancelada', 'Finalizada'].includes(r.estado) ? `<button class="primary edit-button" onclick='editarReserva(${JSON.stringify(r).replace(/'/g, '&#39;')})'><i class="fa-solid fa-pen-to-square"></i> Editar</button><button class="primary danger" onclick="cambiarReserva(${r.id},'Cancelada')"><i class="fa-solid fa-ban"></i> Cancelar</button>` : ''}<button class="primary danger" onclick="eliminarReserva(${r.id})"><i class="fa-solid fa-trash-can"></i> Eliminar</button></div></article>`;
}
async function reservaciones() {
  origenReserva = 'reservaciones';
  const rows = await api('/reservaciones');
  content.innerHTML =
    formularioReservaHtml('Nueva reservación') +
    `<div class=section-title><h2>Reservaciones registradas</h2></div><div class=reservation-grid>${rows.map(reservaCard).join('')}</div>`;
}
function limpiarReservaActual() {
  origenReserva === 'recepcion' ? recepcion() : reservaciones();
}
async function guardarReserva() {
  const f = reservaForm;
  if (!f.reportValidity()) return;
  const ids = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].map((x) => Number(x.value));
  if (!ids.length) return alert('Selecciona al menos una habitación');
  const d = {
    huespedId: Number(f.huespedId.value) || undefined,
    huesped: {
      nombre: f.nombre.value,
      apellidoPaterno: f.apellidoPaterno.value,
      apellidoMaterno: f.apellidoMaterno.value,
      telefono: f.telefono.value,
      correo: f.correo.value,
      identificacion: f.identificacion.value,
      direccion: f.direccion.value,
    },
    fechaInicio: f.fechaInicio.value,
    fechaFin: f.fechaFin.value,
    adultos: Number(f.adultos.value),
    menores: Number(f.menores.value),
    habitacionIds: ids,
    confirmar: true,
  };
  const id = f.id.value;
  await api(id ? `/reservaciones/${id}` : '/reservaciones', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(d),
  });
  alert(id ? 'Reservación actualizada' : 'Reservación creada correctamente');
  origenReserva === 'recepcion' ? recepcion() : reservaciones();
}
async function recepcion() {
  origenReserva = 'recepcion';
  const [res, historial] = await Promise.all([
    api('/reservaciones'),
    api('/recepcion/historial'),
  ]);
  const confirmadas = res.filter((r) => r.estado === 'Confirmada'),
    activas = res.filter(
      (r) => !['Cancelada', 'Finalizada'].includes(r.estado),
    );
  const opciones = (rows) =>
    `<option value="">Selecciona una reservación</option>${rows.map((r) => `<option value=${r.id}>${esc(r.folio)} · ${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')} · Hab. ${esc(String(r.habitaciones_detalle || '').split('|')[0])}</option>`).join('')}`;
  content.innerHTML =
    formularioReservaHtml('Reservación desde recepción') +
    `<div class="section-title reception-divider"><h2>Check-in y check-out</h2><span>Administra las llegadas y salidas</span></div><div class=reception-grid><div class="box operation-card"><span class=step-number>1</span><h3>Registrar check-in</h3><p>Confirma la llegada y entrega la habitación.</p><form id=fi class=operation-form>${campo('Reservación confirmada *', `<select name=reservacionId required>${opciones(confirmadas)}</select>`, 'wide')}${campo('Observaciones', '<textarea name=observaciones placeholder="Solicitudes o notas"></textarea>', 'wide')}<button class="primary create-button">Registrar llegada</button></form></div><div class="box operation-card checkout-card"><span class=step-number>2</span><h3>Registrar check-out</h3><p>Finaliza la estancia y envía la habitación a limpieza.</p><form id=fo class=operation-form>${campo('Reservación activa *', `<select name=reservacionId required>${opciones(activas)}</select>`, 'wide')}${campo('Observaciones', '<textarea name=observaciones placeholder="Daños u objetos olvidados"></textarea>', 'wide')}<button class="primary create-button">Registrar salida</button></form></div></div><div class=section-title><h2>Clientes y reservaciones</h2></div><div class=reservation-grid>${res.map(reservaCard).join('')}</div><div class=section-title><h2>Historial de recepción</h2></div>${table(historial)}`;
  fi.onsubmit = (e) => sendForm(e, '/recepcion/checkin', recepcion);
  fo.onsubmit = (e) => sendForm(e, '/recepcion/checkout', recepcion);
}
async function dash() {
  const d = await api('/reportes/dashboard');
  content.innerHTML = `<section class=dashboard-hero><div><p class=eyebrow>Resumen del hotel</p><h2>Panel de operaciones</h2><p>Consulta rápidamente el estado del Balneario Dios Padre.</p></div><div class=occupancy-ring style="--value:${Math.min(100, d.porcentajeOcupacion)}"><strong>${d.porcentajeOcupacion}%</strong><span>Ocupación</span></div></section><div class=dashboard-grid><article class="metric-card featured"><i class="fa-solid fa-calendar-check"></i><div><span>Reservaciones confirmadas</span><strong>${d.reservacionesConfirmadas}</strong></div></article>${d.estados.map((x) => `<article class=metric-card><i class="fa-solid fa-hotel"></i><div><span>${esc(x.nombre)}</span><strong>${x.total}</strong></div></article>`).join('')}</div><div class=quick-actions><h3>Acciones rápidas</h3><button class=create-button onclick="load('recepcion','Recepción')"><i class="fa-solid fa-calendar-plus"></i> Nueva reservación</button><button onclick="load('habitaciones','Habitaciones')"><i class="fa-solid fa-bed"></i> Administrar habitaciones y fotos</button></div>`;
}
function recepcionCard(r, accion) {
  const habitacion =
    String(r.habitaciones_detalle || '').split('|')[0] || 'Sin habitación';
  const texto =
    `${r.folio} ${r.huesped_nombre} ${r.huesped_apellido || ''} ${habitacion}`.toLowerCase();
  return `<article class="reception-queue-card" data-search="${esc(texto)}"><div class=queue-main><span class=queue-room>Hab. ${esc(habitacion)}</span><div><strong>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</strong><small>${esc(r.folio)} · ${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</small></div></div><button class="${accion === 'checkin' ? 'checkin-button' : 'checkout-button'}" onclick="accionRecepcion(${r.id},'${accion}')">${accion === 'checkin' ? '<i class="fa-solid fa-bell-concierge"></i> Registrar llegada' : '<i class="fa-solid fa-door-open"></i> Registrar salida'}</button></article>`;
}

async function accionRecepcion(id, accion) {
  const palabra = accion === 'checkin' ? 'llegada' : 'salida';
  if (!confirm(`¿Confirmar la ${palabra} de este cliente?`)) return;
  await api(`/recepcion/${accion}`, {
    method: 'POST',
    body: JSON.stringify({ reservacionId: id, observaciones: '' }),
  });
  alert(
    accion === 'checkin'
      ? 'Llegada registrada. Habitación ocupada.'
      : 'Salida registrada. Habitación enviada a limpieza.',
  );
  recepcion();
}

function mostrarRecepcionTab(tab) {
  document
    .querySelectorAll('.reception-panel')
    .forEach((x) => (x.hidden = x.dataset.panel !== tab));
  document
    .querySelectorAll('.reception-tab')
    .forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
  document
    .getElementById(`panel-${tab}`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filtrarRecepcion(valor) {
  const termino = valor.trim().toLowerCase();
  document
    .querySelectorAll('.reception-queue-card')
    .forEach((card) => (card.hidden = !card.dataset.search.includes(termino)));
}

async function recepcion() {
  origenReserva = 'recepcion';
  const [res, historial] = await Promise.all([
    api('/reservaciones'),
    api('/recepcion/historial'),
  ]);
  const checkins = new Set(
    historial
      .filter((x) => x.tipo === 'Check-in')
      .map((x) => Number(x.reservacion_id)),
  );
  const checkouts = new Set(
    historial
      .filter((x) => x.tipo === 'Check-out')
      .map((x) => Number(x.reservacion_id)),
  );
  const llegadas = res.filter(
    (r) => r.estado === 'Confirmada' && !checkins.has(Number(r.id)),
  );
  const salidas = res.filter(
    (r) =>
      checkins.has(Number(r.id)) &&
      !checkouts.has(Number(r.id)) &&
      r.estado !== 'Finalizada',
  );
  content.innerHTML = `<section class=reception-command><div><p class=eyebrow>Recepción rápida</p><h2>¿Qué necesitas hacer?</h2><p>Primero crea la reservación; después podrás registrar check-in y check-out.</p></div><div class=live-summary><span><strong>${llegadas.length}</strong> check-in</span><span><strong>${salidas.length}</strong> check-out</span></div></section><nav class=reception-tabs><button class="reception-tab active" data-tab=nueva onclick="mostrarRecepcionTab('nueva')"><i class="fa-solid fa-user-plus"></i><strong>Nueva reservación</strong><span>Crear registro</span></button><button class=reception-tab data-tab=llegadas onclick="mostrarRecepcionTab('llegadas')"><i class="fa-solid fa-person-walking-arrow-right"></i><strong>Check-in</strong><span>${llegadas.length} pendientes</span></button><button class=reception-tab data-tab=salidas onclick="mostrarRecepcionTab('salidas')"><i class="fa-solid fa-person-walking-arrow-loop-left"></i><strong>Check-out</strong><span>${salidas.length} pendientes</span></button></nav><section id=panel-nueva class=reception-panel data-panel=nueva>${formularioReservaHtml('Nueva reservación desde recepción')}</section><div class="reception-search">${campo('Buscar cliente, folio o habitación', '<input type=search placeholder="Escribe para filtrar..." oninput="filtrarRecepcion(this.value)">', 'wide')}</div><section id=panel-llegadas class=reception-panel data-panel=llegadas hidden><div class=panel-heading><div><h2>Clientes por llegar</h2><p>Un toque registra el check-in y marca la habitación como ocupada.</p></div></div><div class=queue-list>${llegadas.length ? llegadas.map((r) => recepcionCard(r, 'checkin')).join('') : '<div class=queue-empty>✓ No hay llegadas pendientes</div>'}</div></section><section id=panel-salidas class=reception-panel data-panel=salidas hidden><div class=panel-heading><div><h2>Clientes hospedados</h2><p>Registra el check-out y envía la habitación a limpieza.</p></div></div><div class=queue-list>${salidas.length ? salidas.map((r) => recepcionCard(r, 'checkout')).join('') : '<div class=queue-empty>✓ No hay salidas pendientes</div>'}</div></section><details class=reception-history><summary>Ver historial de movimientos (${historial.length})</summary>${table(historial)}</details>`;
}

async function editarReserva(r) {
  const destino = origenReserva;
  const huesped = await api(`/huespedes/${r.huesped_id}`);
  if (destino === 'recepcion') {
    await recepcion();
    mostrarRecepcionTab('nueva');
  } else await reservaciones();
  const f = reservaForm;
  f.id.value = r.id;
  f.huespedId.value = r.huesped_id;
  [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'identificacion',
    'direccion',
  ].forEach((campo) => (f[campo].value = huesped[campo] || ''));
  f.fechaInicio.value = String(r.fecha_inicio).slice(0, 10);
  f.fechaFin.value = String(r.fecha_fin).slice(0, 10);
  if (f.cortesiaPorcentaje) f.cortesiaPorcentaje.value = Number(r.cortesia_porcentaje || 0);
  f.adultos.value = r.adultos;
  f.menores.value = r.menores;
  await buscarDisponibles();
}

function limpiezaCard(row) {
  return `<article class="cleaning-record ${row.estado === 'Finalizada' ? 'completed' : ''}"><div class=cleaning-icon><i class="fa-solid ${row.estado === 'Finalizada' ? 'fa-check' : 'fa-broom'}"></i></div><div><strong>Habitación ${esc(row.numero)}</strong><span>${esc(row.camarista)} · ${esc(String(row.fecha).slice(0, 10))}</span></div><span class="cleaning-status">${esc(row.estado)}</span></article>`;
}
async function limpieza() {
  const [rows, hs, us, obs] = await Promise.all([
    api('/limpieza'),
    api('/habitaciones'),
    api('/usuarios'),
    api('/limpieza/observaciones'),
  ]);
  const cams = us.filter((x) => x.rol?.nombre === 'Camarista'),
    pendientes = rows.filter((x) => x.estado !== 'Finalizada'),
    finalizadas = rows.filter((x) => x.estado === 'Finalizada');
  const habitacionesAsignables = hs.filter(
    (x) => x.activa && x.estado?.nombre !== 'Ocupada',
  );
  content.innerHTML = `<section class=cleaning-hero><div><p class=eyebrow>Control de limpieza</p><h2>Habitaciones y camaristas</h2><p>Asigna tareas y consulta qué habitaciones ya quedaron disponibles.</p></div><div class=cleaning-counters><span><strong>${pendientes.length}</strong>Pendientes</span><span><strong>${finalizadas.length}</strong>Finalizadas</span></div></section><div class="box cleaning-assignment"><h3>Nueva asignación</h3><form id=f>${campo('Habitación *', `<select name=habitacionId required><option value="">Selecciona habitación</option>${habitacionesAsignables.map((x) => `<option value=${x.id}>Habitación ${esc(x.numero)} · ${esc(x.estado?.nombre || '')}</option>`).join('')}</select>`)}${campo('Camarista *', `<select name=camaristaId required><option value="">Selecciona camarista</option>${cams.map((x) => `<option value=${x.id}>${esc(x.nombre)}</option>`).join('')}</select>`)}${campo('Fecha *', `<input name=fecha type=date required value=${new Date().toISOString().slice(0, 10)}>`)}<div class="form-btn-container"><button class="primary btn-assign-cleaning"><i class="fa-solid fa-paint-roller"></i>Asignar limpieza</button></div></form></div><div class=section-title><div><h2>En limpieza</h2><p>Estas tareas siguen visibles para las camaristas.</p></div></div><div class=cleaning-list>${pendientes.length ? pendientes.map(limpiezaCard).join('') : '<div class=queue-empty>No hay limpiezas pendientes</div>'}</div><div class="section-title completed-heading"><div><h2>Habitaciones finalizadas</h2><p>Ya aparecen como Disponibles para Administración y se conservan aquí como registro.</p></div><span class=completed-total>${finalizadas.length} registros</span></div><div class="cleaning-list completed-list">${finalizadas.length ? finalizadas.map(limpiezaCard).join('') : '<div class=queue-empty>Aún no hay habitaciones finalizadas</div>'}</div><details class=reception-history><summary>Observaciones e incidencias (${obs.length})</summary>${table(obs)}</details>`;
  f.onsubmit = (e) => sendForm(e, '/limpieza/asignar', limpieza);
}
const bloqueosReserva = new Set();
async function cambiarBloqueo(input) {
  if (input.dataset.asignadaActualmente === 'true') return;
  try {
    await api(`/reservaciones/bloqueo/${input.value}`, {
      method: input.checked ? 'POST' : 'DELETE',
    });
    input.checked
      ? bloqueosReserva.add(Number(input.value))
      : bloqueosReserva.delete(Number(input.value));
  } catch (error) {
    input.checked = false;
    alert(error.message);
    await buscarDisponibles();
  }
}
async function liberarBloqueosReserva() {
  await Promise.all(
    [...bloqueosReserva].map((id) =>
      api(`/reservaciones/bloqueo/${id}`, { method: 'DELETE' }).catch(() => {}),
    ),
  );
  bloqueosReserva.clear();
}
document.addEventListener('click', (event) => {
  if (bloqueosReserva.size && event.target.closest('aside nav button'))
    void liberarBloqueosReserva();
});
async function buscarDisponibles() {
  const f = reservaForm;
  if (!f.fechaInicio.value || !f.fechaFin.value)
    return alert('Selecciona las fechas');
  await liberarBloqueosReserva();
  const reservacionId = Number(f.id.value) || null;
  const reservacionQuery = reservacionId
    ? `&reservacionId=${encodeURIComponent(reservacionId)}`
    : '';
  const rooms = await api(
    `/reservaciones/disponibles?inicio=${encodeURIComponent(f.fechaInicio.value)}&fin=${encodeURIComponent(f.fechaFin.value)}${reservacionQuery}`,
  );
  availableRooms.innerHTML = rooms.length
    ? rooms
        .map(
          (h) =>
            `<label class="available-room"><input type=checkbox name=habitacionIds value=${h.id} ${h.asignadaActualmente ? 'checked data-asignada-actualmente=true' : ''} onchange="cambiarBloqueo(this)"><div class=room-photo>${h.fotoUrl ? `<img src="${esc(h.fotoUrl)}">` : '<span>Sin foto</span>'}</div><strong>Habitación ${esc(h.numero)}</strong><span>${esc(h.tipo?.nombre || 'Sin tipo')} · Piso ${esc(h.piso ?? '-')}${h.asignadaActualmente ? ' · Asignada actualmente' : ''}</span></label>`,
        )
        .join('')
    : '<p>No hay habitaciones disponibles para esas fechas.</p>';
}
async function limpiarReservaActual() {
  await liberarBloqueosReserva();
  origenReserva === 'recepcion' ? recepcion() : reservaciones();
}
function fechaLocal(fecha = new Date()) {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function activarValidacionFechas(contenedor = document) {
  const hoy = fechaLocal();
  contenedor
    .querySelectorAll('input[type="date"]:not([data-allow-past])')
    .forEach((input) => {
      input.min = hoy;
      input.addEventListener('change', () => {
        if (input.value && input.value < hoy) {
          input.setCustomValidity(
            'La fecha no puede ser anterior al día de hoy.',
          );
          input.reportValidity();
        } else input.setCustomValidity('');
      });
    });
  const inicio = contenedor.querySelector('[name="fechaInicio"]');
  const fin = contenedor.querySelector('[name="fechaFin"]');
  if (inicio && fin) {
    const sincronizar = () => {
      fin.min = inicio.value || hoy;
      if (fin.value && inicio.value && fin.value <= inicio.value) {
        fin.setCustomValidity('La salida debe ser posterior a la entrada.');
      } else fin.setCustomValidity('');
    };
    inicio.addEventListener('change', sincronizar);
    fin.addEventListener('change', sincronizar);
    sincronizar();
  }
}

const observarFormularios = new MutationObserver(() =>
  activarValidacionFechas(content),
);
observarFormularios.observe(content, { childList: true, subtree: true });

function datosJs(valor) {
  return encodeURIComponent(JSON.stringify(valor)).replace(/'/g, '%27');
}

async function usuarios() {
  const [rows, roles] = await Promise.all([
    api('/usuarios'),
    api('/usuarios/roles'),
  ]);
  window.usuariosData = rows;
  window.rolesData = roles;
  content.innerHTML = `
  <section class="reservation-hero">
    <div>
      <h2>Usuarios</h2>
      <p>Gestión de accesos y perfiles del sistema.</p>
    </div>

    <button
      class="primary create-button"
      onclick="mostrarFormularioUsuario()"
    >
      <i class="fa-solid fa-user-plus"></i>
      Nuevo usuario
    </button>
  </section>

  <section class="box usuarios-panel">
    <div class="usuarios-toolbar">
      <input
        id="buscarUsuario"
        type="search"
        placeholder="Buscar por nombre, correo o usuario..."
        oninput="filtrarUsuarios()"
      >

      <select id="filtroRol" onchange="filtrarUsuarios()">
        <option value="">Todos los roles</option>

        ${roles
          .map(
            (r) => `<option value="${esc(r.nombre)}">${esc(r.nombre)}</option>`,
          )
          .join('')}
      </select>

      <select id="filtroEstado" onchange="filtrarUsuarios()">
        <option value="">Todos los estados</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Inactivos</option>
      </select>
    </div>

    <div id="tablaUsuarios">
      ${crearTablaUsuarios(rows)}
    </div>
  </section>

  <div id="modalUsuario" class="modal-usuario">
    <div class="modal-usuario-contenido">
      <header>
        <div>
          <h3 id="modalUsuarioTitulo">Nuevo usuario</h3>
          <p>Completa los datos del perfil.</p>
        </div>

        <button
          type="button"
          onclick="cerrarFormularioUsuario()"
        >
          ×
        </button>
      </header>

      <form id="usuarioForm" class="usuario-form">
        <input type="hidden" name="id">

        ${campoUsuario(
          'Nombre *',
          'nombre',
          'text',
          `required
           minlength="2"
           maxlength="100"
           pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+([ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*"
           title="Solo se permiten letras, espacios, guiones y apóstrofes"`,
        )}

        ${campoUsuario(
          'Apellido paterno',
          'apellidoPaterno',
          'text',
          `minlength="2"
           maxlength="100"
           pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+([ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*"
           title="Solo se permiten letras, espacios, guiones y apóstrofes"`,
        )}

        ${campoUsuario(
          'Apellido materno',
          'apellidoMaterno',
          'text',
          `minlength="2"
           maxlength="100"
           pattern="[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+([ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*"
           title="Solo se permiten letras, espacios, guiones y apóstrofes"`,
        )}

        ${campoUsuario(
          'Teléfono',
          'telefono',
          'tel',
          `inputmode="numeric"
           minlength="10"
           maxlength="10"
           pattern="[0-9]{10}"
           title="Ingresa exactamente 10 dígitos"`,
        )}

        ${campoUsuario(
          'Correo',
          'correo',
          'email',
          `maxlength="150"
           title="Ingresa un correo electrónico válido"`,
        )}

        ${campoUsuario(
          'Nombre de usuario *',
          'usuario',
          'text',
          `required
           minlength="4"
           maxlength="50"
           pattern="[A-Za-z0-9._-]+"
           title="Solo se permiten letras, números, puntos, guiones y guiones bajos"`,
        )}

        ${campoUsuario(
          'Contraseña',
          'password',
          'password',
          `minlength="8"
           maxlength="72"
           title="La contraseña debe tener entre 8 y 72 caracteres"`,
        )}

        <label class="campo-usuario">
          <span>Rol *</span>

          <select name="rolId" required>
            <option value="">Selecciona un rol</option>

            ${roles
              .filter((r) => r.nombre !== 'Superadministrador' || user?.rol === 'Superadministrador')
              .map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`)
              .join('')}
          </select>
        </label>

        <div class="modal-usuario-acciones">
          <button
            type="button"
            onclick="cerrarFormularioUsuario()"
          >
            Cancelar
          </button>

          <button
            id="btnGuardarUsuario"
            class="primary"
          >
            Guardar usuario
          </button>
        </div>
      </form>
    </div>
  </div>
`;
  usuarioForm.onsubmit = guardarUsuario;
  usuarioForm.telefono.addEventListener(
    'input',
    (e) => (e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10)),
  );
  const camposNombre = [
    usuarioForm.nombre,
    usuarioForm.apellidoPaterno,
    usuarioForm.apellidoMaterno,
  ];

  camposNombre.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü '-]/g, '');
    });
  });
}

function campoUsuario(etiqueta, nombre, tipo = 'text', atributos = '') {
  return `<label class=campo-usuario><span>${etiqueta}</span><input name=${nombre} type=${tipo} ${atributos}></label>`;
}
function crearTablaUsuarios(rows) {
  if (!rows.length)
    return '<div class=usuarios-vacio>No se encontraron usuarios.</div>';
  return `<div class=table-wrap><table class=usuarios-table><thead><tr><th>Usuario</th><th>Contacto</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.map((u) => `<tr><td><div class=usuario-info><span class=usuario-avatar>${esc((u.nombre || 'U')[0].toUpperCase())}</span><div><strong>${esc([u.nombre, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(' '))}</strong><small>@${esc(u.usuario)}</small></div></div></td><td>${esc(u.correo || 'Sin correo')}<small>${esc(u.telefono || 'Sin teléfono')}</small></td><td><span class=rol-badge>${esc(u.rol?.nombre || 'Sin rol')}</span></td><td><span class="estado-usuario ${u.activo ? 'activo' : 'inactivo'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td><td><div class=usuario-acciones><button class=usuario-edit-button title="Editar usuario" aria-label="Editar usuario" onclick="editarUsuario(decodeURIComponent('${datosJs(u)}'))"><i class="fa-solid fa-pen"></i></button><button class="usuario-status-button ${u.activo ? 'is-active' : 'is-inactive'}" title="${u.activo ? 'Desactivar usuario' : 'Activar usuario'}" aria-label="${u.activo ? 'Desactivar usuario' : 'Activar usuario'}" onclick="cambiarEstadoUsuario(${u.id})"><i class="fa-solid fa-power-off"></i></button><button class=usuario-delete-button title="Desactivar usuario" aria-label="Desactivar usuario" onclick="eliminarUsuario(${u.id})"><i class="fa-solid fa-trash-can"></i></button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function filtrarUsuarios() {
  const texto = buscarUsuario.value.toLowerCase().trim();
  const filtrados = window.usuariosData.filter(
    (u) =>
      `${u.nombre || ''} ${u.apellidoPaterno || ''} ${u.correo || ''} ${u.usuario || ''}`
        .toLowerCase()
        .includes(texto) &&
      (!filtroRol.value || u.rol?.nombre === filtroRol.value) &&
      (!filtroEstado.value ||
        (filtroEstado.value === 'activo') === Boolean(u.activo)),
  );
  tablaUsuarios.innerHTML = crearTablaUsuarios(filtrados);
}
function mostrarFormularioUsuario() {
  usuarioForm.reset();
  usuarioForm.id.value = '';
  usuarioForm.password.required = true;
  modalUsuarioTitulo.textContent = 'Nuevo usuario';
  modalUsuario.classList.add('activo');
}
function cerrarFormularioUsuario() {
  modalUsuario?.classList.remove('activo');
}
function editarUsuario(data) {
  const u = JSON.parse(data),
    f = usuarioForm;
  mostrarFormularioUsuario();
  f.id.value = u.id;
  [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'usuario',
  ].forEach((k) => (f[k].value = u[k] ?? ''));
  f.rolId.value = u.rolId ?? u.rol?.id ?? '';
  f.password.required = false;
  modalUsuarioTitulo.textContent = 'Editar usuario';
}
async function guardarUsuario(e) {
  e.preventDefault();
  if (!e.target.reportValidity()) return;
  const d = Object.fromEntries(new FormData(e.target));
  const id = d.id;
  delete d.id;
  Object.keys(d).forEach((k) => {
    if (typeof d[k] === 'string') d[k] = d[k].trim();
  });
  if (!d.password) delete d.password;
  await api(id ? `/usuarios/${id}` : '/usuarios', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(d),
  });
  cerrarFormularioUsuario();
  usuarios();
}
async function cambiarEstadoUsuario(id) {
  await api(`/usuarios/${id}/estado`, { method: 'PATCH' });
  usuarios();
}
async function eliminarUsuario(id) {
  if (confirm('¿Desactivar este usuario?')) {
    await api(`/usuarios/${id}`, { method: 'DELETE' });
    usuarios();
  }
}

function rangoReporte(tipo) {
  const fin = new Date(),
    inicio = new Date(fin);
  if (tipo === 'dia') inicio.setDate(fin.getDate());
  if (tipo === 'semana') inicio.setDate(fin.getDate() - 6);
  if (tipo === 'mes') inicio.setMonth(fin.getMonth(), 1);
  if (tipo === 'anio') inicio.setMonth(0, 1);
  reporteInicio.value = fechaLocal(inicio);
  reporteFin.value = fechaLocal(fin);
  generarReporte();
}
async function reportes() {
  const fin = fechaLocal(),
    inicio = fechaLocal(new Date(Date.now() - 29 * 86400000));
  content.innerHTML = `<section class=report-hero><div><p class=eyebrow>Información para decisiones</p><h2>Reportes del hotel</h2><p>Filtra el periodo, revisa los resultados y descarga un PDF organizado.</p></div><img src="hotel-ixmiquilpan.png" alt="Hotel Dios Padre"></section><section class="box report-filters"><div class=quick-periods><button onclick="rangoReporte('dia')">Hoy</button><button onclick="rangoReporte('semana')">Semana</button><button onclick="rangoReporte('mes')">Mes</button><button onclick="rangoReporte('anio')">Año</button></div><label>Desde<input id=reporteInicio type=date data-allow-past value=${inicio}></label><label>Hasta<input id=reporteFin type=date data-allow-past value=${fin}></label><button class=primary onclick=generarReporte()><i class="fa-solid fa-filter"></i>Aplicar filtros</button><button id=btnDescargarReporte class=create-button onclick=descargarReportePdf()><i class="fa-solid fa-file-pdf"></i> Descargar PDF</button></section><div id=resultadosReporte><div class="box empty">Cargando reporte...</div></div>`;
  await generarReporte();
}
function normalizarFilasReporte(valor) {
  if (Array.isArray(valor)) return valor;
  if (Array.isArray(valor?.data)) return valor.data;
  if (Array.isArray(valor?.rows)) return valor.rows;
  if (
    valor &&
    typeof valor === 'object' &&
    ('tipo' in valor || 'fecha' in valor)
  ) {
    return [valor];
  }
  const elementos =
    valor && typeof valor === 'object' ? Object.values(valor) : [];
  return elementos.length &&
    elementos.every(
      (item) => item && typeof item === 'object' && !Array.isArray(item),
    )
    ? elementos
    : [];
}
let reporteActual = {
  ocupacion: [],
  tiposHabitacion: [],
  ingresosPorDia: [],
  inicio: '',
  fin: '',
};
async function generarReporte() {
  const inicio = reporteInicio.value,
    fin = reporteFin.value;
  if (!inicio || !fin || inicio > fin)
    return alert('Selecciona un rango de fechas válido.');
  const q = `?inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`;
  const contenedor = document.getElementById('resultadosReporte');
  contenedor.innerHTML = '<div class="box empty">Cargando reporte...</div>';
  try {
    const [
      ocupacionRespuesta,
      tiposHabitacionRespuesta,
      ingresosPorDiaRespuesta,
    ] = await Promise.all([
      api('/reportes/ocupacion' + q),
      api('/reportes/tipos-habitacion' + q),
      api('/reportes/ingresos-por-dia' + q),
    ]);
    const ocupacion = normalizarFilasReporte(ocupacionRespuesta),
      tiposHabitacion = normalizarFilasReporte(tiposHabitacionRespuesta),
      ingresosPorDia = normalizarFilasReporte(ingresosPorDiaRespuesta);
    reporteActual = { ocupacion, tiposHabitacion, ingresosPorDia, inicio, fin };
    const total = ocupacion.reduce(
        (s, r) => s + Number(r.reservaciones || 0),
        0,
      ),
      huespedes = ocupacion.reduce((s, r) => s + Number(r.huespedes || 0), 0),
      usos = tiposHabitacion.reduce((s, r) => s + Number(r.usos || 0), 0),
      ganancias = tiposHabitacion.reduce(
        (s, r) => s + Number(r.ganancias || 0),
        0,
      );
    const tiposFormateados = tiposHabitacion.map((r) => ({
      ...r,
      ganancias: new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(Number(r.ganancias || 0)),
    }));
    const diasFormateados = ingresosPorDia.map((r) => ({
      ...r,
      dia: String(r.dia).slice(0, 10),
      ganancias: new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(Number(r.ganancias || 0)),
    }));
    contenedor.innerHTML = `<div class=report-summary><article><span>Reservaciones</span><strong>${total}</strong></article><article><span>Huéspedes</span><strong>${huespedes}</strong></article><article><span>Usos por tipo de habitación</span><strong>${usos}</strong></article><article><span>Ganancias totales</span><strong>${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(ganancias)}</strong></article></div><div class=report-grid><section><h3>Ocupación por día</h3>${table(ocupacion)}</section><section><h3>Ocupación y ganancias por tipo de habitación</h3>${table(tiposFormateados)}</section><section class=report-daily><h3>Días con mayores ingresos</h3>${table(diasFormateados)}</section></div>`;
  } catch (error) {
    contenedor.innerHTML = `<div class="box error"><strong>No se pudo cargar el reporte.</strong><p>${esc(error.message)}</p><button class=primary onclick=generarReporte()>Reintentar</button></div>`;
  }
}
async function descargarReportePdf() {
  const inicio = reporteInicio.value,
    fin = reporteFin.value;
  if (!inicio || !fin || inicio > fin)
    return alert('Selecciona un rango de fechas válido.');
  const boton = document.getElementById('btnDescargarReporte');
  const textoOriginal = boton.innerHTML;
  boton.disabled = true;
  boton.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';
  try {
    const respuesta = await fetch(
      `/api/reportes/pdf-ganancias?inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`,
      { headers: { Authorization: 'Bearer ' + token } },
    );
    if (!respuesta.ok) {
      const error = await respuesta.json().catch(() => ({}));
      throw Error(
        Array.isArray(error.message)
          ? error.message.join(', ')
          : error.message || 'No se pudo generar el PDF',
      );
    }
    if (respuesta.headers.get('X-Report-Version') !== 'tipos-ganancias-v2')
      throw Error(
        'El servidor sigue usando el generador anterior. Ejecuta nuevamente el build y reinicia el servidor.',
      );
    const archivo = await respuesta.blob();
    if (archivo.type !== 'application/pdf' || archivo.size < 100)
      throw Error('El archivo PDF generado no es válido.');
    const url = URL.createObjectURL(archivo),
      enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `reporte-hotel-${inicio}-${fin}-ingresos.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
    boton.innerHTML = textoOriginal;
  }
}

load('dashboard', 'Panel Principal');
// ==========================================
// CONTROL DEL MENÚ RESPONSIVO EN MÓVILES
// ==========================================

// 1. Abrir la franja azul al tocarla
document.querySelector('aside')?.addEventListener('click', function (e) {
    if (window.innerWidth <= 768) {
        // Solo abre si no está abierto ya
        if (!this.classList.contains('active-mobile')) {
            this.classList.add('active-mobile');
        }
    }
});

// 2. Cerrar si el usuario toca en la parte blanca (afuera del aside)
document.addEventListener('click', function (e) {
    if (window.innerWidth <= 768) {
        const aside = document.querySelector('aside');
        if (aside && !aside.contains(e.target)) {
            aside.classList.remove('active-mobile');
        }
    }
});

// 3. Cerrar AUTOMÁTICAMENTE al dar clic en cualquier opción/módulo
document.querySelectorAll('aside nav a, aside nav button, aside nav ul li').forEach(item => {
    item.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            e.stopPropagation(); // DETIENE que el clic suba al 'aside' y lo vuelva a abrir
            const aside = document.querySelector('aside');
            if (aside) {
                aside.classList.remove('active-mobile');
            }
        }
    });
});

// =========================================================
// MÓDULO IV. FORMAS DE PAGO (INYECTADO AL FINAL SIN CHOCAR)
// =========================================================
var listaPagosReserva = [];
var catalogoHabitacionesPago = [];
var totalReservacionCalculado = 0;

async function cargarPreciosHabitacionesPago() {
  try {
    catalogoHabitacionesPago = await api('/habitaciones');
  } catch (e) {
    catalogoHabitacionesPago = [];
  }
}

function calcularNochesEstancia() {
  const f = document.getElementById('reservaForm');
  if (!f || !f.fechaInicio?.value || !f.fechaFin?.value) return 1;
  const inicio = new Date(f.fechaInicio.value);
  const fin = new Date(f.fechaFin.value);
  const diff = Math.round((fin - inicio) / 86400000);
  return diff > 0 ? diff : 1;
}

function recalcularSaldosPago() {
  const input = document.querySelector('[name=cortesiaPorcentaje]');
  if (!input) return false;
  const maximo =
    input.dataset.maximoAutorizado === undefined
      ? null
      : Number(input.dataset.maximoAutorizado);
  const validacion = CortesiasUI.validarPorcentaje(
    input.value,
    maximo,
    input.validity.badInput,
  );
  if (input.dataset.errorLimite) {
    validacion.valido = false;
    validacion.mensaje = input.dataset.errorLimite;
  }
  input.setCustomValidity(validacion.mensaje);
  input.setAttribute('aria-invalid', String(!validacion.valido));
  const error = document.getElementById('errorCortesia');
  if (error) {
    error.textContent = validacion.mensaje;
    error.hidden = validacion.valido;
  }
  document.querySelectorAll('[data-guardar-reserva]').forEach((button) => {
    button.disabled = !validacion.valido;
  });

  const noches = calcularNochesEstancia();
  const subtotal = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].reduce((suma, checkbox) => {
    const hab = catalogoHabitacionesPago.find(
      (h) => Number(h.id) === Number(checkbox.value),
    );
    const precio = Number(hab?.tipo?.precio ?? hab?.precio ?? 0);
    return (
      suma + (Number.isFinite(precio) && precio >= 0 ? precio * noches : 0)
    );
  }, 0);
  const totalPagado = listaPagosReserva.reduce(
    (suma, p) => suma + Number(p.importe || 0),
    0,
  );
  const importes = CortesiasUI.calcularImportes(
    subtotal,
    totalPagado,
    validacion,
  );
  totalReservacionCalculado = importes.total;
  const inputSubtotal = document.getElementById('pago_total_manual');
  if (inputSubtotal) inputSubtotal.value = subtotal.toFixed(2);
  const mostrar = (id, valor) => {
    const element = document.getElementById(id);
    if (element)
      element.textContent = valor === null ? '—' : '$' + valor.toFixed(2);
  };
  mostrar('resumen_descuento_reserva', importes.descuento);
  mostrar('resumen_total_reserva', importes.total);
  mostrar('resumen_total_pagado', importes.pagado);
  mostrar('resumen_saldo_pendiente', importes.saldo);
  return validacion.valido;
}

function cambiarMetodoPagoUI() {
  const metodo = document.getElementById('pago_metodo')?.value || '';
  const campoTerm = document.getElementById('wrap_terminacion_tarjeta');
  const inputTerm = document.getElementById('pago_terminacion');
  const lblBanco = document.getElementById('lbl_pago_banco');
  const lblRef = document.getElementById('lbl_pago_referencia');

  const esTarjeta =
    metodo === 'Tarjeta de débito' || metodo === 'Tarjeta de crédito';
  if (campoTerm) campoTerm.style.display = esTarjeta ? '' : 'none';
  if (!esTarjeta && inputTerm) inputTerm.value = '';

  if (lblBanco) {
    lblBanco.textContent =
      metodo === 'Transferencia bancaria' ? 'Banco receptor *' : 'Banco *';
  }
  if (lblRef) {
    lblRef.textContent = esTarjeta
      ? 'Referencia / Núm. operación (opcional)'
      : 'Número o referencia de operación *';
  }
}

function registrarPagoEnLista() {
  const metodo = document.getElementById('pago_metodo')?.value || '';
  const importe = parseFloat(document.getElementById('pago_importe')?.value);
  const banco = (document.getElementById('pago_banco')?.value || '').trim();
  const fecha = document.getElementById('pago_fecha')?.value || '';
  const terminacion = (
    document.getElementById('pago_terminacion')?.value || ''
  ).trim();
  const referencia = (
    document.getElementById('pago_referencia')?.value || ''
  ).trim();

  if (!metodo) return alert('Selecciona una forma de pago.');
  if (isNaN(importe) || importe <= 0)
    return alert('Ingresa un importe válido mayor a 0.');
  if (!banco) return alert('Ingresa el banco.');
  if (!fecha) return alert('Ingresa la fecha del pago.');

  const esTarjeta =
    metodo === 'Tarjeta de débito' || metodo === 'Tarjeta de crédito';
  if (esTarjeta && !/^\d{4}$/.test(terminacion)) {
    return alert(
      'Por seguridad, ingresa exactamente los últimos 4 dígitos numéricos de la tarjeta.',
    );
  }
  if (!esTarjeta && !referencia) {
    return alert('Ingresa el número o referencia de operación.');
  }

  listaPagosReserva.push({
    idTemp: Date.now(),
    metodo_pago: metodo,
    importe: Number(importe.toFixed(2)),
    banco,
    fecha_pago: fecha,
    terminacion_tarjeta: esTarjeta ? terminacion : null,
    referencia: referencia || null,
  });

  document.getElementById('pago_importe').value = '';
  document.getElementById('pago_banco').value = '';
  document.getElementById('pago_terminacion').value = '';
  document.getElementById('pago_referencia').value = '';

  renderTablaPagosReserva();
}

function quitarPagoDeLista(idTemp) {
  listaPagosReserva = listaPagosReserva.filter((p) => p.idTemp !== idTemp);
  renderTablaPagosReserva();
}

function renderTablaPagosReserva() {
  const tbody = document.getElementById('tbody_pagos_reserva');
  if (!tbody) return;

  if (!listaPagosReserva.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#666;">Aún no se han registrado pagos para esta reservación.</td></tr>';
  } else {
    tbody.innerHTML = listaPagosReserva
      .map(
        (p) => `
      <tr>
        <td>${esc(p.metodo_pago)}</td>
        <td>${esc(p.banco)}</td>
        <td>${p.terminacion_tarjeta ? '**** ' + esc(p.terminacion_tarjeta) : '-'}</td>
        <td>${esc(p.referencia || '-')}</td>
        <td>${esc(p.fecha_pago)}</td>
        <td><strong>$${Number(p.importe).toFixed(2)}</strong></td>
        <td><button type="button" class="primary danger" style="padding:4px 8px;" onclick="quitarPagoDeLista(${p.idTemp})">Quitar</button></td>
      </tr>
    `,
      )
      .join('');
  }
  recalcularSaldosPago();
}

// Sobrescribimos limpiamente formularioReservaHtml agregando el Paso 4
window.formularioReservaHtml = function (titulo) {
  listaPagosReserva = [];
  totalReservacionCalculado = null;
  const hoy = fechaLocal();
  setTimeout(() => {
    cargarPreciosHabitacionesPago().then(() => renderTablaPagosReserva());
  }, 50);

  return `<section class="reservation-hero"><div><p class=eyebrow>Atención presencial</p><h2>${titulo}</h2><p>Captura al cliente, consulta disponibilidad y confirma su habitación inmediatamente.</p></div><div class=instant-badge>Confirmación Inmediata</div></section>
  <div class="box reservation-form-box">
    <form id=reservaForm>
      <input type=hidden name=id>
      <input type=hidden name=huespedId>
      <fieldset>
        <legend>1. Datos del cliente</legend>
        <div class=form-grid>
          ${campo('Nombre *', '<input name=nombre placeholder="Ej. María" required>')}
          ${campo('Apellido paterno *', '<input name=apellidoPaterno placeholder="Ej. Hernández" required>')}
          ${campo('Apellido materno', '<input name=apellidoMaterno placeholder="Ej. López">')}
          ${campo('Teléfono *', '<input name=telefono type=tel placeholder="Ej. 772 123 4567" required>')}
          ${campo('Correo electrónico', '<input name=correo type=email placeholder="cliente@correo.com">')}
          ${campo('Identificación', '<input name=identificacion placeholder="INE o pasaporte">')}
          ${campo('Dirección', '<textarea name=direccion placeholder="Domicilio del cliente"></textarea>', 'wide')}
        </div>
      </fieldset>
      <fieldset>
        <legend>2. Datos de la estancia</legend>
        <div class=form-grid>
          ${campo('Fecha de entrada *', '<input name=fechaInicio type=date required onchange="recalcularSaldosPago()">')}
          ${campo('Fecha de salida *', '<input name=fechaFin type=date required onchange="recalcularSaldosPago()">')}
          ${campo('Cortesía (%)', '<input name=cortesiaPorcentaje type=number min=0 max=100 step=0.01 value=0 required aria-describedby="limiteCortesia errorCortesia" oninput="recalcularSaldosPago()" onchange="recalcularSaldosPago()"><small id=errorCortesia role=alert aria-live=polite style="color:#b91c1c" hidden></small>')}
          <p id=limiteCortesia>Consultando límite autorizado…</p>
          ${campo('Adultos *', '<input name=adultos type=number min=1 value=1 required>')}
          ${campo('Menores', '<input name=menores type=number min=0 value=0>')}
        </div>
        <div class="form-btn-container">
          <button type=button class="btn-search action-btn" onclick="buscarDisponibles()"><i class="fa-solid fa-magnifying-glass"></i> Buscar habitaciones</button>
        </div>
      </fieldset>
    </form>

    <section class=room-selection onchange="recalcularSaldosPago()">
      <h3>3. Selecciona la habitación</h3>
      <p class=helper>Las fotografías te ayudarán a identificar cada habitación.</p>
      <div id=availableRooms class="available-grid empty-selection">Primero selecciona las fechas y busca disponibilidad.</div>
    </section>

    <section class=room-selection style="margin-top:24px; border-top:1px solid #e2e8f0; padding-top:20px;">
      <h3>4. Formas de pago (Obligatorio)</h3><p>La cortesía reduce el total de la estancia; no es un pago. Los pagos registrados se conservan.</p>
      <p class=helper style="background:#fff3cd; color:#664d03; padding:10px 12px; border-radius:6px; border:1px solid #ffecb5;">
        <i class="fa-solid fa-shield-halved"></i> <strong>Seguridad:</strong> No ingreses ni almacenes números completos de tarjeta ni CVV. Registra únicamente los últimos 4 dígitos.
      </p>

      <div class=form-grid style="margin-top:12px;">
        <label class="form-field">
          <span>Forma de pago *</span>
          <select id="pago_metodo" onchange="cambiarMetodoPagoUI()">
            <option value="">Selecciona opción...</option>
            <option value="Tarjeta de débito">1. Tarjeta de débito</option>
            <option value="Tarjeta de crédito">2. Tarjeta de crédito</option>
            <option value="Transferencia bancaria">3. Transferencia bancaria</option>
            <option value="Depósito bancario">4. Depósito bancario</option>
          </select>
        </label>

        <label class="form-field">
          <span>Importe ($) *</span>
          <input id="pago_importe" type="number" min="0.01" step="0.01" placeholder="Ej. 1500.00">
        </label>

        <label class="form-field">
          <span id="lbl_pago_banco">Banco *</span>
          <input id="pago_banco" type="text" placeholder="Ej. BBVA, Banamex, Santander">
        </label>

        <label class="form-field">
          <span>Fecha del pago *</span>
          <input id="pago_fecha" type="date" data-allow-past value="${hoy}">
        </label>

        <label class="form-field" id="wrap_terminacion_tarjeta" style="display:none;">
          <span>Terminación tarjeta (últimos 4 dígitos) *</span>
          <input id="pago_terminacion" type="text" maxlength="4" inputmode="numeric" pattern="[0-9]{4}" placeholder="Ej. 4821" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
        </label>

        <label class="form-field">
          <span id="lbl_pago_referencia">Número o referencia de operación</span>
          <input id="pago_referencia" type="text" placeholder="Folio / autorización / referencia">
        </label>

        <label class="form-field">
          <span>Subtotal antes de cortesía ($)</span>
          <input id="pago_total_manual" readonly type="number" min="0" step="0.01" placeholder="Se calcula al elegir hab." oninput="recalcularSaldosPago()">
        </label>
      </div>

      <div class="form-btn-container" style="margin-top:12px;">
        <button type="button" class="primary" onclick="registrarPagoEnLista()">
          <i class="fa-solid fa-plus"></i> Agregar pago a la reservación
        </button>
      </div>

      <div class="box table-wrap" style="margin-top:14px;">
        <table>
          <thead>
            <tr>
              <th>Forma de pago</th>
              <th>Banco</th>
              <th>Terminación</th>
              <th>Referencia / Operación</th>
              <th>Fecha</th>
              <th>Importe</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="tbody_pagos_reserva"></tbody>
        </table>
      </div>

      <div class="cards" style="margin-top:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
        <div class="card" style="padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1;">
          <span>Cortesía aplicada</span><strong id="resumen_descuento_reserva" style="display:block; font-size:1.3rem;">—</strong>
        </div>
        <div class="card" style="padding:12px; background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1;">
          <span>Total de reservación</span>
          <strong id="resumen_total_reserva" style="display:block; font-size:1.3rem; color:#0f172a;">—</strong>
        </div>
        <div class="card" style="padding:12px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
          <span>Total pagado</span>
          <strong id="resumen_total_pagado" style="display:block; font-size:1.3rem; color:#166534;">$0.00</strong>
        </div>
        <div class="card" style="padding:12px; background:#fef2f2; border-radius:8px; border:1px solid #fecaca;">
          <span>Saldo pendiente</span>
          <strong id="resumen_saldo_pendiente" style="display:block; font-size:1.3rem; color:#991b1b;">—</strong>
        </div>
      </div>
    </section>

    <div class=reservation-submit>
      <span class=confirmation-note>✓ Se guardará como <strong>Confirmada</strong></span>
      <button class="primary create-button" data-guardar-reserva disabled onclick="guardarReserva()"><i class="fa-solid fa-floppy-disk"></i> Crear reservación</button>
      <button class="primary danger" type="button" onclick="limpiarReservaActual()"><i class="fa-solid fa-broom"></i> Limpiar</button>
    </div>
  </div>`;
};

// Sobrescribimos guardarReserva para exigir al menos un pago y enviarlo al backend
window.guardarReserva = async function () {
  const f = reservaForm;
  if (!recalcularSaldosPago()) {
    f.cortesiaPorcentaje.reportValidity();
    return;
  }
  if (!f.reportValidity()) return;
  const ids = [
    ...document.querySelectorAll('input[name=habitacionIds]:checked'),
  ].map((x) => Number(x.value));
  if (!ids.length) return alert('Selecciona al menos una habitación');
  if (!listaPagosReserva.length) {
    return alert(
      'Toda reservación debe contar obligatoriamente con al menos una forma de pago registrada (Paso 4).',
    );
  }

  const totalPagado = listaPagosReserva.reduce(
    (acc, p) => acc + Number(p.importe || 0),
    0,
  );
  const saldoPendiente = Math.max(0, totalReservacionCalculado - totalPagado);

  const d = {
    huespedId: Number(f.huespedId.value) || undefined,
    huesped: {
      nombre: f.nombre.value,
      apellidoPaterno: f.apellidoPaterno.value,
      apellidoMaterno: f.apellidoMaterno.value,
      telefono: f.telefono.value,
      correo: f.correo.value,
      identificacion: f.identificacion.value,
      direccion: f.direccion.value,
    },
    fechaInicio: f.fechaInicio.value,
    fechaFin: f.fechaFin.value,
    adultos: Number(f.adultos.value),
    menores: Number(f.menores.value),
    habitacionIds: ids,
    confirmar: true,
    totalReservacion: totalReservacionCalculado,
    totalPagado: totalPagado,
    saldoPendiente: saldoPendiente,
    cortesiaPorcentaje: Number(f.cortesiaPorcentaje.value),
    pagos: listaPagosReserva.map(({ idTemp, ...resto }) => resto),
  };

  const id = f.id.value;
  try {
    await api(id ? `/reservaciones/${id}` : '/reservaciones', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(d),
    });
  } catch (error) {
    return alert(error.message);
  }
  alert(id ? 'Reservación actualizada' : 'Reservación creada correctamente');
  listaPagosReserva = [];
  origenReserva === 'recepcion' ? recepcion() : reservaciones();
};
// Mostrar Total / Pagado / Saldo en cada tarjeta de reservación y cargar pagos al editar
window.reservaCard = function (r) {
  const totalRes = Number(r.total_reservacion || 0);
  const totalPag = Number(r.total_pagado || 0);
  const saldoPend = Number(
    r.saldo_pendiente ?? Math.max(0, totalRes - totalPag),
  );
  const pagosHtml = (r.pagos_detalle || [])
    .map(
      (p) =>
        `<small style="display:block; color:#334155;">• ${esc(p.metodo_pago)} (${esc(p.banco)}${p.terminacion_tarjeta ? ' ****' + esc(p.terminacion_tarjeta) : ''}): <strong>$${Number(p.importe).toFixed(2)}</strong></small>`,
    )
    .join('');

  return `<article class=reservation-card>
    <div>
      <span class=folio>${esc(r.folio)}</span>
      <span class="status status-${String(r.estado).toLowerCase().replaceAll(' ', '-')}">${esc(r.estado)}</span>
    </div>
    <h3>${esc(r.huesped_nombre)} ${esc(r.huesped_apellido || '')}</h3>
    <p>${esc(String(r.fecha_inicio).slice(0, 10))} → ${esc(String(r.fecha_fin).slice(0, 10))}</p>
    <div class=selected-rooms>${detalleHabitaciones(r.habitaciones_detalle)}</div>
    <div style="margin:8px 0; padding:8px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; font-size:0.85rem;">
      <div>Cortesía aplicada: <strong>${Number(r.cortesia_porcentaje || 0).toFixed(2)}%</strong></div>
      <div>Total reservación: <strong>$${totalRes.toFixed(2)}</strong></div>
      <div style="color:#166534;">Total pagado: <strong>$${totalPag.toFixed(2)}</strong></div>
      <div style="color:${saldoPend > 0 ? '#991b1b' : '#166534'};">Saldo pendiente: <strong>$${saldoPend.toFixed(2)}</strong></div>
      ${pagosHtml ? `<div style="margin-top:6px; border-top:1px dashed #cbd5e1; padding-top:4px;">${pagosHtml}</div>` : ''}
    </div>
    <small>Registró: ${esc(r.recepcionista_nombre || 'Recepción')}</small>
    <div class=actions>
      ${!['Cancelada', 'Finalizada'].includes(r.estado) ? `<button class="primary edit-button" onclick='editarReserva(${JSON.stringify(r).replace(/'/g, '&#39;')})'><i class="fa-solid fa-pen-to-square"></i> Editar</button><button class="primary danger" onclick="cambiarReserva(${r.id},'Cancelada')"><i class="fa-solid fa-ban"></i> Cancelar</button>` : ''}
      <button class="primary danger" onclick="eliminarReserva(${r.id})"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
    </div>
  </article>`;
};

window.editarReserva = async function (r) {
  const destino = origenReserva;
  const huesped = await api(`/huespedes/${r.huesped_id}`);
  if (destino === 'recepcion') {
    await recepcion();
    mostrarRecepcionTab('nueva');
  } else {
    await reservaciones();
  }
  const f = reservaForm;
  f.id.value = r.id;
  f.huespedId.value = r.huesped_id;
  [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'telefono',
    'correo',
    'identificacion',
    'direccion',
  ].forEach((campo) => (f[campo].value = huesped[campo] || ''));
  f.fechaInicio.value = String(r.fecha_inicio).slice(0, 10);
  f.fechaFin.value = String(r.fecha_fin).slice(0, 10);
  if (f.cortesiaPorcentaje) f.cortesiaPorcentaje.value = Number(r.cortesia_porcentaje || 0);
  f.adultos.value = r.adultos;
  f.menores.value = r.menores;
  await buscarDisponibles();

  listaPagosReserva = (r.pagos_detalle || []).map((p, idx) => ({
    idTemp: Date.now() + idx,
    metodo_pago: p.metodo_pago,
    importe: Number(p.importe),
    banco: p.banco,
    fecha_pago: String(p.fecha_pago).slice(0, 10),
    terminacion_tarjeta: p.terminacion_tarjeta || null,
    referencia: p.referencia || null,
  }));
  renderTablaPagosReserva();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function cortesias() {
  try {
    const config = await api('/configuracion/cortesias');
    content.innerHTML = `<div class="box"><h2>Límite de cortesías</h2><p>Porcentaje máximo para nuevas cortesías y modificaciones de reservaciones. No cambia reservaciones guardadas.</p><form id="cortesiasForm"><label>Máximo autorizado (%) <input name="maximo" type="number" min="0" max="100" step="0.01" required value="${config.maximoPorcentaje}"></label><button class="primary">Guardar límite</button></form></div>`;
    document.getElementById('cortesiasForm').onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api('/configuracion/cortesias', { method: 'PATCH', body: JSON.stringify({ maximoPorcentaje: Number(event.target.maximo.value) }) });
        alert('Límite actualizado');
      } catch (error) { alert(error.message); }
    };
  } catch (error) { content.textContent = error.message; }
}

// El formulario se reutiliza en Reservaciones y Recepción.
const observarCortesia = new MutationObserver(async () => {
  const input = document.querySelector('[name=cortesiaPorcentaje]');
  if (!input || input.dataset.limiteConsultado) return;
  input.dataset.limiteConsultado = 'true';
  recalcularSaldosPago();
  try {
    const config = await api('/configuracion/cortesias');
    if (!input.isConnected) return;
    input.max = config.maximoPorcentaje;
    input.dataset.maximoAutorizado = String(config.maximoPorcentaje);
    document.getElementById('limiteCortesia').textContent =
      `Máximo autorizado: ${config.maximoPorcentaje}%`;
  } catch (error) {
    if (input.isConnected) {
      input.dataset.errorLimite =
        'No se pudo consultar el máximo autorizado. Vuelve a abrir el formulario.';
      document.getElementById('limiteCortesia').textContent = error.message;
    }
  } finally {
    if (input.isConnected) recalcularSaldosPago();
  }
});
observarCortesia.observe(content, { childList: true, subtree: true });
