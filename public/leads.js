/* Leads page: sheet → table → one-click / bulk demo websites. */
(() => {
  const { $, toast, api, sse, setPreview, download, deviceSwitcher } = SF;
  const LS = "siteforge.leads.v1";
  let leads = [];
  let sites = {};
  let selected = new Set();
  let running = null; // AbortController while a bulk run is active
  const status = {}; // lead.id -> { state, msg }

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
        : s ? `<span class="st ok">✓ ${s[1].engine === "ai" ? "AI design" : "Template"}</span>${s[1].warnings?.length ? ` <span class="st warn" title="Please check before showing:\n• ${esc(s[1].warnings.join("\n• "))}">⚠ ${s[1].warnings.length} to check</span>` : ""}` : `<span class="sub">Not built</span>`;
      return `<tr data-id="${l.id}" class="${$("#preview").dataset.lead == l.id ? "cur" : ""}">
        <td><input type="checkbox" data-sel="${l.id}" ${selected.has(l.id) ? "checked" : ""}></td>
        <td><div class="nm">${esc(l.name)}</div><div class="sub"><span class="chip">${CAT_LABEL[l.category] || l.category}</span>${esc(l.locality || "")}${l.hasWebsite ? ` · <a href="${esc(l.website)}" target="_blank">has site</a>` : ""}</div></td>
        <td>${l.rating ? `${esc(l.rating)}★<div class="sub">${esc(l.reviews)}</div>` : "–"}</td>
        <td class="sub">${esc(l.phone)}</td>
        <td>${stHtml}</td>
        <td><div class="acts">
          <button data-build="${l.id}" ${running ? "disabled" : ""}>${s ? "↻ New design" : "⚡ Build"}</button>
          ${s ? `<button class="ghost" data-view="${s[0]}" data-lead="${l.id}">View</button>` : ""}
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
    await sse("/api/auto", { lead, variant }, {
      log: (e) => { log(e.msg); status[lead.id].msg = "⏳ " + e.msg.replace(/^\S+\s/, "").slice(0, 28); render(); },
      reset: () => { html = ""; },
      html: (e) => { html += e.text; if (Date.now() - last > 2500) { last = Date.now(); setPreview(f, SF.partialHtml(html)); } },
      done: (e) => { result = e; },
      error: (e) => { throw new Error(e.error); },
    }, signal);
    if (!result) throw new Error("Build stopped");
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
        if (/limit reached/i.test(e.message)) { toast("Gemini free limit reached – stopping. Try again later.", true); break; }
      }
      done++; setBar(); render();
      if (done < list.length && !running.signal.aborted) await new Promise((r) => setTimeout(r, 4000)); // be gentle with the free tier
    }
    running = null; render();
    toast(`Finished: ${done} of ${list.length}`);
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
    const tr = t.closest("tr[data-id]");
    if (tr && !t.closest("a,button,input")) { const l = leads.find((x) => x.id === +tr.dataset.id); const s = l && siteFor(l); if (s) showSite(s[0], l.id); }
  });
  $("#btnBuildSel").onclick = () => runQueue(visible().filter((l) => selected.has(l.id)));
  $("#btnStop").onclick = () => running?.abort();
  $("#btnExport").onclick = () => {
    const origin = location.origin;
    const head = ["Business Name", "Category", "Phone", "Rating", "Reviews", "Address", "Google Maps URL", "Demo URL", "Design"];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = leads.map((l) => { const s = siteFor(l); return [l.name, l.category, l.phone, l.rating, l.reviews, l.address, l.mapsUrl, s ? `${origin}/sites/${s[0]}/` : "", s ? s[1].engine : ""].map(q).join(","); });
    download("leads-with-demos.csv", [head.map(q).join(","), ...lines].join("\n"), "text/csv");
  };
  deviceSwitcher($("#device"), $("#frameWrap"));

  // ---------- boot ----------
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s) { $("#sheetUrl").value = s.url || ""; leads = s.leads || []; } } catch { /* ignore */ }
  fetch("/api/sites").then((r) => r.json()).then((s) => { sites = s; render(); });
  fetch("/api/status").then((r) => r.json()).then((s) => { if (!s.ai) toast("No AI key: demos will use the quick template. Start with GEMINI_API_KEY for unique AI designs.", true); });
  render();
})();
