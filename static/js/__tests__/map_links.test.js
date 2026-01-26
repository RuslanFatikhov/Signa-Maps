const assert = require("assert");
const { buildYandexUrl, buildOrganicMapsUrl } = require("../map_links");

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
  organicUrl.includes("ll=43.238900,76.945000"),
  "Organic Maps ll should be lat,lon"
);
assert.ok(
  organicUrl.includes("n=My%20Place"),
  "Organic Maps name should be encoded"
);

console.log("map_links tests passed");
