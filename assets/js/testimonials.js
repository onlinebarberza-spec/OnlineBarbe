/* ONLINE BARBER — Testimonials loader. Edit testimonials.json to add real reviews. */

async function loadTestimonials() {
  const grid = document.getElementById("testimonialGrid");
  if (!grid) return;
  try {
    const res = await fetch("./data/testimonials.json");
    const data = await res.json();
    grid.innerHTML = data.testimonials.map(t => `
      <div class="testimonial-card">
        <div class="stars">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</div>
        <p>"${t.text}"</p>
        <div class="testimonial-name">${t.name} — ${t.service}</div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = "<p>Testimonials coming soon.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadTestimonials);
