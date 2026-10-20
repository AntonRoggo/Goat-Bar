// Goat Bar storefront: cart drawer, sold-out fake door at checkout, Klaviyo capture, Meta Pixel / GA4 events, UTM attribution.
(function () {
  const C = window.GB_CONFIG || {};
  const signupReady = Boolean(C.KLAVIYO_PUBLIC_KEY && C.KLAVIYO_LIST_ID);
  const signupPending = "Email signup is not available yet. Your email has not been submitted. Please check back soon.";
  const $ = (s, r = document) => r.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const money = n => "$" + n.toFixed(2);

  // ---------- attribution (UTMs, fbclid -> _fbc) ----------
  const qs = new URLSearchParams(location.search);
  const attr = store.get("gb_attr", {});
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "ttclid"].forEach(k => { if (qs.get(k)) attr[k] = qs.get(k); });
  if (!attr.first_landing) { attr.first_landing = location.pathname; attr.first_seen = new Date().toISOString(); attr.referrer = document.referrer || "direct"; }
  if (qs.get("fbclid")) attr.fbc = `fb.1.${Date.now()}.${qs.get("fbclid")}`;
  store.set("gb_attr", attr);

  // ---------- pixels ----------
  if (C.META_PIXEL_ID) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", C.META_PIXEL_ID);
    fbq("track", "PageView");
  }
  if (C.GA4_ID) {
    const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + C.GA4_ID; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag("js", new Date()); gtag("config", C.GA4_ID);
  }
  const eid = () => "gb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function track(event, data = {}) {
    const id = eid();
    const standard = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo", "Lead", "CompleteRegistration", "Purchase"];
    if (window.fbq) fbq(standard.includes(event) ? "track" : "trackCustom", event, data, { eventID: id });
    if (window.gtag) gtag("event", { ViewContent: "view_item", AddToCart: "add_to_cart", InitiateCheckout: "begin_checkout", AddShippingInfo: "add_shipping_info", Lead: "generate_lead", CompleteRegistration: "sign_up" }[event] || event, { value: data.value, currency: data.currency });
    (window.dataLayer = window.dataLayer || []).push({ event, ...data, event_id: id });
    const log = store.get("gb_events", []); log.push({ event, data, t: Date.now() }); store.set("gb_events", log.slice(-50));
  }
  window.gbTrack = track;

  // ---------- cart ----------
  let cart = store.get("gb_cart", []);
  const unit = item => { const p = C.PRICES[item.size]; return item.plan === "sub" ? p * (1 - C.SUB_DISCOUNT) : p; };
  const fullUnit = item => C.WAS[item.size] || C.PRICES[item.size];
  const totals = () => cart.reduce((a, i) => ({ value: a.value + unit(i) * i.qty, full: a.full + fullUnit(i) * i.qty, items: a.items + i.qty }), { value: 0, full: 0, items: 0 });
  const save = () => { store.set("gb_cart", cart); renderCount(); renderDrawer(); };
  function renderCount() { document.querySelectorAll("[data-cart-count]").forEach(el => { const n = totals().items; el.textContent = n; el.hidden = n === 0; }); }

  window.gbAddToCart = function ({ size, plan, every }) {
    const found = cart.find(i => i.size === size && i.plan === plan);
    if (found) found.qty += 1; else cart.push({ id: "goat-bar-ccc-" + size, name: "Goat Bar (Chocolate Chip Cookie)", size, plan, every: every || "30 days", qty: 1 });
    save();
    const it = cart.find(i => i.size === size && i.plan === plan);
    track("AddToCart", { value: +unit(it).toFixed(2), currency: C.CURRENCY, content_ids: [it.id], content_type: "product", content_name: it.name, num_items: 1 });
    openDrawer();
  };

  // ---------- drawer ----------
  const drawerHTML = `
  <div class="gb-scrim" data-close hidden></div>
  <aside class="gb-drawer" aria-label="Your cart" aria-hidden="true">
    <div class="gb-dh"><h2>Your Cart <span class="gb-badge" data-cart-count>0</span></h2><button class="gb-x" data-close aria-label="Close cart">×</button></div>
    <div class="gb-ship"><div class="gb-ship-t" id="gbShipT"></div><div class="gb-bar-wrap"><div class="gb-bar"><i id="gbShipBar"></i></div><svg class="gb-truck" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6h13v10H1zM14 10h4l3 3v3h-7z"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg></div></div>
    <div class="gb-items" id="gbItems"></div>
    <div class="gb-foot">
      <div class="gb-total"><span>Total</span><span><em class="gb-off" id="gbOff">10% OFF</em> <s id="gbFull"></s> <b id="gbTotal">$0.00</b></span></div>
      <button class="gb-checkout" id="gbCheckout"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg> Secure checkout</button>
      <div class="gb-trust"><span>Free US shipping $99+</span><span>30-day returns</span><span>Money-back guarantee</span></div>
    </div>
  </aside>
  <div class="gb-modal" id="gbModal" role="dialog" aria-modal="true" aria-labelledby="gbModalH" hidden>
    <div class="gb-card">
      <button class="gb-x" id="gbModalX" aria-label="Close">×</button>
      <div class="gb-tag" id="gbModalTag">Sold out</div>
      <h2 id="gbModalH">Sold out. You haven't been charged.</h2>
      <p id="gbModalP">Nothing was purchased. Leave your email and we'll tell you the moment Goat Bar is live.</p>
      <div class="gb-sum" id="gbSum"></div>
      <form id="gbForm" novalidate>
        <label for="gbEmail">Email</label>
        <input id="gbEmail" type="email" autocomplete="email" placeholder="you@email.com" required>
        <label class="gb-opt"><input type="checkbox" id="gbOpt" checked> Email me launch updates, news and offers.</label>
        <button class="gb-checkout" type="submit" id="gbSubmit">Notify me</button>
        <p class="gb-err" id="gbErr" role="status" aria-live="polite" hidden></p>
      </form>
      <div id="gbDone" hidden><h3>Check your inbox.</h3><p>Confirm your email and we'll tell you the moment Goat Bar is live. You won't be charged.</p><button class="gb-mini" data-closemodal>Keep browsing</button></div>
      <p class="gb-fine">No payment was taken and you won't be charged. By signing up you agree to our <a href="/pages/privacy/">privacy policy</a>.</p>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", drawerHTML);
  const drawer = $(".gb-drawer"), scrim = $(".gb-scrim"), modal = $("#gbModal");

  function renderDrawer() {
    const t = totals(), left = Math.max(0, C.FREE_SHIPPING_AT - t.value);
    $("#gbShipT").innerHTML = t.items === 0 ? "Add $" + C.FREE_SHIPPING_AT + " for FREE SHIPPING" : left > 0 ? `You're ${money(left)} away from <b>FREE SHIPPING</b>` : "Congrats! You've unlocked <b>FREE SHIPPING</b>";
    $("#gbShipBar").style.width = Math.min(100, (t.value / C.FREE_SHIPPING_AT) * 100) + "%";
    $("#gbItems").innerHTML = cart.length ? cart.map((i, k) => `
      <div class="gb-item">
        <img src="/assets/g-01-hero.jpg" alt="">
        <div class="gb-meta"><b>${i.name}</b><span>${i.size} Bars</span>
          ${i.plan === "sub" ? `<select data-every="${k}" aria-label="Delivery frequency">${["15 days", "30 days", "45 days"].map(d => `<option ${d === i.every ? "selected" : ""}>Every ${d}</option>`).join("")}</select>` : `<span>One-time purchase</span>`}
          <div class="gb-price"><b>${money(unit(i) * i.qty)}</b>${fullUnit(i) > unit(i) ? ` <s>${money(fullUnit(i) * i.qty)}</s> <em>(Save ${money((fullUnit(i) - unit(i)) * i.qty)})</em>` : ""}</div>
          <div class="gb-qty"><button data-dec="${k}" aria-label="Decrease">−</button><span>${i.qty}</span><button data-inc="${k}" aria-label="Increase">+</button></div>
        </div>
        <button class="gb-rm" data-rm="${k}" aria-label="Remove">×</button>
      </div>`).join("") : `<p class="gb-empty">Your cart is empty.</p>`;
    $("#gbTotal").textContent = money(t.value);
    $("#gbFull").textContent = t.full > t.value ? money(t.full) : "";
    $("#gbOff").hidden = !cart.some(i => i.plan === "sub");
    $("#gbCheckout").disabled = t.items === 0;
  }
  function openDrawer() { renderDrawer(); scrim.hidden = false; drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); }
  function closeDrawer() { scrim.hidden = true; drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); }
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-close],[data-inc],[data-dec],[data-rm],[data-opencart],[data-closemodal]");
    if (!el) return;
    if (el.hasAttribute("data-close")) closeDrawer();
    if (el.hasAttribute("data-opencart")) { e.preventDefault(); openDrawer(); }
    if (el.hasAttribute("data-closemodal")) closeModal();
    if (el.dataset.inc) { cart[+el.dataset.inc].qty++; save(); }
    if (el.dataset.dec) { const i = cart[+el.dataset.dec]; i.qty--; if (i.qty < 1) cart.splice(+el.dataset.dec, 1); save(); }
    if (el.dataset.rm) { cart.splice(+el.dataset.rm, 1); save(); }
  });
  document.addEventListener("change", e => { if (e.target.dataset.every) { cart[+e.target.dataset.every].every = e.target.value.replace("Every ", ""); save(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); if (!modal.hidden) closeModal(); } });

  // ---------- fake door ----------
  let modalTrigger;
  function openModal(source) {
    modalTrigger = document.activeElement;
    const t = totals();
    $("#gbSum").innerHTML = t.items ? `Your cart: ${cart.map(i => `${i.qty} × ${i.size} bars (${i.plan === "sub" ? "subscribe, every " + i.every : "one-time"})`).join(", ")} · <b>${money(t.value)}</b>` : "";
    modal.dataset.source = source;
    const next = source === "upsell_notify";
    $("#gbModalTag").textContent = next ? "Coming soon" : "Sold out";
    $("#gbModalH").textContent = next ? "The next flavor is on its way." : "Sold out. You haven't been charged.";
    $("#gbModalP").textContent = next ? "Leave your email and we'll tell you when it drops." : "Nothing was purchased. Leave your email and we'll tell you the moment Goat Bar is live.";
    $("#gbForm").hidden = false; $("#gbDone").hidden = true; $("#gbErr").hidden = true;
    if (!signupReady) { $("#gbErr").textContent = signupPending; $("#gbErr").hidden = false; }
    modal.hidden = false; setTimeout(() => $("#gbEmail").focus(), 50);
  }
  function closeModal() { modal.hidden = true; if (modalTrigger) modalTrigger.focus(); }
  $("#gbModalX").onclick = closeModal;
  modal.addEventListener("keydown", e => {
    if (e.key !== "Tab") return;
    const focusable = [...modal.querySelectorAll('button, input, a[href]')].filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Secure checkout goes to the Lineage-style checkout page; InitiateCheckout fires there.
  $("#gbCheckout").onclick = () => { location.href = "/checkouts/"; };

  async function klaviyo(email, consent, extra = {}) {
    if (!signupReady) throw new Error("signup_unavailable");
    const t = totals();
    const props = { ...(extra.props || {}), gb_source: modal.dataset.source, gb_cart_value: +t.value.toFixed(2), gb_cart_items: t.items, gb_cart: cart.map(i => `${i.qty}x${i.size}-${i.plan}${i.plan === "sub" ? "-" + i.every : ""}`).join("|"), gb_flavor: "Chocolate Chip Cookie", ...Object.fromEntries(Object.entries(attr).map(([k, v]) => ["gb_" + k, v])) };
    const H = { "Content-Type": "application/vnd.api+json", revision: "2024-10-15" };
    const base = "https://a.klaviyo.com/client/";
    const q = "?company_id=" + encodeURIComponent(C.KLAVIYO_PUBLIC_KEY);
    const reqs = [fetch(base + "events/" + q, { method: "POST", headers: H, body: JSON.stringify({ data: { type: "event", attributes: { properties: props, value: +t.value.toFixed(2), metric: { data: { type: "metric", attributes: { name: "Goat Bar Sold Out Checkout" } } }, profile: { data: { type: "profile", attributes: { email, ...(extra.profile || {}), properties: props } } } } } }) })];
    if (consent && C.KLAVIYO_LIST_ID) reqs.push(fetch(base + "subscriptions/" + q, { method: "POST", headers: H, body: JSON.stringify({ data: { type: "subscription", attributes: { custom_source: "Goat Bar sold-out popup", profile: { data: { type: "profile", attributes: { email, properties: props } } } }, relationships: { list: { data: { type: "list", id: C.KLAVIYO_LIST_ID } } } } }) }));
    const res = await Promise.all(reqs);
    if (res.some(r => !r.ok && r.status !== 202)) throw new Error("klaviyo " + res.map(r => r.status).join(","));
    return { ok: true };
  }
  $("#gbForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#gbEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("#gbErr").textContent = "Enter a valid email address."; $("#gbErr").hidden = false; return; }
    $("#gbSubmit").disabled = true; $("#gbSubmit").textContent = "Saving…";
    try {
      await klaviyo(email, $("#gbOpt").checked);
      const t = totals();
      track("CompleteRegistration", { content_name: "Goat Bar waitlist" });
      store.set("gb_lead", { email, t: Date.now() });
      $("#gbForm").hidden = true; $("#gbDone").hidden = false;
    } catch (err) {
      $("#gbErr").textContent = err.message === "signup_unavailable" ? signupPending : "That didn't go through. Check your connection and try again."; $("#gbErr").hidden = false;
    } finally { $("#gbSubmit").disabled = false; $("#gbSubmit").textContent = "Get notified"; }
  });

  window.gbSubscribe = (email, source, consent = true, extra) => { modal.dataset.source = source; return klaviyo(email, consent, extra); };
  window.gbSignupReady = signupReady;
  window.gbState = () => ({ cart: cart.map(i => ({ ...i, unit: unit(i), full: fullUnit(i) })), totals: totals(), attr });
  // Shared newsletter handler: success only follows a confirmed service response.
  const newsForm = $("#newsForm"), newsStatus = $("#newsOk");
  if (newsForm && newsStatus) {
    const input = $("#email"), button = $("button[type=submit]", newsForm);
    newsStatus.setAttribute("role", "status");
    newsStatus.setAttribute("aria-live", "polite");
    input.setAttribute("aria-describedby", "newsOk");
    if (!signupReady) { newsStatus.textContent = signupPending; newsStatus.hidden = false; }
    newsForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!newsForm.reportValidity()) return;
      const label = button.textContent;
      button.disabled = true;
      button.textContent = "Saving…";
      try {
        await window.gbSubscribe(input.value.trim(), "newsletter");
        newsStatus.textContent = "Thanks. Check your inbox for any confirmation email.";
        track("CompleteRegistration", { content_name: "newsletter" });
      } catch (err) {
        console.error("Goat Bar signup failed:", err.message);
        newsStatus.textContent = err.message === "signup_unavailable" ? signupPending : "That didn’t go through. Please try again.";
      } finally {
        newsStatus.hidden = false;
        button.disabled = false;
        button.textContent = label;
      }
    });
  }
  renderCount();
  window.gbOpenCart = openDrawer;
})();
