import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required" }, { status: 422 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Google Maps Geocoding is not configured" }, { status: 503 });
  }

  try {
    const googleUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    googleUrl.searchParams.set("latlng", `${lat},${lng}`);
    googleUrl.searchParams.set("key", key);
    googleUrl.searchParams.set("language", "en");
    const response = await fetch(googleUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Google Geocoding request failed");
    const data = await response.json() as {
      status?: string;
      results?: Array<{ formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }>;
    };
    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ error: data.status ?? "No address found" }, { status: 502 });
    }
    const result = data.results[0];
    const components = result.address_components ?? [];
    const pick = (type: string) => components.find((part) => part.types.includes(type))?.long_name ?? "";
    return NextResponse.json({
      label: result.formatted_address ?? "Current location",
      city: pick("locality") || pick("administrative_area_level_2") || pick("administrative_area_level_1"),
      pincode: pick("postal_code"),
      source: "google",
    });
  } catch {
    return NextResponse.json({ error: "Google location lookup failed" }, { status: 502 });
  }
}
