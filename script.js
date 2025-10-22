/* ===========================
   Fake API + App Logic
   =========================== */

/* ----- Mock data ----- */
const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Classic Hoodie', price: 45.00, img: 'images/product1.jpg' },
  { id: 'p2', name: 'Stylish Jacket', price: 70.00, img: 'images/product2.jpg' },
  { id: 'p3', name: 'Sporty Sneakers', price: 60.00, img: 'images/product3.jpg' },
  { id: 'p4', name: 'Summer T-Shirt', price: 30.00, img: 'images/product4.jpg' }
];

/* ----- Utility ----- */
function wait(ms = 400) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ----- Fake API ----- */
const mockApi = {
  // get product list
  async getProducts() {
    await wait(300 + Math.random() * 300);
    // return a clone so consumers don't accidentally mutate source
    return JSON.parse(JSON.stringify(MOCK_PRODUCTS));
  },

  // cart stored in localStorage under 'fh_cart'
  _readCart() {
    try {
      const raw = localStorage.getItem('fh_cart');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  _writeCart(cart) {
    localStorage.setItem('fh_cart', JSON.stringify(cart));
  },

  // add to cart: { productId, qty }
  async addToCart(productId, qty = 1) {
    await wait(200 + Math.random() * 200);
    const product = MOCK_PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');
    const cart = this._readCart();
    cart[productId] = (cart[productId] || 0) + qty;
    this._writeCart(cart);
    return { success: true, cart };
  },

  // set quantity
  async setCartQuantity(productId, qty) {
    await wait(150);
    const cart = this._readCart();
    if (qty <= 0) {
      delete cart[productId];
    } else {
      cart[productId] = qty;
    }
    this._writeCart(cart);
    return { success: true, cart };
  },

  // remove item
  async removeFromCart(productId) {
    await wait(150);
    const cart = this._readCart();
    delete cart[productId];
    this._writeCart(cart);
    return { success: true, cart };
  },

  // get cart with product details
  async getCart() {
    await wait(200);
    const cart = this._readCart(); // { productId: qty }
    const items = Object.entries(cart).map(([pid, qty]) => {
      const p = MOCK_PRODUCTS.find(x => x.id === pid) || { id: pid, name: pid, price: 0 };
      return { ...p, qty, total: +(p.price * qty).toFixed(2) };
    });
    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const shipping = items.length > 0 ? 5.00 : 0; // fake shipping rule
    const tax = +(subtotal * 0.07).toFixed(2); // 7% tax
    const total = +(subtotal + shipping + tax).toFixed(2);
    return { items, subtotal: +subtotal.toFixed(2), shipping, tax, total };
  },

  // checkout (fake)
  async checkout(orderData = {}) {
    await wait(700 + Math.random() * 500);
    // very simple validation
    const cart = this._readCart();
    if (Object.keys(cart).length === 0) {
      throw new Error('Cart is empty');
    }
    // emulate order id
    const orderId = 'ORD-' + Date.now();
    // clear cart
    this._writeCart({});
    return { success: true, orderId, message: 'Payment successful (fake).' };
  },

  // simple fake auth (no security) - stores a fake token
  async login(email, password) {
    await wait(300);
    // accept any email/password for demo
    const token = 'fake-token-' + btoa(email + ':' + Date.now());
    localStorage.setItem('fh_token', token);
    localStorage.setItem('fh_user', JSON.stringify({ email }));
    return { success: true, token, user: { email } };
  },

  async logout() {
    localStorage.removeItem('fh_token');
    localStorage.removeItem('fh_user');
    return { success: true };
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('fh_user')) || null;
    } catch {
      return null;
    }
  }
};

/* ============================
   App UI logic (uses mockApi)
   ============================ */

/* --- Helper DOM functions --- */
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
function formatMoney(n) { return '$' + Number(n).toFixed(2); }
function showAlert(msg) { alert(msg); }

/* ----- Render product lists (index/product pages) ----- */
async function renderProductsIfNeeded() {
  const gridEls = qsa('.products-grid');
  if (gridEls.length === 0) return;
  const products = await mockApi.getProducts();
  // For each products-grid on page, render items
  gridEls.forEach(grid => {
    grid.innerHTML = ''; // clear any static content
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="${p.img}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${formatMoney(p.price)}</p>
        <div style="display:flex;gap:8px;justify-content:center;align-items:center;">
          <button class="btn add-to-cart" data-id="${p.id}">Add to Cart</button>
          <a href="product.html" class="btn view-btn">View</a>
        </div>
      `;
      grid.appendChild(card);
    });
  });

  // attach listeners to generated add-to-cart buttons
  qsa('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const pid = btn.dataset.id;
      try {
        await mockApi.addToCart(pid, 1);
        showAlert('Item added to cart (fake).');
        renderCartSummary(); // update header/cart count if any
      } catch (err) {
        showAlert('Error: ' + (err.message || err));
      }
    });
  });
}

/* ----- Add-to-cart on static product cards (if present in HTML) ----- */
function attachStaticAddToCart() {
  // covers older static HTML where .product-card .btn existed
  const buttons = qsa('.product-card .btn').filter(b => !b.classList.contains('add-to-cart'));
  buttons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      // attempt to find product id by product name (h3 inside same card)
      const card = button.closest('.product-card');
      const nameEl = card ? qs('h3', card) : null;
      const name = nameEl ? nameEl.textContent.trim() : null;
      const prod = MOCK_PRODUCTS.find(p => p.name === name);
      if (!prod) {
        showAlert('Product not recognized for fake cart.');
        return;
      }
      try {
        await mockApi.addToCart(prod.id, 1);
        showAlert(`${prod.name} added to cart (fake).`);
        renderCartSummary();
      } catch (err) {
        showAlert('Error: ' + err.message);
      }
    });
  });
}

/* ----- Render cart page ----- */
async function renderCartPageIfNeeded() {
  const cartSection = qs('.cart-page');
  if (!cartSection) return;
  const data = await mockApi.getCart();
  // find table body or create table structure
  let tbody = qs('.cart-table tbody');
  if (!tbody) {
    // fallback: create table
    const table = document.createElement('table');
    table.className = 'cart-table';
    table.innerHTML = `
      <thead>
        <tr><th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th>Action</th></tr>
      </thead>
      <tbody></tbody>
    `;
    cartSection.querySelector('.container').appendChild(table);
    tbody = table.querySelector('tbody');
  }
  tbody.innerHTML = '';
  data.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:left; display:flex;gap:10px; align-items:center;">
        <img src="${item.img}" alt="${item.name}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">
        <div>${item.name}</div>
      </td>
      <td>${formatMoney(item.price)}</td>
      <td>
        <input type="number" min="1" value="${item.qty}" data-id="${item.id}" class="cart-qty-input" style="width:70px;padding:6px;border-radius:4px;border:1px solid #ccc;">
      </td>
      <td>${formatMoney(item.total)}</td>
      <td><button class="btn remove-from-cart" data-id="${item.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  // cart summary & checkout button
  let summary = qs('.cart-summary');
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'cart-summary';
    summary.style.marginTop = '20px';
    cartSection.querySelector('.container').appendChild(summary);
  }
  summary.innerHTML = `
    <div style="text-align:right">
      <p>Subtotal: <strong>${formatMoney(data.subtotal)}</strong></p>
      <p>Shipping: <strong>${formatMoney(data.shipping)}</strong></p>
      <p>Tax: <strong>${formatMoney(data.tax)}</strong></p>
      <h3>Total: <strong>${formatMoney(data.total)}</strong></h3>
      <div style="margin-top:10px;">
        <a href="checkout.html" class="btn">Proceed to Checkout</a>
      </div>
    </div>
  `;

  // listeners: qty change
  qsa('.cart-qty-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const pid = input.dataset.id;
      let q = parseInt(input.value, 10) || 1;
      if (q < 1) q = 1;
      await mockApi.setCartQuantity(pid, q);
      await renderCartPageIfNeeded(); // re-render
      renderCartSummary();
    });
  });

  // listeners: remove
  qsa('.remove-from-cart').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pid = btn.dataset.id;
      await mockApi.removeFromCart(pid);
      await renderCartPageIfNeeded();
      renderCartSummary();
    });
  });
}

/* ----- Render checkout page behavior ----- */
function attachCheckoutBehavior() {
  const form = qs('.checkout-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = qs('#name', form).value.trim();
    const email = qs('#email', form).value.trim();
    const address = qs('#address', form).value.trim();
    const card = qs('#card', form).value.trim();

    if (!name || !email || !address || !card) {
      showAlert('Please fill all fields (fake).');
      return;
    }

    try {
      const res = await mockApi.checkout({ name, email, address, card });
      showAlert(`Order placed! Order ID: ${res.orderId} (fake).`);
      form.reset();
      renderCartSummary();
      // redirect to home maybe
      // location.href = 'index.html';
    } catch (err) {
      showAlert('Checkout failed: ' + (err.message || err));
    }
  });
}

/* ----- Login behavior ----- */
function attachLoginBehavior() {
  const form = qs('.login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = qs('#email', form).value.trim();
    const password = qs('#password', form).value;
    if (!email || !password) {
      showAlert('Please enter email and password (fake).');
      return;
    }
    try {
      const res = await mockApi.login(email, password);
      showAlert(`Welcome (fake): ${res.user.email}`);
      form.reset();
      renderAuthState();
    } catch (err) {
      showAlert('Login failed: ' + (err.message || err));
    }
  });
}

/* ----- Header / cart summary small widget ----- */
async function renderCartSummary() {
  // try to find a header cart count element, else create one
  const header = qs('header .header-container') || qs('header');
  if (!header) return;
  let el = qs('.cart-count', header);
  if (!el) {
    el = document.createElement('div');
    el.className = 'cart-count';
    el.style.fontWeight = 'bold';
    header.appendChild(el);
  }
  const cart = await mockApi.getCart();
  const totalItems = cart.items.reduce((s, it) => s + it.qty, 0);
  el.textContent = `Cart: ${totalItems} item${totalItems !== 1 ? 's' : ''}`;
}

/* ----- Auth state in header ----- */
function renderAuthState() {
  const header = qs('header .header-container') || qs('header');
  if (!header) return;
  let authEl = qs('.auth-area', header);
  if (!authEl) {
    authEl = document.createElement('div');
    authEl.className = 'auth-area';
    authEl.style.marginLeft = '15px';
    header.appendChild(authEl);
  }
  const user = mockApi.getCurrentUser();
  if (user) {
    authEl.innerHTML = `<span style="margin-right:10px;">${user.email}</span><button class="btn logout-btn">Logout</button>`;
    qs('.logout-btn', authEl).addEventListener('click', async () => {
      await mockApi.logout();
      renderAuthState();
      showAlert('Logged out (fake).');
    });
  } else {
    authEl.innerHTML = <a href="login.html" class="btn">Login</a>;
  }
}

/* ----- Init function to wire everything ----- */
async function initApp() {
  // render products if there is a products grid
  await renderProductsIfNeeded();

  // attach listeners to static add-to-cart buttons (older HTML)
  attachStaticAddToCart();

  // render cart page if present
  await renderCartPageIfNeeded();

  // attach checkout behavior if needed
  attachCheckoutBehavior();

  // attach login behavior if needed
  attachLoginBehavior();

  // render small header widgets
  renderCartSummary();
  renderAuthState();
}

/* run on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}