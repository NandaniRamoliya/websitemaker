// Business-type presets: verified free stock photos (Unsplash licence), typical services,
// and several visual directions per type so every generated demo looks different.
const u = (id, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

export const CATEGORIES = {
  jewellery: {
    label: "Jewellery showroom",
    match: /jewel|jewell|gold|diamond|ornament|silver/i,
    photos: ["photo-1601121141461-9d6647bca1ed", "photo-1599643478518-a784e5dc4c8f", "photo-1611591437281-460bfbe1220a", "photo-1515562141207-7a88fb7ce338", "photo-1602173574767-37ac01994b2a", "photo-1535632066927-ab7c9ab60908", "photo-1617038220319-276d3cfab638", "photo-1573408301185-9146fe634ad0"],
    services: ["Bridal jewellery collections", "Gold necklaces & sets", "Diamond rings & earrings", "Custom & made-to-order designs", "Old gold exchange", "Silver & daily-wear jewellery"],
    styles: [
      "Royal heritage luxury: deep maroon and antique gold, ornate serif headings (Cormorant Garamond / Playfair), thin gold dividers, full-bleed hero photo",
      "Modern minimal luxury: ivory background, black text, champagne-gold accents, huge editorial serif headline, asymmetric image grid",
      "Dark glamour: near-black background, glowing gold gradients, glassmorphism cards, spotlight hero with a centred product photo",
    ],
  },
  spa: {
    label: "Spa & wellness",
    match: /spa|massage|wellness|therapy|ayurved/i,
    photos: ["photo-1544161515-4ab6ce6db874", "photo-1540555700478-4be289fbecef", "photo-1600334089648-b0d9d3028eb2", "photo-1519823551278-64ac92734fb1", "photo-1570172619644-dfd03ed5d881", "photo-1515377905703-c4788e51af15"],
    services: ["Swedish massage", "Deep tissue massage", "Aromatherapy", "Hot stone therapy", "Body scrub & polish", "Couple spa packages"],
    styles: [
      "Calm organic: sage green and sand beige, rounded shapes, soft serif + clean sans, lots of whitespace, gentle fade animations",
      "Resort luxury: deep teal and warm gold, full-screen hero photo with overlay, elegant thin serif headlines, card-based therapy menu",
      "Zen minimal: off-white with charcoal and a single terracotta accent, Japanese-inspired asymmetry, large photos with captions",
    ],
  },
  clinic: {
    label: "Clinic & healthcare",
    match: /clinic|treatment|doctor|hospital|consult|skin|derma|physio|health|homeo|ortho/i,
    photos: ["photo-1576091160399-112ba8d25d1d", "photo-1631217868264-e5b90bb7e133", "photo-1505751172876-fa1923c5c528", "photo-1519494026892-80bbd2d6fd0d"],
    services: ["General consultation", "Diagnosis & treatment plans", "Follow-up care", "Preventive health check-ups", "Specialist referrals", "Online appointment booking"],
    styles: [
      "Trustworthy medical: white and calm medical blue, clean sans (Inter/Manrope), icon-led feature cards, clear 'Book appointment' CTA everywhere",
      "Warm care: soft mint and navy, rounded friendly UI, split hero with photo and a floating appointment card, trust badges with rating",
      "Premium clinic: deep navy with aqua accents, modern geometric layout, bento grid for treatments, sticky booking bar on mobile",
    ],
  },
  dental: {
    label: "Dental clinic",
    match: /dental|dentist|teeth|tooth|implant|orthodon/i,
    photos: ["photo-1629909613654-28e377c37b09", "photo-1606811971618-4486d14f3f99", "photo-1588776814546-1ffcf47267a5", "photo-1609840114035-3c981b782dfe"],
    services: ["Dental implants", "Root canal treatment", "Teeth whitening", "Braces & clear aligners", "Cosmetic smile design", "Scaling & cleaning"],
    styles: [
      "Bright smile: white with fresh teal and a sunny yellow accent, friendly rounded sans, big smiling hero, before/after style sections",
      "Clinical premium: navy and ice-blue, crisp geometric layout, treatment cards with icons, prominent rating badge",
      "Modern boutique: soft lavender-grey with deep plum accents, elegant serif headings, calm photography-led layout",
    ],
  },
  restaurant: {
    label: "Restaurant & café",
    match: /food|menu|restaurant|cafe|café|dine|kitchen|dhaba|bakery|sweet|table reserv/i,
    photos: ["photo-1517248135467-4c7edcad34c4", "photo-1585937421612-70a008356fbe", "photo-1601050690597-df0568f70950", "photo-1546833999-b9f581a1996d", "photo-1414235077428-338989a2e8c0", "photo-1504674900247-0877df9cc836", "photo-1555396273-367ea4eb4db5"],
    services: ["Signature dishes", "Family dining", "Party & group orders", "Takeaway & home delivery", "Table reservations", "Seasonal specials"],
    styles: [
      "Warm Indian dining: saffron, deep red and cream, decorative pattern accents, bold display serif, appetising full-bleed food hero",
      "Modern bistro: charcoal and mustard, big bold sans headlines, menu laid out like a printed card, playful hover effects",
      "Street-food vibrant: bright colours (tomato red, turmeric yellow, mint), chunky rounded type, sticker-like badges, energetic layout",
    ],
  },
  salon: {
    label: "Salon & beauty",
    match: /salon|hair|beauty|parlour|parlor|barber|groom|unisex|balayage/i,
    photos: ["photo-1560066984-138dadb4c035", "photo-1521590832167-7bcbfaa6381f", "photo-1633681926022-84c23e8cb2d6", "photo-1522337360788-8b13dee7a37e", "photo-1562322140-8baeececf3df", "photo-1595476108010-b4d1f102b1b1"],
    services: ["Haircut & styling", "Hair colour & balayage", "Keratin & smoothening", "Facials & clean-ups", "Manicure & pedicure", "Bridal & party makeup"],
    styles: [
      "Chic fashion editorial: black, white and blush pink, oversized serif headlines, magazine-style asymmetric photo collage",
      "Bold modern: deep charcoal with neon-coral accents, strong sans typography, diagonal sections, price-list style service menu",
      "Soft glam: rose-gold and nude tones, elegant script-accent headings, rounded cards, dreamy gradient backgrounds",
    ],
  },
  makeup: {
    label: "Bridal makeup studio",
    match: /bridal|makeup|make-up|mehndi|mua/i,
    photos: ["photo-1487412947147-5cebf100ffc2", "photo-1512496015851-a90fb38ba796", "photo-1457972729786-0411a3b2b626", "photo-1596462502278-27bfdc403348"],
    services: ["Bridal makeup", "Engagement & reception looks", "Party makeup", "HD & airbrush makeup", "Hairstyling & draping", "Pre-bridal packages"],
    styles: [
      "Bridal luxe: ivory, blush and gold, romantic serif headlines, portfolio-first layout with large portraits",
      "Contemporary artist: monochrome with a single rouge-red accent, bold editorial type, grid portfolio with hover zoom",
      "Festive elegance: deep wine and rose-gold, ornamental dividers, warm glowing gradients",
    ],
  },
  nails: {
    label: "Nail studio",
    match: /nail/i,
    photos: ["photo-1604654894610-df63bc536371", "photo-1519014816548-bf5fe059798b", "photo-1457972729786-0411a3b2b626"],
    services: ["Gel & acrylic extensions", "Nail art designs", "Manicure", "Pedicure", "Nail repair & refills", "Bridal nail packages"],
    styles: [
      "Playful pastel: lilac, mint and peach, rounded bubbly type, sticker badges, colourful gallery grid",
      "Luxe minimal: black and nude with gold foil accents, refined serif, large close-up photos",
    ],
  },
  banquet: {
    label: "Banquet & events",
    match: /banquet|event|wedding|party hall|lawn|marriage|catering/i,
    photos: ["photo-1519167758481-83f550bb49b3", "photo-1464366400600-7168b8af9bc3", "photo-1511795409834-ef04bbd61622"],
    services: ["Wedding receptions", "Engagement ceremonies", "Birthday & anniversary parties", "Corporate events", "In-house catering", "Decor & lighting"],
    styles: [
      "Grand celebration: royal blue and gold, ornate serif, full-screen venue hero, capacity stats band",
      "Elegant white: white, champagne and sage, airy layout, large venue photography, timeline of event packages",
    ],
  },
  general: {
    label: "Local business",
    match: /.*/,
    photos: [],
    services: [],
    styles: [
      "Clean professional: white with a confident brand colour, modern sans, split hero, icon feature cards",
      "Bold local brand: strong colour blocks, big friendly headlines, photo-led sections",
    ],
  },
};

// Most specific first (a "dental clinic" is dental, not a generic clinic).
const PRIORITY = ["dental", "nails", "makeup", "banquet", "jewellery", "spa", "restaurant", "salon", "clinic"];
export function detectCategory(...texts) {
  const t = texts.filter(Boolean).join(" ").normalize("NFKC");
  // Name first (it is usually the strongest signal), then everything else.
  for (const key of PRIORITY) if (CATEGORIES[key].match.test(texts[texts.length - 1]?.normalize("NFKC") || "")) return key;
  for (const key of PRIORITY) if (CATEGORIES[key].match.test(t)) return key;
  return "general";
}

// Deterministic per business, so the same lead keeps its look but neighbours differ.
export function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const LAYOUTS = [
  "full-bleed photo hero with overlaid headline",
  "split hero: headline left, framed photo right with a floating rating card",
  "centred editorial hero with a large headline and a wide photo strip below",
  "bento-grid hero mixing photo tiles, rating and quick-contact tiles",
  "magazine layout with overlapping image and text blocks",
];

export function pickLook(categoryKey, seedText, variant = 0) {
  const c = CATEGORIES[categoryKey] || CATEGORIES.general;
  const h = hash(seedText) + variant * 7;
  return {
    style: c.styles[h % c.styles.length],
    layout: LAYOUTS[(h >>> 3) % LAYOUTS.length],
  };
}

export function categoryPhotos(categoryKey, seedText, count = 6) {
  const c = CATEGORIES[categoryKey] || CATEGORIES.general;
  if (!c.photos.length) return [];
  const start = hash(seedText) % c.photos.length;
  const out = [];
  for (let i = 0; i < Math.min(count, c.photos.length); i++) out.push(u(c.photos[(start + i) % c.photos.length], i === 0 ? 1800 : 1000));
  return out;
}
