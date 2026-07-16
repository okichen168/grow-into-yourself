import countries from "world-countries";

export async function GET() {
  return Response.json({ countries: countries.map((country) => ({ code: country.cca2, en: country.name.common, zh: country.translations.zho?.common || country.name.common, lat: country.latlng[0], lng: country.latlng[1], flag: country.flag })).sort((a, b) => a.en.localeCompare(b.en)) }, { headers: { "cache-control": "public, max-age=86400" } });
}
