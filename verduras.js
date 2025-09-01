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

        li.appendChild(head);
        if (it.detalle) li.appendChild(det);
        ul.appendChild(li);
      });
    }

    // Mostrar método de pago seleccionado
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

      btn.disabled = true;
      setStatus('Obteniendo ubicación…');

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

  document.addEventListener('DOMContentLoaded', () => {
    renderResumen();

    const grid = $('#productosGrid');
    if (grid) grid.addEventListener('click', handleAgregarClick);

    removeSeleccionaTusProductosButton();
    setupUbicacionActual();
    setupPagoResumen();
    setupFormWhatsApp();
  });
})();
