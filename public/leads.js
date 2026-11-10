/* Leads page: sheet → table → one-click / bulk demo websites. */
(() => {
  const { $, toast, api, sse, setPreview, download, deviceSwitcher } = SF;
  const LS = "siteforge.leads.v1";
  let leads = [];
  let sites = {};
  let selected = new Set();
  let running = null; // AbortController while a bulk run is active
  const status = {}; // lead.id -> { state, msg }
  let canPublish = false;
  const TPL_KEY = "pinpage.msgTpl.v1";
  const DEFAULT_TPL = "Namaste {name} team 🙏\n\nAapke business ke liye humne ek *free demo website* banayi hai – ⭐ {rating} Google rating ({reviews} reviews) ke saath:\n{link}\n\nWhatsApp, call aur Google Maps directions sab ready hai. Pasand aaye to batayein – ise aapki official website bana denge 😊";
  const waDigits = (phone) => { const d = String(phone || "").replace(/\D/g, ""); return /^[6-9]\d{9}$/.test(d) ? "91" + d : /^91[6-9]\d{9}$/.test(d) ? d : ""; };
  const shareUrl = (site) => site?.ownUrl || site?.publishedUrl || "";
  function message(lead, link) {
    const tpl = $("#msgTpl").value || DEFAULT_TPL;
    return tpl.replaceAll("{name}", lead.name).replaceAll("{link}", link).replaceAll("{rating}", lead.rating || "").replaceAll("{reviews}", lead.reviews || "").replaceAll("{area}", lead.locality || "");
  }

  const CAT_LABEL = { jewellery: "💍 Jewellery", spa: "💆 Spa", clinic: "🩺 Clinic", dental: "🦷 Dental", restaurant: "🍽 Restaurant", salon: "💇 Salon", makeup: "💄 Makeup", nails: "💅 Nails", banquet: "🎉 Banquet", general: "🏪 Business" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function save() { try { localStorage.setItem(LS, JSON.stringify({ url: $("#sheetUrl").value, leads })); } catch { /* ignore */ } }
  function siteFor(lead) {
    // newest build that matches this lead (by Maps link or name)
    return Object.entries(sites).filter(([, s]) => (lead.mapsUrl && s.mapsUrl === lead.mapsUrl) || s.name === lead.name)
      .sort((a, b) => (b[1].builtAt || "").localeCompare(a[1].builtAt || ""))[0];
  }

  function visible() {
    const cat = $("#fCat").value, q = $("#fSearch").value.toLowerCase(), noSite = $("#fNoSite").checked;
    return leads.filter((l) => (!noSite || !l.hasWebsite) && (!cat || l.category === cat) &&
      (!q || `${l.name} ${l.locality} ${l.address} ${l.phone}`.toLowerCase().includes(q)));
  }

  function render() {
    const list = visible();
    $("#count").textContent = leads.length ? `${list.length} of ${leads.length} leads` : "";
    const cats = [...new Set(leads.map((l) => l.category))];
    const fc = $("#fCat"), cur = fc.value;
    fc.innerHTML = `<option value="">All types</option>` + cats.map((c) => `<option value="${c}">${CAT_LABEL[c] || c} (${leads.filter((l) => l.category === c).length})</option>`).join("");
    fc.value = cur;
    if (!list.length) { $("#rows").innerHTML = `<tr><td colspan="6" class="empty">${leads.length ? "No leads match the filters." : "Paste your Google Sheet link above and click <b>Load leads</b>."}</td></tr>`; return updateBulk(); }
    $("#rows").innerHTML = list.map((l) => {
      const s = siteFor(l);
      const st = status[l.id];
      const stHtml = st ? `<span class="st ${st.state}">${esc(st.msg)}</span>`
        : s ? `<span class="st ok">✓ ${s[1].engine === "ai" ? "AI design" : "Template"}</span>${s[1].quality === "basic" ? ` <span class="st warn" title="Built while the free AI quota was low, so the design is simpler. Click ↻ New design later (quota resets daily) for a fuller one.">◐ basic – rebuild later</span>` : ""}${s[1].warnings?.length ? ` <span class="st warn" title="Please check before showing:\n• ${esc(s[1].warnings.join("\n• "))}">⚠ ${s[1].warnings.length} to check</span>` : ""}` : `<span class="sub">Not built</span>`;
      const pub = s && shareUrl(s[1]);
      const outdated = s && s[1].publishedUrl && s[1].publishedAt && s[1].builtAt > s[1].publishedAt;
      return `<tr data-id="${l.id}" class="${$("#preview").dataset.lead == l.id ? "cur" : ""}">
        <td><input type="checkbox" data-sel="${l.id}" ${selected.has(l.id) ? "checked" : ""}></td>
        <td><div class="nm">${esc(l.name)}</div><div class="sub"><span class="chip">${CAT_LABEL[l.category] || l.category}</span>${esc(l.locality || "")}${l.hasWebsite ? ` · <a href="${esc(l.website)}" target="_blank">has site</a>` : ""}</div></td>
        <td>${l.rating ? `${esc(l.rating)}★<div class="sub">${esc(l.reviews)}</div>` : "–"}</td>
        <td class="sub">${esc(l.phone)}</td>
        <td>${stHtml}${pub ? `<span class="link">🌐 <a href="${esc(pub)}" target="_blank" rel="noopener">${esc(pub.replace(/^https:\/\//, ""))}</a>${outdated ? ` <span class="st warn" title="Rebuilt after publishing – click Update link">· new version not live</span>` : ""}</span>` : ""}</td>
        <td><div class="acts">
          <button data-build="${l.id}" ${running ? "disabled" : ""}>${s ? "↻ New design" : "⚡ Build"}</button>
          ${s ? `<button class="ghost" data-view="${s[0]}" data-lead="${l.id}">View</button>` : ""}
          ${s && canPublish && !running ? `<button class="ghost" data-pub="${s[0]}">${s[1].publishedUrl ? (outdated ? "🌐 Update link" : "🌐 Re-publish") : "🌐 Publish"}</button>` : ""}
          ${pub ? (waDigits(l.phone) ? `<button class="wa" data-send="${l.id}" title="Open WhatsApp with the message and link">💬 Send</button>` : `<button class="ghost" disabled title="${esc(l.phone)} looks like a landline – call or SMS instead">💬 Landline</button>`) + `<button class="ghost" data-copy="${l.id}" title="Copy link">🔗</button>` : ""}
          ${s && canPublish ? `<details class="more-acts"><summary>⋯</summary><div class="menu">
            ${s[1].ownUrl ? `<button data-ownremove="${s[0]}">🗑 Remove own address</button>` : `<button data-own="${s[0]}">⭐ Give own address (${esc(s[0].slice(0, 22))}…pages.dev)</button>`}
            ${s[1].publishedUrl ? `<button data-unpub="${s[0]}">🗑 Unpublish demo link</button>` : ""}
            ${pub ? `<button data-copymsg="${l.id}">📋 Copy WhatsApp message</button>` : ""}
          </div></details>` : ""}
        </div></td></tr>`;
    }).join("");
    updateBulk();
  }

  function updateBulk() {
    const n = [...selected].filter((id) => visible().some((l) => l.id === id)).length;
    $("#btnBuildSel").textContent = `⚡ Build selected (${n})`;
    $("#btnBuildSel").disabled = !n || !!running;
    $("#btnBuildSel").hidden = !!running;
    $("#btnStop").hidden = !running;
    const pubN = [...selected].filter((id) => { const l = leads.find((x) => x.id === id); return l && visible().includes(l) && siteFor(l); }).length;
    $("#btnPubSel").textContent = `🌐 Publish selected (${pubN})`;
    $("#btnPubSel").disabled = !pubN || !!running || !canPublish;
    $("#btnPubSel").hidden = !canPublish;
  }

  // ---------- preview ----------
  async function showSite(slug, leadId) {
    const html = await (await fetch(`/sites/${slug}/index.html?ts=${Date.now()}`)).text();
    const f = $("#preview");
    f.dataset.lead = leadId ?? "";
    setPreview(f, html, false);
    const s = sites[slug] || {};
    $("#pvTitle").textContent = s.name || slug;
    Object.assign($("#pvOpen"), { href: `/sites/${slug}/`, hidden: false });
    Object.assign($("#pvEdit"), { href: `/?site=${encodeURIComponent(slug)}`, hidden: false });
    Object.assign($("#pvDownload"), { href: `/sites/${slug}/index.html`, download: `${slug}.html`, hidden: false });
    document.querySelectorAll("tr.cur").forEach((r) => r.classList.remove("cur"));
    document.querySelector(`tr[data-id="${leadId}"]`)?.classList.add("cur");
  }
  const log = (m) => { const l = $("#runlog"); l.hidden = false; const d = document.createElement("div"); d.textContent = m; l.append(d); l.scrollTop = l.scrollHeight; };

  // ---------- build ----------
  async function build(lead, signal) {
    const existing = siteFor(lead);
    const variant = existing ? (existing[1].variant || 0) + 1 : 0;
    status[lead.id] = { state: "run", msg: "⏳ Building…" }; render();
    $("#runlog").innerHTML = ""; log(`▶ ${lead.name}`);
    $("#pvTitle").textContent = `Building: ${lead.name}`;
    ["#pvOpen", "#pvEdit", "#pvDownload"].forEach((s) => ($(s).hidden = true));
    const f = $("#preview"); f.dataset.lead = lead.id;
    let html = "", last = 0, result = null;
    $("#debugLog").innerHTML = ""; $("#debugBox").hidden = true;
    const screen = SF.buildScreen(document.querySelector(".lp-right .canvas"), lead.name, {
      onProgress: (pct) => { status[lead.id].msg = `⏳ Building… ${pct}%`; const c = document.querySelector(`tr[data-id="${lead.id}"] .st.run`); if (c) c.textContent = status[lead.id].msg; },
    });
    try {
      await sse("/api/auto", { lead, variant }, {
        log: (e) => { log(e.msg); screen.log(e.msg); },
        debug: (e) => { const d = $("#debugLog"); $("#debugBox").hidden = false; const x = document.createElement("div"); x.textContent = e.msg; d.append(x); },
        stage: (e) => screen.stage(e.id),
        reset: () => { html = ""; },
        html: (e) => { html += e.text; screen.bytes(html.length, html); if (Date.now() - last > 2500) { last = Date.now(); setPreview(f, SF.partialHtml(html)); } },
        done: (e) => { result = e; },
        error: (e) => { throw new Error(e.error); },
      }, signal);
      if (!result) throw new Error("Build stopped");
      screen.done();
    } catch (e) { screen.fail(e.name === "AbortError" ? "Stopped" : e.message); throw e; }
    sites = await (await fetch("/api/sites")).json();
    status[lead.id] = { state: "ok", msg: result.engine === "ai" ? "✓ AI design" : "✓ Template" };
    await showSite(result.slug, lead.id);
    return result;
  }

  async function runQueue(list) {
    running = new AbortController();
    let done = 0;
    const setBar = () => { $("#barFill").style.width = `${(done / list.length) * 100}%`; $("#barText").textContent = `${done}/${list.length}`; };
    setBar(); render();
    for (const lead of list) {
      if (running.signal.aborted) break;
      try { await build(lead, running.signal); }
      catch (e) {
        status[lead.id] = { state: "err", msg: "✗ " + (e.name === "AbortError" ? "Stopped" : e.message).slice(0, 60) };
        log("✗ " + e.message);
        if (/limit is used up|limit reached/i.test(e.message)) { toast("Today's free AI limit is used up – stopping here. Try again later.", true); break; }
      }
      done++; setBar(); render();
      if (done < list.length && !running.signal.aborted) await new Promise((r) => setTimeout(r, 4000)); // be gentle with the free tier
    }
    running = null; render();
    toast(`Finished: ${done} of ${list.length}`);
  }

  // ---------- publish & share ----------
  async function publishCall(url, body, label) {
    $("#runlog").innerHTML = ""; log(`▶ ${label}`);
    let result = null;
    running = new AbortController(); render();
    try {
      await sse(url, body, { log: (e) => log(e.msg), done: (e) => { result = e; }, error: (e) => { throw new Error(e.error); } });
      sites = await (await fetch("/api/sites")).json();
    } catch (e) { log("✗ " + e.message); toast(e.message, true); }
    running = null; render();
    return result;
  }
  async function publishSlugs(slugs) {
    if (!slugs.length) return;
    const r = await publishCall("/api/publish", { slugs }, `Publishing ${slugs.length} demo(s)`);
    if (r) toast(`Live! ${slugs.length} demo link(s) ready – use 💬 Send`);
  }
  function leadById(id) { return leads.find((x) => x.id === +id); }
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); toast(`${what} copied`); }
    catch { prompt(`Copy the ${what.toLowerCase()}:`, text); }
  }

  // ---------- events ----------
  $("#btnLoad").onclick = async () => {
    const url = $("#sheetUrl").value.trim();
    if (!url) return toast("Paste your Google Sheet link", true);
    const b = $("#btnLoad"); b.disabled = true; b.textContent = "Loading…";
    try { const r = await api("/api/leads/load", { url }); leads = r.leads; sites = r.sites; save(); render(); toast(`${leads.length} leads loaded`); }
    catch (e) { toast(e.message, true); }
    b.disabled = false; b.textContent = "Load leads";
  };
  $("#csvFile").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await api("/api/leads/load", { csv: await file.text() }); leads = r.leads; sites = r.sites; save(); render(); toast(`${leads.length} leads loaded from CSV`); }
    catch (err) { toast(err.message, true); }
    e.target.value = "";
  };
  ["#fNoSite", "#fCat", "#fSearch"].forEach((s) => $(s).addEventListener("input", render));
  $("#selAll").onchange = (e) => { visible().forEach((l) => (e.target.checked ? selected.add(l.id) : selected.delete(l.id))); render(); };
  $("#rows").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.sel != null) { t.checked ? selected.add(+t.dataset.sel) : selected.delete(+t.dataset.sel); return updateBulk(); }
    if (t.dataset.build != null) { const l = leads.find((x) => x.id === +t.dataset.build); if (l) runQueue([l]); return; }
    if (t.dataset.view) return showSite(t.dataset.view, +t.dataset.lead);
    if (t.dataset.pub) return publishSlugs([t.dataset.pub]);
    if (t.dataset.unpub) { if (confirm("Take this demo link offline?")) publishCall("/api/publish/remove", { slugs: [t.dataset.unpub] }, "Unpublishing"); return; }
    if (t.dataset.own) return publishCall("/api/publish/own", { slug: t.dataset.own }, "Giving this demo its own address").then((r) => r && toast("Own address ready: " + r.url));
    if (t.dataset.ownremove) { if (confirm("Delete this demo's own address?")) publishCall("/api/publish/own/remove", { slug: t.dataset.ownremove }, "Removing own address"); return; }
    if (t.dataset.send || t.dataset.copy || t.dataset.copymsg) {
      const l = leadById(t.dataset.send || t.dataset.copy || t.dataset.copymsg); const s = l && siteFor(l); const link = s && shareUrl(s[1]);
      if (!link) return;
      if (t.dataset.copy) return copy(link, "Link");
      if (t.dataset.copymsg) return copy(message(l, link), "Message");
      window.open(`https://wa.me/${waDigits(l.phone)}?text=${encodeURIComponent(message(l, link))}`, "_blank", "noopener");
      return;
    }
    const tr = t.closest("tr[data-id]");
    if (tr && !t.closest("a,button,input")) { const l = leads.find((x) => x.id === +tr.dataset.id); const s = l && siteFor(l); if (s) showSite(s[0], l.id); }
  });
  $("#btnBuildSel").onclick = () => runQueue(visible().filter((l) => selected.has(l.id)));
  $("#btnStop").onclick = () => running?.abort();
  $("#btnPubSel").onclick = () => publishSlugs([...new Set([...selected].map((id) => { const l = leadById(id); return l && visible().includes(l) && siteFor(l)?.[0]; }).filter(Boolean))]);
  $("#btnSite").onclick = async () => {
    if (!canPublish) return toast("Add your Cloudflare token to .env first (see README)", true);
    const r = await publishCall("/api/publish/site", {}, "Publishing the PinPage site");
    if (r) { toast("PinPage site live: " + r.url); window.open(r.url, "_blank", "noopener"); }
  };
  $("#msgTpl").addEventListener("input", () => { try { localStorage.setItem(TPL_KEY, $("#msgTpl").value); } catch { /* ignore */ } });
  $("#msgReset").onclick = (e) => { e.preventDefault(); $("#msgTpl").value = DEFAULT_TPL; try { localStorage.removeItem(TPL_KEY); } catch { /* ignore */ } };
  $("#btnExport").onclick = () => {
    const origin = location.origin;
    const head = ["Business Name", "Category", "Phone", "Rating", "Reviews", "Address", "Google Maps URL", "Demo URL", "Live?", "WhatsApp message link", "Design"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = leads.map((l) => {
      const s = siteFor(l); const live = s && shareUrl(s[1]);
      const link = live || (s ? `${origin}/sites/${s[0]}/` : "");
      const wa = live && waDigits(l.phone) ? `https://wa.me/${waDigits(l.phone)}?text=${encodeURIComponent(message(l, live))}` : "";
      return [l.name, l.category, l.phone, l.rating, l.reviews, l.address, l.mapsUrl, link, live ? "yes" : s ? "local only" : "", wa, s ? s[1].engine : ""].map(q).join(",");
    });
    download("leads-with-demos.csv", [head.map(q).join(","), ...lines].join("\n"), "text/csv");
  };
  deviceSwitcher($("#device"), $("#frameWrap"));

  // ---------- boot ----------
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s) { $("#sheetUrl").value = s.url || ""; leads = s.leads || []; } } catch { /* ignore */ }
  try { $("#msgTpl").value = localStorage.getItem(TPL_KEY) || DEFAULT_TPL; } catch { $("#msgTpl").value = DEFAULT_TPL; }
  document.addEventListener("click", (e) => { document.querySelectorAll(".more-acts[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
  fetch("/api/publish/status").then((r) => r.json()).then((p) => { canPublish = p.configured; $("#pubNote").hidden = p.configured; render(); }).catch(() => {});
  fetch("/api/sites").then((r) => r.json()).then((s) => { sites = s; render(); });
  fetch("/api/status").then((r) => r.json()).then((s) => { if (!s.ai) toast("No AI key: demos will use the quick template. Start with GEMINI_API_KEY for unique AI designs.", true); });
  render();
})();
