/* SiteForge builder UI */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const STORE = "siteforge.project.v1";

  // ---------------- Schema: every input the builder supports ----------------
  const FONTS = ["theme", "Inter", "Poppins", "Montserrat", "Playfair Display", "Lora", "DM Sans", "Space Grotesk", "Outfit", "Nunito", "Raleway", "Merriweather", "Cormorant Garamond", "Rubik", "Manrope"];
  const SECTIONS = ["hero", "stats", "about", "services", "gallery", "video", "team", "reviews", "faq", "cta", "contact"];

  const SCHEMA = [
    { id: "brand", title: "🏷 Brand basics", open: true, fields: [
      { k: "brand.name", label: "Business / brand name", ph: "e.g. Blue Bean Café" },
      { k: "brand.tagline", label: "Tagline / hero headline", ph: "Small-batch coffee, roasted with love" },
      { k: "brand.industry", label: "Industry / category", ph: "Café, dental clinic, SaaS, salon…" },
      { k: "brand.description", label: "Short description", type: "textarea", rows: 3 },
      { k: "brand.about", label: "About / story", type: "textarea", rows: 5, hint: "Blank line = new paragraph" },
      { k: "brand.founded", label: "Founded (year)", ph: "2015" },
      { k: "brand.logo", label: "Logo", type: "image", max: 600 },
    ]},
    { id: "design", title: "🎨 Design & style", fields: [
      { k: "brand.template", label: "Theme", type: "select", options: Object.keys(SiteForge.THEMES) },
      { k: "brand.primaryColor", label: "Primary brand color", type: "color" },
      { k: "brand.accentColor", label: "Accent color", type: "color" },
      { k: "brand.font", label: "Font", type: "select", options: FONTS },
      { k: "lang", label: "Website language code", ph: "en" },
    ]},
    { id: "contact", title: "📍 Contact & location", fields: [
      { k: "contact.phone", label: "Phone", ph: "+91 98765 43210" },
      { k: "contact.whatsapp", label: "WhatsApp number", ph: "+919876543210", hint: "Adds a floating WhatsApp chat button" },
      { k: "contact.email", label: "Email", ph: "hello@brand.com", hint: "Enables the contact form" },
      { k: "contact.address", label: "Address", type: "textarea", rows: 2 },
      { k: "contact.mapUrl", label: "Google Maps link / embed code / coordinates", type: "map", ph: "https://maps.app.goo.gl/…" },
      { k: "contact.hours", label: "Opening hours", type: "textarea", rows: 3, ph: "Mon–Fri: 9:00 – 18:00\nSat: 10:00 – 14:00\nSun: Closed" },
      { k: "contact.priceRange", label: "Price range", ph: "₹₹ or $$" },
    ]},
    { id: "media", title: "🖼 Images & video", fields: [
      { k: "media.hero", label: "Hero / cover image", type: "image" },
      { k: "media.gallery", label: "Gallery images", type: "images" },
      { k: "media.video", label: "Video (YouTube / Vimeo link)", ph: "https://youtube.com/watch?v=…" },
    ]},
    { id: "services", title: "🛍 Services / products / menu", list: "services", fields: [
      { k: "labels.services", label: "Section title", ph: "Our services / Menu / Products" },
    ], item: [
      { k: "title", ph: "Name", w: 2 }, { k: "price", ph: "Price", w: 1 },
      { k: "description", ph: "Description", type: "textarea", rows: 2 }, { k: "image", type: "image", label: "" },
    ]},
    { id: "stats", title: "📊 Highlights / numbers", list: "stats", item: [{ k: "value", ph: "10k+", w: 1 }, { k: "label", ph: "Happy customers", w: 2 }] },
    { id: "testimonials", title: "⭐ Reviews / testimonials", list: "testimonials", item: [
      { k: "name", ph: "Name", w: 2 }, { k: "rating", type: "select", options: ["5", "4", "3", "2", "1"], w: 1 },
      { k: "role", ph: "Role / source (e.g. Google review)" }, { k: "text", ph: "Review text", type: "textarea", rows: 2 },
    ]},
    { id: "team", title: "👥 Team", list: "team", item: [
      { k: "name", ph: "Name", w: 2 }, { k: "role", ph: "Role", w: 1 }, { k: "bio", ph: "Short bio", type: "textarea", rows: 2 }, { k: "photo", type: "image", label: "", max: 500 },
    ]},
    { id: "faq", title: "❓ FAQ", list: "faq", item: [{ k: "q", ph: "Question" }, { k: "a", ph: "Answer", type: "textarea", rows: 2 }] },
    { id: "social", title: "🔗 Social & links", fields: ["instagram", "facebook", "twitter", "linkedin", "youtube", "tiktok", "pinterest", "website"]
      .map((s) => ({ k: `social.${s}`, label: s === "twitter" ? "X / Twitter" : s[0].toUpperCase() + s.slice(1), ph: "https://…" })) },
    { id: "cta", title: "🎯 Call to action", fields: [
      { k: "cta.text", label: "Button text", ph: "Book a table" },
      { k: "cta.link", label: "Button link", ph: "#contact, https://calendly.com/…, tel:…" },
      { k: "cta.headline", label: "CTA banner headline", ph: "Ready to experience …?" },
    ]},
    { id: "seo", title: "🔍 SEO", fields: [
      { k: "seo.title", label: "Page title" }, { k: "seo.description", label: "Meta description", type: "textarea", rows: 2 }, { k: "seo.keywords", label: "Keywords" },
    ]},
    { id: "sections", title: "🧩 Sections to show", custom: "sections" },
  ];

  const blank = () => ({ brand: { template: "modern", font: "theme" }, contact: {}, media: { gallery: [] }, services: [], stats: [], testimonials: [], team: [], faq: [], social: {}, cta: {}, seo: {}, labels: {}, hiddenSections: [] });

  let state = load() || blank();
  let engine = "ai";
  let aiHtml = "";
  let aiAvailable = false;

  // ---------------- helpers ----------------
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function set(obj, path, val) {
    const ks = path.split(".");
    let o = obj;
    ks.slice(0, -1).forEach((k) => { o[k] ??= {}; o = o[k]; });
    o[ks.at(-1)] = val;
  }
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else if (v != null && v !== false) e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  };
  function toast(msg, err = false) {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 3800);
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(state)); }
      catch { toast("Project too large for browser storage – use “Save project” to keep it.", true); }
    }, 500);
  }
  let renderT;
  function changed() {
    save(); clearTimeout(renderT); renderT = setTimeout(renderPreview, 250);
    if (engine === "ai" && aiHtml) $("#aiStatus").textContent = "Inputs changed – click Generate to update the design.";
  }

  // Compress uploaded images in-browser so the site stays light.
  function fileToDataUrl(file, max = 1600) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        if (file.type === "image/svg+xml" || file.type === "image/gif") return resolve(fr.result);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // ---------------- form rendering ----------------
  function input(f, obj, path) {
    const val = get(obj, path) ?? "";
    const onInput = (e) => { set(obj, path, e.target.value); changed(); };
    if (f.type === "textarea") return el("textarea", { rows: f.rows || 3, placeholder: f.ph || "", oninput: onInput }, val);
    if (f.type === "select") {
      const s = el("select", { onchange: onInput }, f.options.map((o) => el("option", { value: o }, o === "theme" ? "Theme default" : o[0].toUpperCase() + o.slice(1))));
      s.value = val || f.options[0];
      return s;
    }
    if (f.type === "color") {
      const text = el("input", { value: val, placeholder: "Theme default", oninput: (e) => { set(obj, path, e.target.value); pick.value = /^#[0-9a-f]{6}$/i.test(e.target.value) ? e.target.value : "#000000"; changed(); } });
      const pick = el("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(val) ? val : "#5b4cf0", oninput: (e) => { set(obj, path, e.target.value); text.value = e.target.value; changed(); } });
      return el("div", { class: "row" }, pick, text);
    }
    if (f.type === "image") return imageField(f, obj, path);
    if (f.type === "images") return imagesField(f, obj, path);
    if (f.type === "map") return mapField(f, obj, path);
    return el("input", { value: val, placeholder: f.ph || "", oninput: onInput });
  }

  function imageField(f, obj, path) {
    const thumb = el("div", { class: "thumb" });
    const url = el("input", { placeholder: "Image URL or upload →", value: (get(obj, path) || "").startsWith("data:") ? "(uploaded image)" : get(obj, path) || "" });
    const refresh = () => { const v = get(obj, path); thumb.style.backgroundImage = v ? `url("${v}")` : ""; };
    url.addEventListener("input", () => { set(obj, path, url.value.trim()); refresh(); changed(); });
    const file = el("input", { type: "file", accept: "image/*", hidden: true, onchange: async (e) => {
      const fl = e.target.files[0]; if (!fl) return;
      set(obj, path, await fileToDataUrl(fl, f.max)); url.value = "(uploaded image)"; refresh(); changed();
    }});
    refresh();
    return el("div", { class: "img-field" }, thumb, el("div", { class: "col" }, url,
      el("div", { class: "row" },
        el("button", { class: "ghost sm", type: "button", onclick: () => file.click() }, "Upload"),
        el("button", { class: "ghost sm", type: "button", onclick: () => { set(obj, path, ""); url.value = ""; refresh(); changed(); } }, "Clear"), file)));
  }

  function imagesField(f, obj, path) {
    const wrap = el("div");
    const draw = () => {
      const list = get(obj, path) || [];
      wrap.replaceChildren(
        el("div", { class: "gal" }, list.map((src, i) => el("div", { class: "g", style: `background-image:url("${src}")` },
          el("button", { class: "x", type: "button", title: "Remove", onclick: () => { list.splice(i, 1); draw(); changed(); } }, "×")))),
        el("div", { class: "row" },
          urlIn,
          el("button", { class: "ghost sm", type: "button", onclick: addUrl }, "Add"),
          el("button", { class: "ghost sm", type: "button", onclick: () => file.click() }, "Upload"), file),
        el("div", { class: "hint" }, `${list.length} image(s). Upload several at once or paste URLs (comma/newline separated).`));
    };
    const urlIn = el("input", { placeholder: "Image URL(s)" });
    const addUrl = () => {
      const urls = urlIn.value.split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u));
      if (!urls.length) return;
      set(obj, path, [...(get(obj, path) || []), ...urls]); urlIn.value = ""; draw(); changed();
    };
    urlIn.addEventListener("keydown", (e) => e.key === "Enter" && addUrl());
    const file = el("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: async (e) => {
      const add = await Promise.all([...e.target.files].map((fl) => fileToDataUrl(fl)));
      set(obj, path, [...(get(obj, path) || []), ...add]); e.target.value = ""; draw(); changed();
    }});
    draw();
    return wrap;
  }

  function mapField(f, obj, path) {
    const status = el("div", { class: "map-ok" });
    const show = () => { status.textContent = obj.contact?.mapEmbed ? "📍 Location pinned – map will appear in the Contact section" : ""; };
    const inp = el("input", { value: get(obj, path) || "", placeholder: f.ph });
    let t;
    inp.addEventListener("input", () => {
      set(obj, path, inp.value.trim());
      clearTimeout(t);
      t = setTimeout(async () => {
        if (!inp.value.trim()) { obj.contact.mapEmbed = ""; show(); changed(); return; }
        try {
          const r = await api("/api/resolve-map", { url: inp.value.trim(), address: obj.contact?.address });
          obj.contact.mapEmbed = r.embedUrl || "";
          if (r.placeName && !obj.brand.name) obj.brand.name = r.placeName;
        } catch { obj.contact.mapEmbed = ""; }
        show(); changed();
      }, 600);
    });
    show();
    return el("div", {}, inp, status, el("div", { class: "hint" }, "Paste a share link (maps.app.goo.gl), a place URL, an <iframe> embed code, or “lat, lng”. Leave empty to map the address."));
  }

  function listSection(sec, body) {
    const listWrap = el("div", { style: "display:grid;gap:12px" });
    const draw = () => {
      const list = state[sec.list] ||= [];
      listWrap.replaceChildren(...list.map((item, i) => {
        const fields = [];
        let pair = [];
        const flush = () => { if (pair.length) { fields.push(pair.length > 1 ? el("div", { class: "item-row" }, pair) : pair[0]); pair = []; } };
        for (const f of sec.item) {
          const node = input(f, item, f.k);
          if (f.w) { pair.push(node); if (pair.length === 2) flush(); } else { flush(); fields.push(node); }
        }
        flush();
        return el("div", { class: "item" }, fields,
          el("button", { class: "x", type: "button", title: "Remove", onclick: () => { list.splice(i, 1); draw(); changed(); updateCounts(); } }, "×"));
      }), el("button", { class: "add", type: "button", onclick: () => { list.push({}); draw(); changed(); updateCounts(); } }, `+ Add ${sec.list === "faq" ? "question" : sec.list === "testimonials" ? "review" : "item"}`));
    };
    draw();
    body.append(listWrap);
  }

  function sectionsToggle(body) {
    const hidden = new Set(state.hiddenSections || []);
    body.append(el("div", { class: "checks" }, SECTIONS.map((s) => {
      const cb = el("input", { type: "checkbox", onchange: (e) => {
        e.target.checked ? hidden.delete(s) : hidden.add(s);
        state.hiddenSections = [...hidden]; changed();
      }});
      cb.checked = !hidden.has(s);
      return el("label", {}, cb, s[0].toUpperCase() + s.slice(1));
    })), el("div", { class: "hint" }, "Sections without content are hidden automatically."));
  }

  function updateCounts() {
    document.querySelectorAll("[data-count]").forEach((c) => {
      const n = (state[c.dataset.count] || []).length; c.textContent = n; c.hidden = !n;
    });
  }

  function renderForm() {
    const openIds = new Set([...document.querySelectorAll("#form details[open]")].map((d) => d.dataset.id));
    const root = $("#form");
    root.replaceChildren(...SCHEMA.map((sec) => {
      const body = el("div", { class: "sec-body" });
      for (const f of sec.fields || []) {
        body.append(el("div", { class: "field" }, f.label ? el("label", { class: "lbl" }, f.label) : null, input(f, state, f.k), f.hint ? el("div", { class: "hint" }, f.hint) : null));
      }
      if (sec.list) listSection(sec, body);
      if (sec.custom === "sections") sectionsToggle(body);
      return el("details", { class: "sec", "data-id": sec.id, open: openIds.size ? openIds.has(sec.id) : !!sec.open },
        el("summary", {}, sec.title, sec.list ? el("span", { class: "cnt", "data-count": sec.list }) : null), body);
    }));
    updateCounts();
    $("#themeQuick").value = state.brand.template || "modern";
    $("#rName").value ||= state.brand.name || "";
  }

  // ---------------- preview ----------------
  function currentHtml() { return engine === "ai" && aiHtml ? aiHtml : SiteForge.generateSite(state); }
  function renderPreview() {
    if (engine === "ai" && aiHtml) return; // AI design stays until regenerated
    SF.setPreview($("#preview"), SiteForge.generateSite(state));
  }

  // ---------------- merge imported data (fills blanks, never overwrites) ----------------
  function isEmpty(v) {
    if (v == null || v === "") return true;
    if (Array.isArray(v)) return v.every((x) => (typeof x === "object" ? Object.values(x || {}).every(isEmpty) : isEmpty(x)));
    return false;
  }
  function fill(target, src, overwrite = false) {
    for (const [k, v] of Object.entries(src || {})) {
      if (isEmpty(v) || k === "sources") continue;
      if (k === "gallery" && Array.isArray(v)) { target[k] = [...new Set([...(target[k] || []), ...v])]; continue; }
      if (Array.isArray(v)) { if (overwrite || isEmpty(target[k])) target[k] = v.filter((x) => !isEmpty(x)); continue; }
      if (typeof v === "object") { target[k] ??= {}; fill(target[k], v, overwrite); continue; }
      if (overwrite || isEmpty(target[k])) target[k] = String(v);
    }
  }
  async function applyImport(data) {
    if (data?.contact?.mapUrl && !data.contact.mapEmbed && !state.contact.mapEmbed) {
      try { data.contact.mapEmbed = (await api("/api/resolve-map", { url: data.contact.mapUrl, address: data.contact.address })).embedUrl; } catch { /* ignore */ }
    }
    fill(state, data);
    save(); renderForm(); renderPreview();
  }

  // ---------------- network ----------------
  async function api(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  async function sse(url, body, handlers) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = chunk.match(/^event: (.*)$/m)?.[1];
        const data = chunk.match(/^data: (.*)$/m)?.[1];
        if (ev && data) handlers[ev]?.(JSON.parse(data));
      }
    }
  }
  const log = (msg) => { const l = $("#log"); l.hidden = false; l.append(el("div", {}, msg)); l.scrollTop = l.scrollHeight; };
  function busy(btn, on, label) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${label || "Working…"}`; btn.disabled = true; }
    else { btn.innerHTML = btn.dataset.label; btn.disabled = !aiAvailable && btn.dataset.ai === "1"; }
  }

  // Replace uploaded (data:) images with tokens so the AI prompt stays small.
  function tokenizeImages(data) {
    const map = [];
    const walk = (v) => {
      if (typeof v === "string" && v.startsWith("data:image")) { map.push(v); return `__IMG_${map.length - 1}__`; }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
      return v;
    };
    return { data: walk(data), map };
  }

  // ---------------- actions ----------------
  $("#btnImport").onclick = async () => {
    const url = $("#importUrl").value.trim();
    if (!url) return toast("Paste a website or Google Maps link first", true);
    const btn = $("#btnImport"); busy(btn, true, "Importing");
    try {
      log(`→ Importing ${url}`);
      const r = await api("/api/import-url", { url: /^https?:\/\//.test(url) ? url : "https://" + url });
      const d = r.data;
      log(`✓ Found: ${[d.brand?.name && "name", d.brand?.logo && "logo", d.media?.gallery?.length && `${d.media.gallery.length} images`, d.contact?.phone && "phone", d.contact?.email && "email", d.contact?.address && "address", d.contact?.mapEmbed && "map", d.testimonials?.length && `${d.testimonials.length} reviews`, Object.keys(d.social || {}).length && "social links"].filter(Boolean).join(", ") || "basic info"}`);
      (r.notes || []).forEach((n) => log("ℹ " + n));
      await applyImport(d);
      if (d.brand?.name) $("#rName").value = d.brand.name;
      toast("Imported – empty fields were filled in");
    } catch (e) { log("✗ " + e.message); toast(e.message, true); }
    busy(btn, false);
  };

  $("#btnResearch").onclick = async () => {
    const name = $("#rName").value.trim() || state.brand.name;
    if (!name && !$("#importUrl").value.trim()) return toast("Enter the brand name (and city) to research", true);
    const btn = $("#btnResearch"); busy(btn, true, "Researching the web…");
    log(`→ AI research: ${name} ${$("#rLoc").value}`);
    const known = tokenizeImages(state).data;
    try {
      await sse("/api/ai/research", { name, location: $("#rLoc").value, hints: $("#rHints").value, url: $("#importUrl").value.trim(), known }, {
        progress: (ev) => ev.detail && log(`${ev.name === "web_search" ? "🔎" : ev.name === "note" ? "ℹ" : "🌐"} ${ev.detail}`),
        done: async (data) => {
          (data.sources || []).slice(0, 8).forEach((s) => log("source: " + s));
          await applyImport(data);
          log("✓ Research complete – form updated");
          toast("AI research complete – review the filled fields");
        },
        error: (e) => { throw new Error(e.error); },
      });
    } catch (e) { log("✗ " + e.message); toast(e.message, true); }
    busy(btn, false);
  };

  $("#btnCopy").onclick = async () => {
    const btn = $("#btnCopy"); busy(btn, true, "Writing…");
    try {
      const { data, map } = tokenizeImages(state);
      const out = await api("/api/ai/copy", { data });
      const restored = JSON.parse(JSON.stringify(out).replace(/__IMG_(\d+)__/g, (_, i) => map[+i] || ""));
      fill(state, restored);
      save(); renderForm(); renderPreview();
      toast("Copy written for empty fields");
    } catch (e) { toast(e.message, true); }
    busy(btn, false);
  };

  $("#btnDesign").onclick = async () => {
    if (!state.brand.name) return toast("Add at least a brand name first", true);
    const btn = $("#btnDesign"); busy(btn, true, "Designing…");
    const status = $("#aiStatus");
    const { data, map } = tokenizeImages({ ...state, contact: { ...state.contact, mapEmbed: SiteForge.mapEmbedFrom(state.contact) } });
    let html = "";
    let last = 0;
    const restore = (h) => h.replace(/__IMG_(\d+)__/g, (_, i) => map[+i] || "").replace(/^```html\s*/i, "").replace(/```\s*$/, "");
    status.textContent = "Thinking about the design…";
    try {
      await sse("/api/ai/design", { data, style: $("#aiStyle").value }, {
        reset: () => { html = ""; },
        text: (t) => {
          html += t;
          status.textContent = `Writing… ${(html.length / 1024).toFixed(0)} KB`;
          if (Date.now() - last > 2000) { last = Date.now(); SF.setPreview($("#preview"), SF.partialHtml(restore(html))); }
        },
        done: () => { aiHtml = restore(html); SF.setPreview($("#preview"), aiHtml, false); status.textContent = "✓ Done – edit inputs & regenerate anytime"; },
        error: (e) => { throw new Error(e.error); },
      });
    } catch (e) { status.textContent = "✗ " + e.message; toast(e.message, true); }
    busy(btn, false);
  };

  $("#engine").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    engine = b.dataset.v;
    [...$("#engine").children].forEach((x) => x.classList.toggle("on", x === b));
    $("#aiBar").hidden = engine !== "ai";
    $("#themeQuick").hidden = engine === "ai";
    if (engine === "ai" && aiHtml) SF.setPreview($("#preview"), aiHtml, false); else renderPreview();
    if (engine === "ai" && !aiAvailable) $("#aiStatus").textContent = "Start the server with GEMINI_API_KEY (free) to enable.";
  };
  $("#device").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    [...$("#device").children].forEach((x) => x.classList.toggle("on", x === b));
    $("#frameWrap").style.width = b.dataset.v;
  };
  const themeSel = $("#themeQuick");
  Object.keys(SiteForge.THEMES).forEach((t) => themeSel.append(el("option", { value: t }, `Theme: ${t[0].toUpperCase() + t.slice(1)}`)));
  themeSel.onchange = () => { state.brand.template = themeSel.value; renderForm(); changed(); };

  const slug = () => (state.brand.name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "website";
  const download = (name, content, type) => {
    const a = el("a", { href: URL.createObjectURL(new Blob([content], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  };
  $("#btnDownload").onclick = () => { download(`${slug()}.html`, currentHtml(), "text/html"); toast("Downloaded – upload this single file to any host (Netlify, Vercel, GitHub Pages, cPanel…)"); };
  $("#btnOpen").onclick = () => { const w = window.open(); w.document.write(currentHtml()); w.document.close(); };
  $("#btnExport").onclick = () => download(`${slug()}.siteforge.json`, JSON.stringify(state, null, 2), "application/json");
  $("#fileProject").onchange = async (e) => {
    try { state = { ...blank(), ...JSON.parse(await e.target.files[0].text()) }; save(); renderForm(); renderPreview(); toast("Project loaded"); }
    catch { toast("Not a valid project file", true); }
    e.target.value = "";
  };
  $("#btnReset").onclick = () => { if (confirm("Clear all inputs?")) { state = blank(); aiHtml = ""; save(); renderForm(); renderPreview(); } };
  $("#btnSample").onclick = () => { state = sample(); aiHtml = ""; save(); renderForm(); renderPreview(); toast("Sample brand loaded"); };

  function sample() {
    const u = (id, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
    return { ...blank(),
      brand: { name: "Blue Bean Café", tagline: "Small-batch coffee, roasted with love", industry: "Specialty café & roastery", template: "elegant", font: "theme", primaryColor: "#6b4226", accentColor: "#d4a373", founded: "2016",
        description: "A neighbourhood café serving single-origin pour-overs, fresh pastries and slow mornings.",
        about: "Blue Bean started as a tiny cart outside the city market. Today we roast every bean in-house, in small batches, so each cup tastes exactly the way the farmer intended.\n\nWe work directly with growers in Coorg, Chikmagalur and Ethiopia, and bake everything fresh each morning." },
      contact: { phone: "+91 98765 43210", whatsapp: "+919876543210", email: "hello@bluebean.example", address: "12 MG Road, Bengaluru, Karnataka 560001", mapUrl: "MG Road, Bengaluru", hours: "Mon–Fri: 7:30 – 21:00\nSat–Sun: 8:00 – 22:00" },
      media: { hero: u("photo-1501339847302-ac426a4a7cbb"), gallery: [u("photo-1495474472287-4d71bcdd2085", 900), u("photo-1509042239860-f550ce710b93", 900), u("photo-1554118811-1e0d58224f24", 900), u("photo-1442512595331-e89e73853f31", 900)], video: "" },
      labels: { services: "Our menu" },
      services: [
        { title: "Pour-over", price: "₹220", description: "Single-origin beans, hand-brewed to order.", image: u("photo-1495474472287-4d71bcdd2085", 800) },
        { title: "Cappuccino", price: "₹180", description: "Velvety micro-foam over a double shot of our house espresso.", image: u("photo-1509042239860-f550ce710b93", 800) },
        { title: "Almond croissant", price: "₹160", description: "Baked fresh every morning with French butter.", image: "" },
      ],
      stats: [{ value: "4.8★", label: "1,200+ Google reviews" }, { value: "12", label: "Single-origin coffees" }, { value: "2016", label: "Roasting since" }],
      testimonials: [{ name: "Ananya R.", role: "Google review", rating: "5", text: "Best pour-over in the city, and the staff genuinely care about coffee." }, { name: "Rahul M.", role: "Google review", rating: "5", text: "My daily work spot – great Wi-Fi, better croissants." }],
      faq: [{ q: "Do you have vegan options?", a: "Yes – oat and almond milk at no extra charge, plus vegan bakes daily." }, { q: "Can I buy beans to take home?", a: "Absolutely. All our roasts are available in 250g bags, ground to order." }],
      social: { instagram: "https://instagram.com/bluebean", facebook: "https://facebook.com/bluebean" },
      cta: { text: "Order on WhatsApp", link: "https://wa.me/919876543210" },
      seo: { title: "Blue Bean Café – Specialty Coffee in Bengaluru", description: "Small-batch roastery & café on MG Road, Bengaluru." },
    };
  }


  // ---------------- one click: Maps link → complete website ----------------
  $("#btnMagic").onclick = async () => {
    const url = $("#magicUrl").value.trim();
    if (!/^https?:\/\//.test(url)) return SF.toast("Paste a Google Maps link (https://…)", true);
    const btn = $("#btnMagic"); busy(btn, true, "Building…");
    $("#log").innerHTML = "";
    let html = "", last = 0;
    // switch to AI view
    engine = "ai"; [...$("#engine").children].forEach((x) => x.classList.toggle("on", x.dataset.v === "ai"));
    $("#aiBar").hidden = false; $("#themeQuick").hidden = true;
    try {
      await SF.sse("/api/auto", { mapUrl: url }, {
        log: (e) => { log(e.msg); $("#aiStatus").textContent = e.msg; },
        data: (e) => { state = { ...blank(), ...e.data }; save(); renderForm(); },
        reset: () => { html = ""; },
        html: (e) => { html += e.text; if (Date.now() - last > 2500) { last = Date.now(); SF.setPreview($("#preview"), SF.partialHtml(html)); } },
        done: (e) => {
          state = { ...blank(), ...e.data }; aiHtml = e.engine === "ai" ? e.html : "";
          save(); renderForm();
          SF.setPreview($("#preview"), e.html, false);
          if (!aiHtml) { engine = "template"; [...$("#engine").children].forEach((x) => x.classList.toggle("on", x.dataset.v === "template")); }
          $("#aiStatus").textContent = `✓ Saved as ${e.url}`;
          history.replaceState(null, "", `?site=${encodeURIComponent(e.slug)}`);
          SF.toast("Website ready – tweak anything on the left, then Generate again or Download.");
        },
        error: (e) => { throw new Error(e.error); },
      });
    } catch (e) { log("✗ " + e.message); SF.toast(e.message, true); }
    busy(btn, false);
  };

  async function loadSavedSite(slug) {
    try {
      const [data, html] = await Promise.all([
        fetch(`/sites/${slug}/data.json`).then((r) => { if (!r.ok) throw new Error("not found"); return r.json(); }),
        fetch(`/sites/${slug}/index.html`).then((r) => r.text()),
      ]);
      state = { ...blank(), ...data };
      aiHtml = html; engine = "ai";
      [...$("#engine").children].forEach((x) => x.classList.toggle("on", x.dataset.v === "ai"));
      $("#themeQuick").hidden = true;
      renderForm(); SF.setPreview($("#preview"), html, false);
      $("#aiStatus").textContent = `Editing saved demo: ${state.brand.name}`;
      return true;
    } catch { SF.toast("Saved site not found", true); return false; }
  }

  // ---------------- boot ----------------
  fetch("/api/status").then((r) => r.json()).then((s) => {
    aiAvailable = s.ai;
    const who = s.provider === "gemini" ? "Google Gemini (free tier) – it reads web pages and uses Google Search when your key allows it –" : "Claude with live web search";
    ["#btnResearch", "#btnCopy", "#btnDesign"].forEach((id) => { const b = $(id); b.dataset.ai = "1"; b.disabled = !aiAvailable; if (!aiAvailable) b.title = "Start the server with GEMINI_API_KEY (free) to enable AI"; });
    $("#aiNote").textContent = aiAvailable ? `Uses ${who} to find details, photos, reviews and hours.` : "AI is off: get a FREE key at aistudio.google.com/apikey and start the server with GEMINI_API_KEY=your-key. Import & templates work without it.";
  }).catch(() => {});
  $("#themeQuick").hidden = engine === "ai";
  renderForm();
  const siteParam = new URLSearchParams(location.search).get("site");
  if (siteParam) loadSavedSite(siteParam);
  else renderPreview();
})();
