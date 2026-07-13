/* ==========================================================================
   ONLINE BARBER — Booking form
   Sends the booking request straight to WhatsApp (same no-backend approach
   as the shop checkout). If you later want automatic calendar bookings,
   see the note in README.md about wiring up a Google Apps Script backend.
   ========================================================================== */

const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
let selectedSlot = null;
const DEFAULT_BOOKING_ENDPOINT = "https://script.google.com/macros/s/AKfycbwL9ynf9oxE5WE_BBbSMkqZ5pkbjUGk45vPCU3i4CMUH_2_MjxB04obBBeD85ni6cMGyQ/exec";
const BOOKING_WHATSAPP_NUMBER = "27645386347";
const BOOKING_ENDPOINT = (window.BOOKING_ENDPOINT || new URLSearchParams(window.location.search).get("bookingEndpoint") || DEFAULT_BOOKING_ENDPOINT).trim();
function renderSlots() {
  const wrap = document.getElementById("slotsContainer");
  if (!wrap) return;
  wrap.innerHTML = TIME_SLOTS.map(t => `<button type="button" class="slot-btn" data-slot="${t}">${t}</button>`).join("");
  wrap.querySelectorAll(".slot-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".slot-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedSlot = btn.dataset.slot;
    });
  });
}

function persistDemoBooking(payload) {
  const bookingKey = "online_barber_last_booking";
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(bookingKey) || "[]");
  } catch (e) {
    history = [];
  }

  history.unshift({ ...payload, createdAt: new Date().toISOString() });
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem(bookingKey, JSON.stringify(history));
}

function setBookingStatus(message, type = "") {
  const status = document.getElementById("bookingStatus");
  if (!status) return;
  status.textContent = message || "";
  status.className = `booking-status${message ? " show" : ""}${type ? ` ${type}` : ""}`;
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const form = document.getElementById("bookingForm");
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const service = document.getElementById("service");
  const serviceLabel = service.options[service.selectedIndex] ? service.options[service.selectedIndex].text : "";
  const date = document.getElementById("date").value;
  const notes = document.getElementById("notes").value.trim();

  if (!name || !phone || !service.value || !date || !selectedSlot) {
    setBookingStatus("Please fill in all required fields and pick a time slot", "error");
    showToast("Please fill in all required fields and pick a time slot");
    return;
  }

  const payload = {
    name,
    phone,
    service: service.value,
    serviceLabel,
    date,
    slot: selectedSlot,
    notes
  };
  // include referral code if provided
  const referralEl = document.getElementById('referralCode');
  if (referralEl && referralEl.value.trim()) payload.referralCode = referralEl.value.trim();

  if (BOOKING_ENDPOINT) {
    try {
      const response = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let result = {};
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        result = await response.json().catch(() => ({}));
      } else {
        const text = await response.text().catch(() => "");
        result = { message: text || "Booking submission failed" };
      }
      if (!response.ok || result.status === "error") {
        throw new Error(result.error || result.message || "Booking submission failed");
      }

      form.reset();
      selectedSlot = null;
      renderSlots();
      // store returned clientId/bookingId for tracking
      if (result.clientId) {
        try { localStorage.setItem('online_barber_clientId', result.clientId); } catch (e) {}
      }
      if (result.trackingId) {
        try { localStorage.setItem('online_barber_trackingId', result.trackingId); } catch (e) {}
      }
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank");
      }
      setBookingStatus(result.message || "Booking confirmed! We’ll be in touch shortly.", "success");
      showToast(result.message || "Your booking has been confirmed.");
      return;
    } catch (error) {
      console.error(error);
      persistDemoBooking(payload);
      setBookingStatus("Booking could not be confirmed right now. Your details were saved locally for reference.", "error");
      showToast("Booking endpoint unavailable; saved locally for testing.");
      return;
    }
  }

  persistDemoBooking(payload);
  let msg = `Hi Online Barber! I'd like to book an appointment.\n\n`;
  msg += `Name: ${name}\nPhone: ${phone}\nService: ${serviceLabel}\nDate: ${date}\nTime: ${selectedSlot}\n`;
  if (notes) msg += `Notes: ${notes}\n`;

  const url = `https://wa.me/${BOOKING_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
  setBookingStatus("Booking request prepared. Please confirm on WhatsApp if needed.", "success");
  showToast("Your booking has been reserved.");
}

// Render slots immediately since this script loads at the end of the page
// (DOM is already ready by the time we run)
renderSlots();

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("bookingForm");
  if (form) form.addEventListener("submit", handleBookingSubmit);

  // set min date to today
  const dateInput = document.getElementById("date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("min", today);
  }
  // prefill referral code from URL param ?ref=CODE
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const el = document.getElementById('referralCode');
      if (el) el.value = ref;
    }
  } catch (e) {}
});
