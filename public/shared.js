/* Helpers shared by the editor and the leads page. */
window.SF = (() => {
  const $ = (s, r = document) => r.querySelector(s);

  function toast(msg, err = false) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = "toast"), 4000);
  }

  async function api(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }

  /** POST + read Server-Sent Events. handlers: { eventName: fn(data) } */
  async function sse(url, body, handlers, signal) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
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
        if (ev && data) await handlers[ev]?.(JSON.parse(data));
      }
    }
  }

  // Inside the preview iframe, keep #anchor links scrolling in place and open every other link in a
  // new tab. Without this, a link like href="/" or "index.html" loaded the editor itself inside the preview.
  const GUARD = `<script data-sf-guard>(function(){document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){e.preventDefault();if(h.length>1){var t=document.getElementById(decodeURIComponent(h.slice(1)))||document.querySelector('[name="'+h.slice(1)+'"]');if(t)t.scrollIntoView({behavior:'smooth'});}else{window.scrollTo({top:0,behavior:'smooth'});}return;}if(/^(javascript:|$)/i.test(h))return;e.preventDefault();if(/^(tel:|mailto:|sms:)/i.test(h)){window.top.location.href=h;return;}window.open(a.href,'_blank','noopener');},true);document.addEventListener('submit',function(e){var f=e.target;if(f.getAttribute('data-to'))return;e.preventDefault();alert('Forms are disabled in the preview – they work on the published site.');},true);})();<\/script>`;
  function guardPreview(html) {
    if (!html) return html;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, GUARD + "</body>") : html + GUARD;
  }

  /** While a page is still streaming, drop a trailing unfinished <script> so it doesn't throw. */
  function partialHtml(html) {
    const open = html.lastIndexOf("<script"), close = html.lastIndexOf("</script>");
    return open > close ? html.slice(0, open) : html;
  }

  function setPreview(iframe, html, keepScroll = true) {
    const y = keepScroll ? iframe.contentWindow?.scrollY || 0 : 0;
    iframe.srcdoc = guardPreview(html);
    iframe.onload = () => { try { iframe.contentWindow.scrollTo(0, y); } catch { /* ignore */ } };
  }

  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.append(a); a.click(); a.remove();
  }

  function deviceSwitcher(seg, wrap) {
    seg.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      [...seg.children].forEach((x) => x.classList.toggle("on", x === b));
      wrap.style.width = b.dataset.v;
    };
  }

  // ---------------- Build screen: a friendly, animated progress view over the preview ----------------
  const STAGES = [
    ["facts", "Reading the Google Maps listing", 4, 12],
    ["content", "Writing the website content", 12, 30],
    ["design", "Designing a unique website", 30, 86],
    ["quality", "Checking every link & button", 86, 96],
    ["save", "Saving your website", 96, 100],
  ];
  const TIPS = [
    "Every design is made fresh for this business. No two sites look the same.",
    "WhatsApp, click-to-call and directions are added automatically.",
    "Every link, menu and button is tested before you see it.",
    "Facts like hours or prices are never invented. Add them later in one click.",
    "Tip: the sticky Call · WhatsApp · Directions bar appears on phones.",
  ];
  function buildScreen(host, name, { onProgress } = {}) {
    host.querySelector(".bs")?.remove();
    const el = document.createElement("div");
    el.className = "bs";
    el.innerHTML = `<div class="bs-card">
      <div class="bs-glow"></div>
      <div class="bs-skel"><i class="h"></i><i class="hero"></i><div class="row"><i></i><i></i><i></i></div></div>
      <div class="bs-body">
        <div class="bs-kicker">Building website</div>
        <h3 class="bs-title"></h3>
        <ol class="bs-steps">${STAGES.map(([id, label]) => `<li data-id="${id}"><span class="dot"></span>${label}</li>`).join("")}</ol>
        <div class="bs-bar"><i></i></div>
        <div class="bs-foot"><span class="bs-msg">Starting…</span><b class="bs-pct">0%</b></div>
        <p class="bs-tip"></p>
      </div></div>
      <div class="bs-mini"><span class="spin"></span><span class="bs-mini-txt">Designing…</span><b class="bs-mini-pct">0%</b></div>`;
    el.querySelector(".bs-title").textContent = name || "Your website";
    host.append(el);
    let current = -1, pct = 0, tipI = Math.floor(Math.random() * TIPS.length), creep;
    const tip = el.querySelector(".bs-tip");
    const showTip = () => { tip.textContent = TIPS[tipI++ % TIPS.length]; };
    showTip();
    const tipTimer = setInterval(showTip, 6000);
    const set = (p) => {
      pct = Math.max(pct, Math.min(100, p));
      el.querySelector(".bs-bar i").style.width = pct + "%";
      el.querySelector(".bs-pct").textContent = Math.round(pct) + "%";
      el.querySelector(".bs-mini-pct").textContent = Math.round(pct) + "%";
      onProgress?.(Math.round(pct), STAGES[Math.max(0, current)][1]);
    };
    const api = {
      stage(id) {
        const i = STAGES.findIndex((s) => s[0] === id);
        if (i < 0 || i < current) return;
        current = i;
        el.querySelectorAll(".bs-steps li").forEach((li, k) => { li.classList.toggle("done", k < i); li.classList.toggle("on", k === i); });
        el.querySelector(".bs-mini-txt").textContent = STAGES[i][1] + "…";
        set(STAGES[i][2]);
        // gentle creep so the bar never looks stuck
        clearInterval(creep);
        creep = setInterval(() => { const [, , a, b] = STAGES[current]; if (pct < b - 2) set(pct + (b - pct) * 0.03); }, 900);
      },
      bytes(n, html) { // design stage: map streamed size to progress; reveal the live site once real content exists
        if (current < 2) api.stage("design");
        const [, , a, b] = STAGES[2];
        set(a + (b - a) * Math.min(1, n / 48000));
        const body = html ? html.search(/<body[\s>]/i) : -1;
        if (body > 0 && html.length - body > 6000) el.classList.add("mini");
      },
      log(msg) { el.querySelector(".bs-msg").textContent = msg.replace(/^[^\p{L}\p{N}]+/u, ""); },
      done() {
        clearInterval(creep); clearInterval(tipTimer);
        el.querySelectorAll(".bs-steps li").forEach((li) => { li.classList.remove("on"); li.classList.add("done"); });
        set(100);
        el.classList.add("finished");
        el.querySelector(".bs-mini-txt").textContent = "Ready";
        setTimeout(() => el.classList.add("out"), 900);
        setTimeout(() => el.remove(), 1500);
      },
      fail(msg) {
        clearInterval(creep); clearInterval(tipTimer);
        el.classList.remove("mini"); el.classList.add("failed");
        el.querySelector(".bs-kicker").textContent = "Couldn't finish";
        el.querySelector(".bs-msg").textContent = msg;
        tip.innerHTML = "";
        const b = document.createElement("button"); b.className = "ghost sm"; b.textContent = "Close"; b.onclick = () => el.remove();
        tip.append(b);
      },
      remove() { clearInterval(creep); clearInterval(tipTimer); el.remove(); },
    };
    return api;
  }

  return { $, toast, api, sse, guardPreview, partialHtml, setPreview, download, deviceSwitcher, buildScreen };
})();
