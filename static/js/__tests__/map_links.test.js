const assert = require("assert");
const {
  buildYandexUrl,
  buildOrganicMapsUrl,
  buildOrganicMapsLinks,
  buildOpenStreetMapUrl,
  buildGeoUrl,
} = require("../map_links");

const yandexUrl = buildYandexUrl({ lat: 43.2389, lon: 76.945 });
assert.ok(
  yandexUrl.includes("ll=76.945000,43.238900"),
  "Yandex ll should be lon,lat"
);
assert.ok(
  yandexUrl.includes("text=43.238900%2076.945000"),
  "Yandex text should be lat lon"
);

const organicUrl = buildOrganicMapsUrl({ lat: 43.2389, lon: 76.945, name: "My Place" });
assert.ok(
  organicUrl.includes("ll=43.2389,76.945"),
  "Organic Maps ll should be lat,lon"
);
assert.ok(
  organicUrl.includes("n=My%20Place"),
  "Organic Maps name should be encoded"
);

console.log("map_links tests passed");

const organicPrecisionUrl = buildOrganicMapsUrl({
  lat: 43.237832,
  lon: 76.945621,
  name: "Roni Napolitana",
});
assert.strictEqual(
  organicPrecisionUrl,
  "https://omaps.app/map?v=1&ll=43.237832,76.945621&n=Roni%20Napolitana",
  "Organic Maps URL should preserve precision and order"
);

const organicAppUrl = buildOrganicMapsUrl({
  lat: 43.237832,
  lon: 76.945621,
  name: "Roni Napolitana",
  scheme: "om",
});
assert.strictEqual(
  organicAppUrl,
  "om://map?v=1&ll=43.237832,76.945621&n=Roni%20Napolitana",
  "Organic Maps app URL should preserve precision and order"
);

const organicLinks = buildOrganicMapsLinks({
  lat: 43.237832,
  lon: 76.945621,
  name: "Roni Napolitana",
});
assert.strictEqual(
  organicLinks.appUrl,
  "om://map?ll=43.237832,76.945621&n=Roni%20Napolitana",
  "Organic Maps app URL (non-versioned) should preserve precision and order"
);
assert.strictEqual(
  organicLinks.webUrl,
  "https://omaps.app/map?ll=43.237832,76.945621&n=Roni%20Napolitana",
  "Organic Maps web URL (non-versioned) should preserve precision and order"
);

const osmUrl = buildOpenStreetMapUrl({
  lat: 43.237832,
  lon: 76.945621,
});
assert.strictEqual(
  osmUrl,
  "https://www.openstreetmap.org/?mlat=43.237832&mlon=76.945621#map=17/43.237832/76.945621",
  "OpenStreetMap URL should preserve precision and order"
);

const geoUrl = buildGeoUrl({
  lat: 43.237832,
  lon: 76.945621,
  name: "Roni Napolitana",
});
assert.strictEqual(
  geoUrl,
  "geo:43.237832,76.945621?q=43.237832,76.945621(Roni%20Napolitana)",
  "Geo URL should preserve precision and order"
);
