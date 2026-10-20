// Goat Bar checkout (Lineage/Shopify layout): Information -> Shipping -> "Continue to payment" = sold out.
// Never asks for card details. Captures email, name, address and cart to Klaviyo; Meta/GA4 events with value at every step.
(function () {
  const C = window.GB_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const money = n => "$" + n.toFixed(2);
  const ss = { get() { try { return JSON.parse(sessionStorage.getItem("gb_co") || "{}"); } catch { return {}; } }, set(v) { try { sessionStorage.setItem("gb_co", JSON.stringify(v)); } catch {} } };
  const S = window.gbState();
  const cart = S.cart, t = S.totals;
  const FIELDS = ["email", "first", "last", "address1", "address2", "city", "state", "zip", "phone"];
  let shipId = (C.SHIPPING && C.SHIPPING[0] && C.SHIPPING[0].id) || "standard";
  let discount = "";

  // ---------- summary ----------
  const shipOpt = () => (C.SHIPPING || []).find(o => o.id === shipId);
  const shipPrice = o => (o.freeOver && t.value >= C.FREE_SHIPPING_AT ? 0 : o.price);
  const label = i => `${i.size} Bars · ${i.plan === "sub" ? "Subscribe & save, every " + i.every : "One-time purchase"}`;
  function renderSummary(step) {
    if (!cart.length) {
      $("#coItems").innerHTML = `<p class="co-empty">Your cart is empty. <a href="/products/goat-bar/">Shop Goat Bar</a></p>`;
      $("#coLines").hidden = true; $("#coTotM").textContent = money(0); return;
    }
    $("#coItems").innerHTML = cart.map(i => `
      <div class="co-it"><div class="th"><img src="/assets/g-01-hero.jpg" alt=""><i>${i.qty}</i></div>
        <div><b>${i.name}</b><small>${label(i)}</small></div>
        <div class="p">${money(i.unit * i.qty)}${i.full > i.unit ? `<s>${money(i.full * i.qty)}</s>` : ""}</div></div>`).join("");
    const o = shipOpt(), ship = step === "info" || !o ? null : shipPrice(o);
    const total = t.value + (ship || 0);
    $("#coSub").textContent = money(t.value);
    $("#coSaveRow").hidden = !(t.full > t.value);
    $("#coSave").textContent = money(t.full - t.value);
    $("#coShipLine").textContent = ship === null ? "Calculated at next step" : ship === 0 ? "FREE" : money(ship);
    $("#coShipLine").className = ship === null ? "muted" : "";
    $("#coTot").textContent = money(total);
    $("#coTotM").textContent = money(total);
    const subs = cart.filter(i => i.plan === "sub");
    $("#coRecur").hidden = !subs.length;
    if (subs.length) $("#coRecurV").textContent = [...new Set(subs.map(i => i.every))].map(ev => money(subs.filter(i => i.every === ev).reduce((a, i) => a + i.unit * i.qty, 0)) + " every " + ev).join(", ");
    return total;
  }

  // ---------- shipping methods ----------
  $("#coShipOpts").innerHTML = (C.SHIPPING || []).map((o, k) => `
    <label><input type="radio" name="ship" value="${o.id}" ${k === 0 ? "checked" : ""}><span>${o.name}<span class="eta">${o.eta}</span></span><b>${shipPrice(o) === 0 ? "FREE" : money(shipPrice(o))}</b></label>`).join("");
  $("#coShipOpts").addEventListener("change", e => { shipId = e.target.value; renderSummary("ship"); });

  // ---------- form state ----------
  const saved = ss.get();
  FIELDS.forEach(f => { if (saved[f]) $("#co-" + f).value = saved[f]; });
  const val = f => $("#co-" + f).value.trim();
  const persist = () => { const v = {}; FIELDS.forEach(f => v[f] = val(f)); ss.set(v); };
  $("#coInfo").addEventListener("input", persist);

  const rules = {
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Enter a valid email",
    first: v => !!v || "Enter a first name",
    last: v => !!v || "Enter a last name",
    address1: v => !!v || "Enter an address",
    city: v => !!v || "Enter a city",
    state: v => !!v || "Select a state",
    zip: v => /^\d{5}(-\d{4})?$/.test(v) || "Enter a ZIP code",
    phone: v => !v || v.replace(/\D/g, "").length >= 10 || "Enter a valid phone number"
  };
  function validate() {
    let first = null;
    Object.entries(rules).forEach(([f, rule]) => {
      const el = $("#co-" + f), wrap = el.closest(".co-f"), ok = rule(val(f));
      wrap.classList.toggle("bad", ok !== true);
      el.setAttribute("aria-invalid", ok !== true);
      let msg = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains("co-err") ? wrap.nextElementSibling : null;
      if (ok !== true) {
        if (!msg) { msg = document.createElement("p"); msg.className = "co-err"; msg.id = "err-" + f; wrap.after(msg); el.setAttribute("aria-describedby", msg.id); }
        msg.textContent = ok; if (!first) first = el;
      } else if (msg) msg.remove();
    });
    if (first) first.focus();
    return !first;
  }

  // ---------- steps ----------
  function show(step) {
    const ship = step === "ship" && cart.length;
    $("#coInfo").hidden = ship; $("#coShip").hidden = !ship;
    document.querySelectorAll(".co-crumbs [data-step]").forEach(li => {
      const on = li.dataset.step === (ship ? "ship" : "info");
      on ? li.setAttribute("aria-current", "step") : li.removeAttribute("aria-current");
    });
    if (ship) {
      $("#coRvEmail").textContent = val("email");
      $("#coRvAddr").textContent = [val("address1"), val("address2"), val("city"), val("state") + " " + val("zip"), "US"].filter(Boolean).join(", ");
    }
    renderSummary(ship ? "ship" : "info");
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => show(location.hash === "#shipping" && validateQuiet() ? "ship" : "info"));
  const validateQuiet = () => Object.entries(rules).every(([f, r]) => r(val(f)) === true);

  const ev = (extra = {}) => ({ value: +t.value.toFixed(2), currency: C.CURRENCY, num_items: t.items, content_ids: cart.map(i => i.id), content_type: "product", ...extra });
  if (cart.length) window.gbTrack("InitiateCheckout", ev());

  $("#coInfo").addEventListener("submit", e => {
    e.preventDefault();
    if (!validate()) return;
    persist();
    window.gbTrack("AddShippingInfo", ev());
    location.hash = "shipping";
  });
  document.querySelectorAll("[data-goinfo]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); location.hash = ""; show("info"); setTimeout(() => $("#co-" + (b.dataset.goinfo || "email")).focus(), 30); }));

  // ---------- discount ----------
  $("#coDiscBtn").onclick = () => {
    discount = $("#co-disc").value.trim();
    $("#coDiscMsg").textContent = discount ? "Enter a valid discount code" : "";
  };

  // ---------- continue to payment = sold out ----------
  const phoneE164 = p => { const d = p.replace(/\D/g, ""); return d.length === 10 ? "+1" + d : d.length === 11 && d[0] === "1" ? "+" + d : ""; };
  // Checkout details go to Klaviyo as an event on "Continue to payment" (no list subscription).
  // The list subscription (which triggers the "Welcome to the Herd" flow) only happens when they click "Notify me".
  async function capture(consent, email) {
    const o = shipOpt(), total = t.value + shipPrice(o);
    const profile = { first_name: val("first"), last_name: val("last"), location: { address1: val("address1"), address2: val("address2"), city: val("city"), region: val("state"), zip: val("zip"), country: "United States" } };
    if (phoneE164(val("phone"))) profile.phone_number = phoneE164(val("phone"));
    const props = { gb_step: consent ? "notify_me" : "continue_to_payment", gb_shipping_method: o.name, gb_shipping_price: shipPrice(o), gb_checkout_total: +total.toFixed(2), gb_discount_code: discount, gb_phone: val("phone") };
    return window.gbSubscribe(email || val("email"), "checkout", consent, { profile, props });
  }
  function soldOut(state, email) {
    $("#coSoldSum").innerHTML = `Your order: ${cart.map(i => `${i.qty} × ${i.size} bars (${i.plan === "sub" ? "subscribe, every " + i.every : "one-time"})`).join(", ")} · <b>${money(t.value)}</b><br>Ship to: ${val("first")} ${val("last")}, ${val("city")}, ${val("state")}`;
    $("#coSoldP").textContent = {
      ask: "Want to know the moment Goat Bar is back? Tap below and we'll email you.",
      saved: "You're on the list. Check your inbox at " + email + " and confirm your email. We'll tell you the moment Goat Bar is back. You won't be charged.",
      unavailable: "Email signup isn't connected yet, so we can't notify you. Please check back soon.",
      error: "We couldn't save your email. Check your connection and try again."
    }[state];
    $("#coNotify").hidden = state === "saved" || state === "unavailable";
    $("#coSold").hidden = false;
  }
  $("#coShip").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#coPayBtn"); btn.disabled = true; btn.textContent = "Processing…";
    const o = shipOpt(), total = +(t.value + shipPrice(o)).toFixed(2);
    if (window.fbq && C.META_PIXEL_ID) fbq("init", C.META_PIXEL_ID, { em: val("email").toLowerCase(), fn: val("first").toLowerCase(), ln: val("last").toLowerCase(), ph: val("phone").replace(/\D/g, ""), ct: val("city").toLowerCase().replace(/\s/g, ""), st: val("state").toLowerCase(), zp: val("zip").slice(0, 5), country: "us" });
    window.gbTrack("Lead", ev({ value: total, content_name: "Goat Bar sold-out checkout", shipping_method: o.id }));
    try { await capture(false); } catch {}
    btn.disabled = false; btn.textContent = "Continue to payment";
    $("#coNotifyEmail").value = val("email"); $("#coNotifyErr").hidden = true;
    soldOut("ask");
    $("#coNotifyBtn").focus();
  });
  $("#coNotify").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#coNotifyEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("#coNotifyErr").textContent = "Enter a valid email address."; $("#coNotifyErr").hidden = false; return; }
    const b = $("#coNotifyBtn"); b.disabled = true; b.textContent = "Saving…";
    try {
      await capture(true, email);
      window.gbTrack("CompleteRegistration", { content_name: "Notify me: back in stock" });
      try { localStorage.setItem("gb_lead", JSON.stringify({ email, t: Date.now(), source: "checkout_notify" })); } catch {}
      soldOut("saved", email);
    } catch (err) { soldOut(err.message === "signup_unavailable" ? "unavailable" : "error"); }
    finally { b.disabled = false; b.textContent = "Notify me when we're back"; }
  });
  $("#coSold").addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const f = [...$("#coSold").querySelectorAll("a[href],button,input")].filter(x => !x.closest("[hidden]") && !x.hidden); const i = f.indexOf(document.activeElement); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); } });

  // ---------- mobile summary toggle ----------
  $("#coToggle").onclick = () => { const side = $("#coSide"), open = side.classList.toggle("open"); $("#coToggle").setAttribute("aria-expanded", open); $("#coToggleT").textContent = open ? "Hide order summary ▴" : "Show order summary ▾"; };

  show(location.hash === "#shipping" && validateQuiet() ? "ship" : "info");
})();
