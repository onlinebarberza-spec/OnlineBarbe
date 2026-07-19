/* ==========================================================================
   ONLINE BARBER — Cart + shared UI behaviour
   Since this site runs on GitHub Pages (static, no payment backend), the
   cart's "checkout" step builds a WhatsApp message with the order details
   and opens a chat with the shop number. No card data is ever collected.
   ========================================================================== */

// ---- Online Barber WhatsApp number used for order and booking notifications ----
// Format: country code + number, no spaces, no leading 0 or +
// Example South African number 064 538 6347 -> "27645386347"
const WHATSAPP_NUMBER = "27645386347";

const DEFAULT_BOOKING_ENDPOINT = "https://script.google.com/macros/s/AKfycbwwNtzKbN8cwwk2MThR14WT_4FskTBrDWc-KsGQiSL5RmCesPr02gQ4bNBp6KFDkHNdkA/exec";
const BOOKING_ENDPOINT = (window.BOOKING_ENDPOINT || new URLSearchParams(window.location.search).get("bookingEndpoint") || DEFAULT_BOOKING_ENDPOINT).trim();

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

async function recordPurchase(cart) {
  if (!BOOKING_ENDPOINT || !cart || cart.length === 0) return;
  const payload = {
    type: 'purchase',
    phone: '',
    items: cart,
    total: cartTotal(cart)
  };
  try {
    const resp = await fetch(BOOKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const result = await resp.json().catch(() => ({}));
      console.warn('Purchase record failed', result);
    }
  } catch (err) {
    console.warn('Purchase record error', err);
  }
}

async function checkoutViaWhatsApp() {
  const message = buildWhatsAppOrderMessage();
  if (!message) { showToast("Your order list is empty"); return; }

  await recordPurchase(getCart());

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
  showToast('Purchase filled and WhatsApp opened.');
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
  const genRefBtn = document.getElementById('generateReferralBtn');
  if (genRefBtn) genRefBtn.addEventListener('click', async () => {
    const name = prompt('Enter your full name to create a referral code (optional)') || '';
    const phone = prompt('Enter your phone / WhatsApp number (required)');
    if (!phone) { showToast('Phone number is required to generate a referral code'); return; }
    try {
      const resp = await fetch(BOOKING_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ type: 'register_referrer', name, phone })
      });
      const json = await resp.json().catch(()=> ({}));
      if (!resp.ok) throw new Error(json.error || 'Failed to register');
      const msg = json.shareUrl ? `Your referral link: ${json.shareUrl}` : `Referral code: ${json.code}`;
      alert(msg);
    } catch (e) {
      console.error(e);
      showToast('Could not create referral link — is the backend running?');
    }
  });

  const referralJoinForm = document.getElementById('referralJoinForm');
  if (referralJoinForm) {
    referralJoinForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = document.getElementById('refName').value.trim();
      const phone = document.getElementById('refPhone').value.trim();
      const email = document.getElementById('refEmail').value.trim();
      const notes = document.getElementById('refMessage').value.trim();
      const statusEl = document.getElementById('referralJoinStatus');
      if (!name || !phone) {
        if (statusEl) {
          statusEl.textContent = 'Please enter both name and phone to join.';
          statusEl.className = 'booking-status show error';
        }
        showToast('Name and phone are required to join the referral programme.');
        return;
      }

      try {
        const resp = await fetch(BOOKING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ type: 'register_referrer', name, phone, email, notes })
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok) {
          const message = json.status === 'pending' ? 'Referral request received. We will confirm your eligibility soon.' : 'Referral code issued successfully!';
          if (statusEl) {
            if (json.shareUrl) {
              statusEl.innerHTML = `${message} <a href="${json.shareUrl}" target="_blank" rel="noopener noreferrer">Open your referral link</a>`;
            } else if (json.code) {
              statusEl.innerHTML = `${message} Referral code: <strong>${json.code}</strong>`;
            } else {
              statusEl.textContent = message;
            }
            statusEl.className = 'booking-status show success';
          }
          showToast(message);
          referralJoinForm.reset();
        } else {
          throw new Error(json.error || json.message || 'Unable to join referral programme');
        }
      } catch (err) {
        console.error(err);
        if (statusEl) {
          statusEl.textContent = 'Could not submit your referral request. Please try again later.';
          statusEl.className = 'booking-status show error';
        }
        showToast('Referral submission failed.');
      }
    });
  }
});
