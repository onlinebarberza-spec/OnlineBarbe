/* ==========================================================================
   ONLINE BARBER — Cart + shared UI behaviour
   Since this site runs on GitHub Pages (static, no payment backend), the
   cart's "checkout" step builds a WhatsApp message with the order details
   and opens a chat with the shop number. No card data is ever collected.
   ========================================================================== */

// ---- CONFIGURE THIS: replace with the real Online Barber WhatsApp number ----
// Format: country code + number, no spaces, no leading 0 or +
// Example South African number 082 123 4567 -> "27821234567"
const WHATSAPP_NUMBER = "27000000000"; // TODO: replace with real number

const CART_KEY = "online_barber_cart";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(c => c.id === item.id && c.size === item.size);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  saveCart(cart);
  renderCartDrawer();
  showToast(`Added "${item.name}" to your order`);
}

function removeFromCart(id, size) {
  const cart = getCart().filter(c => !(c.id === id && c.size === size));
  saveCart(cart);
  renderCartDrawer();
}

function cartTotal(cart) {
  return cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
}

function updateCartCount() {
  const count = getCart().reduce((sum, c) => sum + c.qty, 0);
  document.querySelectorAll(".cart-count").forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? "inline" : "none";
  });
}

function renderCartDrawer() {
  const container = document.getElementById("cartItems");
  const footer = document.getElementById("cartFooter");
  if (!container) return;
  const cart = getCart();

  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty">Your order list is empty.<br>Add products from the shop.</div>`;
    if (footer) footer.style.display = "none";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${item.size ? "Size: " + item.size + " · " : ""}Qty: ${item.qty} · R${item.price} each</div>
        <button class="cart-remove" onclick="removeFromCart('${item.id}', ${item.size ? `'${item.size}'` : null})">Remove</button>
      </div>
    </div>
  `).join("");

  if (footer) {
    footer.style.display = "block";
    document.getElementById("cartTotalValue").textContent = "R" + cartTotal(cart);
  }
}

function openCart() {
  document.getElementById("cartOverlay").classList.add("open");
  document.getElementById("cartDrawer").classList.add("open");
  renderCartDrawer();
}
function closeCart() {
  document.getElementById("cartOverlay").classList.remove("open");
  document.getElementById("cartDrawer").classList.remove("open");
}

function buildWhatsAppOrderMessage() {
  const cart = getCart();
  if (cart.length === 0) return "";
  let msg = "Hi Online Barber! I'd like to order:\n\n";
  cart.forEach(item => {
    msg += `• ${item.name}${item.size ? " (Size " + item.size + ")" : ""} x${item.qty} — R${item.price * item.qty}\n`;
  });
  msg += `\nTotal: R${cartTotal(cart)}\n\nPlease confirm availability and how to pay. Thank you!`;
  return msg;
}

function checkoutViaWhatsApp() {
  const message = buildWhatsAppOrderMessage();
  if (!message) { showToast("Your order list is empty"); return; }
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

function showToast(text) {
  let toast = document.getElementById("obToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "obToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(window._obToastTimer);
  window._obToastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// ---- Nav toggle (mobile) ----
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
  updateCartCount();
  renderCartDrawer();

  const cartBtn = document.getElementById("openCartBtn");
  if (cartBtn) cartBtn.addEventListener("click", openCart);
  const closeBtn = document.getElementById("cartCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  const overlay = document.getElementById("cartOverlay");
  if (overlay) overlay.addEventListener("click", closeCart);
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) checkoutBtn.addEventListener("click", checkoutViaWhatsApp);
});
