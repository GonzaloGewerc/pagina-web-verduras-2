// verduras.js
// Comportamiento de carrito + ubicación + resumen con detalle + WhatsApp auto.
// (Ajuste: WhatsApp usa saltos de línea reales, por eso ahora unimos con "\n" en JS)

(function() {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    cart: {} // { id: { id, nombre, detalle, cantidad } }
  };

  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('toast--show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('toast--show'), 1800);
  }

  function addItemToCart({ id, nombre, detalle }) {
    if (!id) return;
    if (!state.cart[id]) {
      state.cart[id] = { id, nombre, detalle: detalle || '', cantidad: 0 };
    }
    state.cart[id].cantidad += 1;
    renderResumen();
  }

 /* === EN verduras.js: REEMPLAZÁ COMPLETAMENTE tu función renderResumen por ESTA === */
function renderResumen() {
  const ul = $('#resumenLista');
  const pagoResumen = $('#pagoResumen');
  if (!ul) return;

  ul.innerHTML = '';
  const items = Object.values(state.cart);

  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No hay productos agregados aún.';
    ul.appendChild(li);
  } else {
    items.forEach(it => {
      const li = document.createElement('li');
      li.setAttribute('data-id', it.id || '');

      const head = document.createElement('div');
      head.className = 'item-head';

      const left = document.createElement('span');
      left.textContent = it.nombre;

      const right = document.createElement('span');
      right.className = 'item-cant';
      right.textContent = `x${it.cantidad}`;

      head.appendChild(left);
      head.appendChild(right);

      const det = document.createElement('div');
      det.className = 'item-detalle';
      det.textContent = it.detalle || '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-eliminar-resumen';
      btn.setAttribute('data-id', it.id || '');
      btn.textContent = '🗑️ Eliminar';

      li.appendChild(head);
      if (it.detalle) li.appendChild(det);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  const pagoSel = $('#pago')?.value || '';
  if (pagoResumen) {
    pagoResumen.textContent = pagoSel ? `Medio de pago: ${pagoSel}` : '';
  }
}

  // Eliminar botón "Selecciona tus productos" si existe en la sección de pedido
  function removeSeleccionaTusProductosButton() {
    const pedido = $('#pedido');
    if (!pedido) return;
    const candidates = $$('button, a', pedido);
    candidates.forEach(el => {
      const t = (el.textContent || '').toLowerCase().trim();
      if (t === 'selecciona tus productos' || t === 'seleccioná tus productos' || t.includes('selecciona tus productos')) {
        el.remove();
      }
    });
  }

  function handleAgregarClick(e) {
    const btn = e.target.closest('.btn-agregar');
    if (!btn) return;
    const carta = e.target.closest('.card-producto');
    if (!carta) return;

    const id = carta.getAttribute('data-id') || '';
    const nombre = (carta.querySelector('.card-producto__titulo')?.textContent || 'Producto').trim();
    const detalle = carta.getAttribute('data-detalle') || '';

    try {
      if (typeof window.addToCart === 'function') {
        window.addToCart({ id, nombre, cantidad: 1, detalle });
      } else if (typeof window.agregarAlCarrito === 'function') {
        window.agregarAlCarrito({ id, nombre, cantidad: 1, detalle });
      } else if (typeof window.cartAdd === 'function') {
        window.cartAdd({ id, nombre, cantidad: 1, detalle });
      } else {
        addItemToCart({ id, nombre, detalle });
        document.dispatchEvent(new CustomEvent('producto:agregado', { detail: { id, nombre, cantidad: 1, detalle } }));
      }
    } catch (err) {
      addItemToCart({ id, nombre, detalle });
      console.warn('Fallo integración con carrito externo. Se usó fallback local.', err);
    }

    showToast('¡Ya se ha agregado el producto!');
  }

  // ====== UBICACIÓN ACTUAL (robusto si falta #mapsPreview) ======
  function setupUbicacionActual() {
    const btn = document.getElementById('btnUbicacionActual');
    const inputDir = document.getElementById('direccion');
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const mapsInput = document.getElementById('maps_url');
    const info = document.getElementById('ubicInfo');
    const statusEl = document.getElementById('ubicStatus');
    const preview = document.getElementById('mapsPreview'); // puede no existir

    // Requeridos mínimos
    if (!btn || !inputDir || !latInput || !lngInput || !mapsInput || !statusEl) return;

    const setStatus = (msg) => { statusEl.textContent = msg || ''; };

    btn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        setStatus('Tu navegador no permite obtener la ubicación.');
        if (info) info.hidden = false;
        if (typeof showToast === 'function') showToast('No se pudo obtener la ubicación.');
        return;
      }

      btn.disabled = true;
      setStatus('Obteniendo ubicación…');
      if (info) info.hidden = false;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const lat = latitude.toFixed(6);
          const lng = longitude.toFixed(6);
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          inputDir.value = `${lat}, ${lng} (ubicación detectada)`;
          latInput.value = lat;
          lngInput.value = lng;
          mapsInput.value = mapsUrl;

          // Solo tocar preview si existe
          if (preview) {
            preview.href = mapsUrl;
            preview.textContent = 'Ver en Google Maps';
          }

          setStatus('Ubicación detectada');
          btn.disabled = false;
          if (typeof showToast === 'function') showToast('Ubicación cargada');
        },
        (err) => {
          console.warn('Geoloc error:', err);
          btn.disabled = false;
          setStatus('No se pudo obtener la ubicación. Podés escribir tu dirección manualmente.');
          if (typeof showToast === 'function') showToast('No se pudo obtener la ubicación.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  // ====== MÉTODO DE PAGO EN RESUMEN ======
  function setupPagoResumen() {
    const pago = $('#pago');
    if (!pago) return;
    pago.addEventListener('change', renderResumen);
  }

  // ====== ENVÍO POR WHATSAPP ======
  function setupFormWhatsApp() {
    const form = $('#formPedido');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const nombre = $('#nombre')?.value?.trim() || '';
      const telefono = $('#telefono')?.value?.trim() || '';
      const pago = $('#pago')?.value || '';
      if (!pago) {
        showToast('Elegí un medio de pago.');
        $('#pago')?.focus();
        return;
      }
      const mapsUrl = $('#maps_url')?.value || '';
      const direccion = $('#direccion')?.value || '';

      const items = Object.values(state.cart);
      if (items.length === 0) {
        showToast('Agregá al menos un producto.');
        return;
      }

      const itemsText = items.map(it => {
        const detalle = it.detalle ? ` - ${it.detalle}` : '';
        return `• ${it.nombre} x${it.cantidad}${detalle}`;
      }).join('\n'); // <-- real newline in JS

      const ubicacionText = mapsUrl ? mapsUrl : direccion;

      const mensaje = [
        'Nuevo pedido',
        `Nombre: ${nombre}`,
        telefono ? `Tel: ${telefono}` : null,
        `Método de pago: ${pago}`,
        'Productos:',
        itemsText,
        `Ubicación: ${ubicacionText}`
      ].filter(Boolean).join('\n'); // <-- real newline in JS

      const destino = '5493515208891'; // +54 9 351 5208891
      const url = `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`;

      window.open(url, '_blank');
      showToast('Abriendo WhatsApp con tu pedido…');
    });
  }

  
  // ====== CERRAR MENÚ MÓVIL AL CLICKEAR UNA OPCIÓN ======
  function setupMenuAutoClose() {
    const checkbox = document.getElementById('checkbox');
    if (!checkbox) return;
    const links = document.querySelectorAll('nav ul li a');
    const closeMenu = () => {
      if (window.matchMedia('(max-width: 800px)').matches) {
        checkbox.checked = false;
      }
    };
    links.forEach(link => {
      link.addEventListener('click', closeMenu, { passive: true });
      link.addEventListener('touchend', closeMenu, { passive: true });
      link.addEventListener('pointerup', closeMenu, { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderResumen();

    const grid = $('#productosGrid');
    if (grid) grid.addEventListener('click', handleAgregarClick);

    removeSeleccionaTusProductosButton();
    setupUbicacionActual();
    setupPagoResumen();
    setupFormWhatsApp();
    setupMenuAutoClose();
  });















  /* ==========================================================================
   JS principal (con mejora de geolocalización para "Ubicación actual")
   ========================================================================== */

/**
 * Utilidad: compone una URL de Google Maps a partir de lat/lng
 * @param {number} lat
 * @param {number} lng
 * @returns {string} URL de búsqueda en Google Maps
 */
function construirLinkMaps(lat, lng) {
  const latStr = String(lat).trim();
  const lngStr = String(lng).trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latStr},${lngStr}`)}`;
}

/**
 * Muestra un mensaje de estado junto al botón de ubicación
 * @param {"cargando"|"ok"|"error"|""} tipo
 * @param {string} texto
 */
function setEstadoUbicacion(tipo, texto) {
  const estado = document.getElementById("estado-ubicacion");
  if (!estado) return;
  estado.classList.remove("cargando", "ok", "error");
  if (tipo) estado.classList.add(tipo);
  estado.textContent = texto || "";
}

/**
 * Obtiene la ubicación actual del usuario y guarda el link en #ubicacion
 */
async function obtenerUbicacionActual() {
  const btn = document.getElementById("btn-ubicacion");
  const inputOculto = document.getElementById("ubicacion");

  if (!btn || !inputOculto) return;

  // Verificaciones de soporte
  if (!("geolocation" in navigator)) {
    setEstadoUbicacion("error", "Tu navegador no soporta geolocalización.");
    return;
  }

  // Bloquea el botón durante la solicitud
  btn.disabled = true;
  setEstadoUbicacion("cargando", "Obteniendo ubicación... (asegurate de permitir el acceso)");

  // Envuelve getCurrentPosition en una Promesa
  const getPosition = () =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      });
    });

  try {
    const pos = await getPosition();
    const { latitude, longitude } = pos.coords;
    const url = construirLinkMaps(latitude, longitude);

    // Guarda en el input oculto y muestra estado
    inputOculto.value = url;
    inputOculto.dataset.timestamp = String(Date.now());
    setEstadoUbicacion("ok", "¡Ubicación lista! Se adjuntará en tu mensaje.");
  } catch (err) {
    // Manejo detallado de errores
    let mensaje = "No se pudo obtener la ubicación.";
    if (err && typeof err.code === "number") {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          mensaje = "Permiso denegado. Podés continuar sin ubicación.";
          break;
        case err.POSITION_UNAVAILABLE:
          mensaje = "Ubicación no disponible. Intenta nuevamente.";
          break;
        case err.TIMEOUT:
          mensaje = "Demoró demasiado. Intenta de nuevo.";
          break;
      }
    }
    setEstadoUbicacion("error", mensaje);
  } finally {
    btn.disabled = false;
  }
}

/**
 * Construye el mensaje final para WhatsApp, incorporando la ubicación si existe
 * y abre WhatsApp con el destino seleccionado.
 */
function enviarPorWhatsApp() {
  const form = document.getElementById("form-pedido");
  if (!form) return;

  // Teléfono destino
  const destino = form.querySelector('input[name="destino"]:checked');
  const telefono = destino ? destino.value : "";

  // Campos comunes que ya tengas
  const nombre = (document.getElementById("nombre")?.value || "").trim();
  const telefonoCliente = (document.getElementById("telefono")?.value || "").trim();
  const resumen = (document.getElementById("resumen")?.value || "").trim();

  // Ubicación
  const ubicacion = (document.getElementById("ubicacion")?.value || "").trim();

  // Mensaje base (respeta tu formato actual; aquí un ejemplo claro y ordenado)
  let lineas = [];
  lineas.push("🛒 *Nuevo pedido*");
  if (nombre) lineas.push(`👤 Nombre: ${nombre}`);
  if (telefonoCliente) lineas.push(`📞 Teléfono: ${telefonoCliente}`);
  if (resumen) {
    lineas.push("📦 Detalle del pedido:");
    lineas.push(resumen);
  }
  if (ubicacion) {
    lineas.push(`📍 Ubicación: ${ubicacion}`);
  } else {
    // Si querés, puedes omitir este else y no poner nada si falta la ubicación
    lineas.push("📍 Ubicación: (no proporcionada)");
  }

  const mensaje = lineas.join("\n");
  const url = `https://wa.me/${encodeURIComponent(telefono)}?text=${encodeURIComponent(mensaje)}`;

  // Abre WhatsApp (móvil o web)
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ====================== Listeners ====================== */
document.addEventListener("DOMContentLoaded", () => {
  // Listener botón Ubicación
  const btnUbicacion = document.getElementById("btn-ubicacion");
  if (btnUbicacion) {
    btnUbicacion.addEventListener("click", obtenerUbicacionActual);
  }

  // Listener WhatsApp
  const btnWhats = document.getElementById("btn-whatsapp");
  if (btnWhats) {
    btnWhats.addEventListener("click", enviarPorWhatsApp);
  }
});
















/* === EN verduras.js: PEGÁ ESTE BLOQUE DENTRO DEL MISMO IIFE, antes o después del DOMContentLoaded === */
/* Delegación de clic para eliminar ítems del resumen */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-eliminar-resumen');
  if (!btn) return;

  const id = btn.getAttribute('data-id');
  if (!id || !state.cart[id]) return;

  // Quitar 1 unidad si hay más de una; si queda en 0, eliminar la entrada
  if (state.cart[id].cantidad > 1) {
    state.cart[id].cantidad -= 1;
  } else {
    delete state.cart[id];
  }

  renderResumen();
  if (typeof showToast === 'function') showToast('Producto eliminado');
}, { passive: true });





































})();



