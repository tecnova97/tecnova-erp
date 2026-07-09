import { queryOptions } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Wetter – aktuelle Bedingungen für Hameln über die kostenlose Open-Meteo API
// (kein API-Key nötig). Rein client-seitig, optionales Dashboard-Kärtchen.
// ---------------------------------------------------------------------------

export interface WeatherNow {
  temperature: number;
  windSpeed: number;
  code: number;
  label: string;
  emoji: string;
}

/** Map WMO weather codes to a short German label + emoji. */
function describe(code: number): { label: string; emoji: string } {
  const map: Record<number, { label: string; emoji: string }> = {
    0: { label: "Klar", emoji: "☀️" },
    1: { label: "Überwiegend klar", emoji: "🌤️" },
    2: { label: "Teils bewölkt", emoji: "⛅" },
    3: { label: "Bewölkt", emoji: "☁️" },
    45: { label: "Nebel", emoji: "🌫️" },
    48: { label: "Reifnebel", emoji: "🌫️" },
    51: { label: "Leichter Niesel", emoji: "🌦️" },
    53: { label: "Niesel", emoji: "🌦️" },
    55: { label: "Starker Niesel", emoji: "🌧️" },
    61: { label: "Leichter Regen", emoji: "🌦️" },
    63: { label: "Regen", emoji: "🌧️" },
    65: { label: "Starker Regen", emoji: "🌧️" },
    71: { label: "Leichter Schnee", emoji: "🌨️" },
    73: { label: "Schnee", emoji: "🌨️" },
    75: { label: "Starker Schnee", emoji: "❄️" },
    77: { label: "Schneegriesel", emoji: "🌨️" },
    80: { label: "Regenschauer", emoji: "🌦️" },
    81: { label: "Schauer", emoji: "🌧️" },
    82: { label: "Starke Schauer", emoji: "⛈️" },
    85: { label: "Schneeschauer", emoji: "🌨️" },
    86: { label: "Starke Schneeschauer", emoji: "❄️" },
    95: { label: "Gewitter", emoji: "⛈️" },
    96: { label: "Gewitter mit Hagel", emoji: "⛈️" },
    99: { label: "Schweres Gewitter", emoji: "⛈️" },
  };
  return map[code] ?? { label: "–", emoji: "🌡️" };
}

/** Current weather for Hameln (lat 52.1, lon 9.36). */
export const weatherQuery = () =>
  queryOptions({
    queryKey: ["weather", "hameln"],
    staleTime: 1000 * 60 * 15,
    queryFn: async (): Promise<WeatherNow> => {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=52.1&longitude=9.36" +
        "&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe%2FBerlin";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Wetter konnte nicht geladen werden");
      const json = (await res.json()) as {
        current: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
      };
      const code = json.current.weather_code;
      const d = describe(code);
      return {
        temperature: Math.round(json.current.temperature_2m),
        windSpeed: Math.round(json.current.wind_speed_10m),
        code,
        label: d.label,
        emoji: d.emoji,
      };
    },
  });
