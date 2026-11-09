// "Site doctor": makes every generated website behave perfectly, whatever the AI wrote.
// Applied to AI designs and template sites before they are saved or downloaded.

/** HTML-level fixes. */
export function staticFixes(html) {
  let h = html;
  // External links (WhatsApp, Maps, Instagram…) must open in a new tab – never replace the website.
  h = h.replace(/<a\b([^>]*?)\bhref=(["'])(https?:\/\/[^"']*)\2([^>]*)>/gi, (m, pre, q, url, post) => {
    if (/\btarget\s*=/.test(pre + post)) return m.replace(/\btarget=(["'])_self\1/i, 'target="_blank"');
    return `<a${pre}href=${q}${url}${q} target="_blank" rel="noopener"${post}>`;
  });
  // Empty links go to the top instead of doing nothing.
  h = h.replace(/<a\b([^>]*?)\bhref=(["'])#?\2/gi, '<a$1href=$2#top$2 data-sf-top');
  // A target for "#top".
  if (!/\bid=["']top["']/i.test(h)) h = h.replace(/<body([^>]*)>/i, '<body$1><span id="top" style="position:absolute;top:0"></span>');
  return h;
}

/** Runtime fixes (works on any layout). cfg: { whatsapp, phone, email, name } */
export function doctorScript(cfg = {}) {
  const c = JSON.stringify({ wa: String(cfg.whatsapp || "").replace(/\D/g, ""), tel: String(cfg.phone || "").replace(/[^\d+]/g, ""), email: cfg.email || "", name: cfg.name || "" }).replace(/</g, "\\u003c");
  return `<style data-sf-doctor>
html{scroll-behavior:smooth}
html,body{overflow-x:hidden;max-width:100%}
img{max-width:100%}
@media (max-width:700px){footer a{display:inline-block;padding:6px 0;min-height:32px}}
</style>
<script data-sf-doctor>(function(){
var C=${c};
function headerH(){var best=0;document.querySelectorAll('header,nav,[class*=header],[class*=navbar]').forEach(function(el){var cs=getComputedStyle(el);if((cs.position==='fixed'||cs.position==='sticky')&&el.getBoundingClientRect().top<=1){var h=el.getBoundingClientRect().height;if(h<220&&h>best)best=h;}});return best;}
function setPad(){document.documentElement.style.scrollPaddingTop=(headerH()+12)+'px';}
var KEYS={about:['about','story','who','welcome'],services:['service','treatment','therap','menu','collection','product','offer','packages'],gallery:['gallery','portfolio','lookbook','photos','work'],faq:['faq','question'],contact:['contact','visit','location','find','book','reach','appointment'],reviews:['review','testimonial','love','say'],why:['why','choose','highlight','feature','standard']};
function resolve(id){id=decodeURIComponent(id||'');if(!id||id==='top')return document.getElementById('top')||document.body;var el=document.getElementById(id)||document.querySelector('[name="'+id+'"]');if(el)return el;var low=id.toLowerCase();var secs=[].slice.call(document.querySelectorAll('section[id],div[id],footer[id]'));for(var k in KEYS){if(KEYS[k].some(function(w){return low.indexOf(w)>=0;})){var m=secs.filter(function(s){var t=(s.id+' '+(s.className||'')).toLowerCase();return KEYS[k].some(function(w){return t.indexOf(w)>=0;});})[0];if(m)return m;}}return document.getElementById('contact')||secs.filter(function(s){return /contact|location|visit/i.test(s.id);})[0]||null;}
function closeMenus(){['open','active','show','is-open','is-active','menu-open','nav-open','visible','toggled','expanded'].forEach(function(cl){document.querySelectorAll('nav.'+cl+',header .'+cl+',[class*=mobile].'+cl+',[class*=menu].'+cl+',[class*=drawer].'+cl+',[class*=nav].'+cl).forEach(function(el){if(el.closest('[class*=faq],[class*=accordion]'))return;var p=getComputedStyle(el).position;if(el.closest('header,nav')||p==='fixed'||p==='absolute')el.classList.remove(cl);});document.body.classList.remove(cl);document.documentElement.classList.remove(cl);});document.querySelectorAll('[aria-expanded="true"]').forEach(function(b){if(b.closest('header,nav')||/menu|nav|burger|toggle/i.test(b.className+b.getAttribute('aria-label')))b.setAttribute('aria-expanded','false');});if(document.body.style.overflow==='hidden')document.body.style.overflow='';if(document.documentElement.style.overflow==='hidden')document.documentElement.style.overflow='';}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)!=='#')return;if(a.hasAttribute('data-sf-top')&&e.defaultPrevented)return;setPad();setTimeout(closeMenus,30);var id=decodeURIComponent(h.slice(1));
// Section exists: let the browser / the site's own code scroll (scroll-padding keeps it below the header).
if(id&&document.getElementById(id))return;
// Missing section (or #top): scroll to the best match ourselves.
var t=resolve(id);if(!t||e.defaultPrevented)return;e.preventDefault();var y=(t===document.body||id==='top'||id==='')?0:t.getBoundingClientRect().top+scrollY-headerH()-12;window.scrollTo({top:Math.max(0,y),behavior:'smooth'});},false);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus();});
// Forms: send the enquiry to the owner's WhatsApp (or email) – no server needed.
document.addEventListener('submit',function(e){var f=e.target;if(f.getAttribute('data-to'))return;var act=f.getAttribute('action')||'';if(act&&act!=='#'&&!/^javascript/i.test(act))return;e.preventDefault();var lines=[];[].forEach.call(f.elements,function(el){if(!el.name&&!el.id&&!el.placeholder)return;if(/submit|button|hidden/.test(el.type)||!el.value)return;if((el.type==='checkbox'||el.type==='radio')&&!el.checked)return;var lab=(f.querySelector('label[for="'+el.id+'"]')||{}).innerText||el.placeholder||el.name||el.id;lines.push(lab.replace(/[*:]/g,'').trim()+': '+el.value);});var msg='Hello '+C.name+', I found your website.\\n'+lines.join('\\n');if(C.wa)window.open('https://wa.me/'+C.wa+'?text='+encodeURIComponent(msg),'_blank');else if(C.email)location.href='mailto:'+C.email+'?subject='+encodeURIComponent('Website enquiry')+'&body='+encodeURIComponent(msg);else if(C.tel)location.href='tel:'+C.tel;var b=f.querySelector('[type=submit],button');if(b){b.textContent='✓ Opening WhatsApp…';}},false);
// Broken images: hide them instead of showing an icon.
document.addEventListener('error',function(e){var i=e.target;if(i&&i.tagName==='IMG'){i.style.visibility='hidden';}},true);
// Phones: give small text links/buttons a comfortable 40px tap area.
function tapTargets(){if(innerWidth>760)return;document.querySelectorAll('a,button').forEach(function(el){if(el.dataset.sfTap||el.closest('nav,[class*=menu],[class*=drawer]'))return;var cs=getComputedStyle(el);if(cs.display==='inline'||cs.position==='fixed')return;var r=el.getBoundingClientRect();if(r.height>0&&r.height<36&&(el.innerText||'').trim().length>2){var add=Math.ceil((40-r.height)/2);el.style.paddingTop=(parseFloat(cs.paddingTop)+add)+'px';el.style.paddingBottom=(parseFloat(cs.paddingBottom)+add)+'px';el.dataset.sfTap='1';}});}
// Phones: if the design has no working menu button, add one built from the page's own sections.
function ensureMenu(){if(innerWidth>760||document.getElementById('sf-menu-btn'))return;var hdr=document.querySelector('header');if(!hdr){[].some.call(document.body.children,function(el){var cs=getComputedStyle(el);if((cs.position==='fixed'||cs.position==='sticky')&&el.getBoundingClientRect().top<=1&&el.offsetHeight<160){hdr=el;return true;}});}if(!hdr)return;
var hasToggle=[].some.call(hdr.querySelectorAll('button,[aria-label],[class*=burger],[class*=hamburger],[class*=menu-toggle],[class*=menu-btn],[class*=nav-toggle]'),function(b){var r=b.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(b).visibility!=='hidden'&&/menu|nav|burger|hamburger|toggle|☰/i.test((b.className||'')+' '+(b.getAttribute('aria-label')||'')+' '+(b.innerText||''));});if(hasToggle)return;
var links=[].filter.call(hdr.querySelectorAll('a[href^="#"]'),function(a){return a.getAttribute('href').length>1&&a.getAttribute('href')!=='#top'&&(a.innerText||'').trim();});var visible=links.filter(function(a){var r=a.getBoundingClientRect();return r.width>0&&r.right<=innerWidth;});if(links.length>=2&&visible.length===links.length&&visible.length<=4)return;
var items=links.map(function(a){return [a.getAttribute('href'),(a.innerText||'').trim()];});if(items.length<2){items=[].map.call(document.querySelectorAll('section[id],div[id]'),function(s){var h=s.querySelector('h2,h3');return h&&s.offsetHeight>150?['#'+s.id,(h.innerText||'').trim().slice(0,32)]:null;}).filter(Boolean).slice(0,8);}if(items.length<2)return;
if(getComputedStyle(hdr).position==='static')hdr.style.position='relative';
var col=getComputedStyle(hdr).color;var btn=document.createElement('button');btn.id='sf-menu-btn';btn.setAttribute('aria-label','Open menu');btn.setAttribute('aria-expanded','false');btn.innerHTML='&#9776;';btn.style.cssText='position:absolute;right:14px;top:50%;transform:translateY(-50%);width:44px;height:44px;border:0;border-radius:10px;background:rgba(127,127,127,.12);color:'+col+';font-size:22px;line-height:1;cursor:pointer;z-index:1001';
var panel=document.createElement('nav');panel.id='sf-menu';panel.style.cssText='position:fixed;left:12px;right:12px;top:'+(hdr.getBoundingClientRect().bottom+8)+'px;background:#fff;color:#111;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);padding:8px;z-index:1000;display:none;font:600 16px/1.3 system-ui,sans-serif';
items.forEach(function(it){var a=document.createElement('a');a.href=it[0];a.textContent=it[1];a.style.cssText='display:block;padding:14px 16px;border-radius:10px;color:inherit;text-decoration:none';panel.appendChild(a);});
function setOpen(o){panel.style.display=o?'block':'none';btn.setAttribute('aria-expanded',o?'true':'false');btn.innerHTML=o?'&#10005;':'&#9776;';if(o)panel.style.top=(hdr.getBoundingClientRect().bottom+8)+'px';}
btn.addEventListener('click',function(e){e.stopPropagation();setOpen(panel.style.display==='none');});panel.addEventListener('click',function(e){if(e.target.closest('a'))setTimeout(function(){setOpen(false);},10);});document.addEventListener('click',function(e){if(!panel.contains(e.target)&&e.target!==btn)setOpen(false);});
hdr.appendChild(btn);document.body.appendChild(panel);
// hide a nav that overflows the phone screen (the new menu replaces it)
links.forEach(function(a){var r=a.getBoundingClientRect();if(r.right>innerWidth||r.width===0){var ul=a.closest('ul,nav,div');if(ul&&ul!==hdr)ul.style.display='none';}});}
function boot(){setPad();tapTargets();ensureMenu();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
addEventListener('resize',setPad);addEventListener('load',setPad);
// Scroll animations that never fired (script error, or a fast flick skipped them): anything that has
// been on screen for 0.7s but is still invisible gets shown.
var SEL='[class*=reveal],[class*=fade],[class*=animate],[class*=aos],[data-aos],[class*=appear],[class*=slide-up],[style*="opacity: 0"],[style*="opacity:0"]';
function rescue(){document.querySelectorAll(SEL).forEach(function(el){if(el.dataset.sfSeen||el.closest('nav,[hidden],[class*=modal],[class*=lightbox],[class*=menu],[class*=drawer],[class*=overlay],[class*=tooltip]'))return;var r=el.getBoundingClientRect();if(r.width&&r.bottom>0&&r.top<innerHeight&&getComputedStyle(el).opacity==='0'){el.dataset.sfSeen='1';setTimeout(function(){if(getComputedStyle(el).opacity==='0'){el.style.opacity='1';el.style.transform='none';}},700);}});}
var rt;addEventListener('scroll',function(){clearTimeout(rt);rt=setTimeout(rescue,150);},{passive:true});setTimeout(rescue,2500);
})();</script>`;
}

/** Apply everything. */
export function heal(html, data = {}) {
  let h = staticFixes(html);
  const script = doctorScript({ whatsapp: data.contact?.whatsapp, phone: data.contact?.phone, email: data.contact?.email, name: data.brand?.name });
  h = h.replace(/<style data-sf-doctor>[\s\S]*?<\/script>/, ""); // idempotent
  h = /<\/body>(?![\s\S]*<\/body>)/i.test(h) ? h.replace(/<\/body>(?![\s\S]*<\/body>)/i, script + "</body>") : h + script;
  return h;
}
