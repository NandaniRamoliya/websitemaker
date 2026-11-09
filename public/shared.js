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

  return { $, toast, api, sse, guardPreview, partialHtml, setPreview, download, deviceSwitcher };
})();
