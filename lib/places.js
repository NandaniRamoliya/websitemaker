// OPTIONAL: Google Places API (New) – the official, terms-compliant way to get a place's real
// photos, reviews, hours and website. Needs GOOGLE_PLACES_API_KEY (Google Cloud project with
// Places API (New) enabled; Google requires a billing account but includes a monthly free usage cap).
const KEY = () => process.env.GOOGLE_PLACES_API_KEY || "";
export const placesEnabled = () => Boolean(KEY());

const FIELDS = [
  "id", "displayName", "formattedAddress", "nationalPhoneNumber", "internationalPhoneNumber", "rating",
  "userRatingCount", "regularOpeningHours.weekdayDescriptions", "websiteUri", "editorialSummary", "reviews",
  "photos", "primaryTypeDisplayName", "googleMapsUri", "location",
];

async function call(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
    headers: { "content-type": "application/json", "X-Goog-Api-Key": KEY(), ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Places: ${j.error?.message || res.status}`);
  return j;
}

export async function findPlaceId(text) {
  const j = await call("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", headers: { "X-Goog-FieldMask": "places.id" }, body: JSON.stringify({ textQuery: text }),
  });
  return j.places?.[0]?.id || null;
}

async function photoUrl(name) {
  const j = await call(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600&skipHttpRedirect=true`);
  return j.photoUri || "";
}

/** Returns a partial brand-data object with real Google data. */
export async function placeDetails(placeId) {
  const p = await call(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: { "X-Goog-FieldMask": FIELDS.join(",") },
  });
  const photos = (await Promise.all((p.photos || []).slice(0, 8).map((ph) => photoUrl(ph.name).catch(() => "")))).filter(Boolean);
  return {
    brand: { name: p.displayName?.text || "", description: p.editorialSummary?.text || "", industry: p.primaryTypeDisplayName?.text || "" },
    contact: {
      phone: p.internationalPhoneNumber || p.nationalPhoneNumber || "",
      address: p.formattedAddress || "",
      hours: (p.regularOpeningHours?.weekdayDescriptions || []).join("\n"),
      mapUrl: p.googleMapsUri || "",
    },
    media: photos.length ? { hero: photos[0], gallery: photos.slice(1) } : {},
    testimonials: (p.reviews || []).filter((r) => r.text?.text && r.rating >= 4).slice(0, 6).map((r) => ({
      name: r.authorAttribution?.displayName || "Google user",
      role: `Google review${r.relativePublishTimeDescription ? " · " + r.relativePublishTimeDescription : ""}`,
      text: r.text.text.length > 320 ? r.text.text.slice(0, 317) + "…" : r.text.text,
      rating: String(r.rating),
    })),
    social: { website: p.websiteUri || "" },
    meta: { rating: p.rating ? String(p.rating) : "", reviews: p.userRatingCount ? String(p.userRatingCount) : "", lat: p.location?.latitude, lng: p.location?.longitude, realPhotos: photos.length > 0 },
  };
}
