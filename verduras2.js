// verduras.js
// Mantiene el comportamiento previo + agrega "Ubicación actual" sin depender de frameworks.

(function() {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    cart: {} // { id: { id, nombre, cantidad } }
  };

  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('toast--show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('toast--show'), 1800);
  }

  function addItemToCart({ id, nombre }) {
    if (!id) return;
    if (!state.cart[id]) {
      state.cart[id] = { id, nombre, cantidad: 0 };
    }
    state.cart[id].cantidad += 1;
    renderResumen();
  }

  function renderResumen() {
    const ul = $('#resumenLista');
    if (!ul) return;
    ul.innerHTML = '';
    const items = Object.values(state.cart);
    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No hay productos agregados aún.';
      ul.appendChild(li);
      return;
    }
    items.forEach(it => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = it.nombre;
      const right = document.createElement('span');
      right.className = 'item-cant';
      right.textContent = `x${it.cantidad}`;
      li.appendChild(left);
      li.appendChild(right);
      ul.appendChild(li);
    });
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

    try {
      if (typeof window.addToCart === 'function') {
        window.addToCart({ id, nombre, cantidad: 1 });
      } else if (typeof window.agregarAlCarrito === 'function') {
        window.agregarAlCarrito({ id, nombre, cantidad: 1 });
      } else if (typeof window.cartAdd === 'function') {
        window.cartAdd({ id, nombre, cantidad: 1 });
      } else {
        addItemToCart({ id, nombre });
        document.dispatchEvent(new CustomEvent('producto:agregado', { detail: { id, nombre, cantidad: 1 } }));
      }
    } catch (err) {
      addItemToCart({ id, nombre });
      console.warn('Fallo integración con carrito externo. Se usó fallback local.', err);
    }

    showToast('¡Ya se ha agregado el producto!');
  }

  // ====== UBICACIÓN ACTUAL ======
  function setupUbicacionActual() {
    const btn = $('#btnUbicacionActual');
    const inputDir = $('#direccion');
    const latInput = $('#lat');
    const lngInput = $('#lng');
    const mapsInput = $('#maps_url');
    const info = $('#ubicInfo');
    const preview = $('#mapsPreview');
    const statusEl = $('#ubicStatus');

    if (!btn || !inputDir || !latInput || !lngInput || !mapsInput || !preview || !statusEl) return;

    function setStatus(msg) {
      statusEl.textContent = msg || '';
    }

    btn.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        setStatus('Tu navegador no permite obtener la ubicación.');
        info.hidden = false;
        showToast('No se pudo obtener la ubicación.');
        return;
      }

      btn.disabled = True = true;
      setStatus('Obteniendo ubicación…');

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const lat = latitude.toFixed(6);
          const lng = longitude.toFixed(6);
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          // Llenamos campos
          inputDir.value = `${lat}, ${lng} (ubicación detectada)`;
          latInput.value = lat;
          lngInput.value = lng;
          mapsInput.value = mapsUrl;

          // Preview link
          preview.href = mapsUrl;
          preview.textContent = 'Ver en Google Maps';
          info.hidden = false;
          setStatus('Ubicación detectada');

          btn.disabled = false;
          showToast('Ubicación cargada');
        },
        (err) => {
          console.warn('Geoloc error:', err);
          btn.disabled = false;
          info.hidden = false;
          setStatus('No se pudo obtener la ubicación. Podés escribir tu dirección manualmente.');
          showToast('No se pudo obtener la ubicación.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderResumen();

    const grid = $('#productosGrid');
    if (grid) grid.addEventListener('click', handleAgregarClick);

    removeSeleccionaTusProductosButton();

    setupUbicacionActual();

    // Si tu backend arma un "mensaje" con los campos del formulario
    // los inputs hidden lat/lng/maps_url viajarán y tendrás el link directo.
    // Si realizás envío por mailto/whatsapp, podés leer maps_url del DOM antes de armar el texto.
  });
})();
