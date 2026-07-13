/* ==========================================================================
   ONLINE BARBER — Shop catalog renderer
   Reads /data/products.json and renders tabs + product grid.
   To add real products: edit data/products.json (see README in that folder
   and assets/catalog/README.md for the image folder convention).
   ========================================================================== */

const CATEGORY_LABELS = {
  "hair-products": "Hair Products",
  "brushes": "Brushes",
  "clothing": "Clothing"
};

let CATALOG = {};
let ACTIVE_TAB = "hair-products";

async function loadCatalog() {
  const res = await fetch("./data/products.json");
  CATALOG = await res.json();
  renderTabs();
  renderGrid();
}

function renderTabs() {
  const tabWrap = document.getElementById("shopTabs");
  if (!tabWrap) return;
  tabWrap.innerHTML = Object.keys(CATALOG).map(key => `
    <button class="shop-tab ${key === ACTIVE_TAB ? "active" : ""}" data-tab="${key}">
      ${CATEGORY_LABELS[key] || key}
    </button>
  `).join("");

  tabWrap.querySelectorAll(".shop-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      ACTIVE_TAB = btn.dataset.tab;
      renderTabs();
      renderGrid();
    });
  });
}

function renderGrid() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const items = CATALOG[ACTIVE_TAB] || [];

  if (items.length === 0) {
    grid.innerHTML = `<p>No products in this category yet.</p>`;
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-media">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="product-body">
        <span class="stock-tag ${p.inStock ? "" : "out"}">${p.inStock ? "In stock" : "Out of stock"}</span>
        <div class="product-name">${p.name}</div>
        <p class="product-desc">${p.description}</p>
        ${p.sizes ? `
          <div class="size-row" data-sizes>
            ${p.sizes.map((s, i) => `<button type="button" class="size-chip ${i === 0 ? "active" : ""}" data-size="${s}">${s}</button>`).join("")}
          </div>
        ` : ""}
        <div class="product-price">R${p.price}</div>
        <button class="btn btn-primary btn-block btn-sm add-to-cart-btn" ${p.inStock ? "" : "disabled"}>
          ${p.inStock ? "Add to Order" : "Unavailable"}
        </button>
      </div>
    </div>
  `).join("");

  // size chip selection
  grid.querySelectorAll(".product-card").forEach(card => {
    const sizeRow = card.querySelector("[data-sizes]");
    if (sizeRow) {
      sizeRow.querySelectorAll(".size-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          sizeRow.querySelectorAll(".size-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
        });
      });
    }

    const addBtn = card.querySelector(".add-to-cart-btn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const id = card.dataset.id;
        const product = items.find(p => p.id === id);
        const activeChip = card.querySelector(".size-chip.active");
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          size: activeChip ? activeChip.dataset.size : null
        });
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", loadCatalog);
