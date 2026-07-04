# TecNova ERP — Android-APK (Capacitor)

Diese Anleitung beschreibt, wie aus der Web-App später eine **Android-APK**
erzeugt wird — **ohne Google Play Store**. Die APK wird manuell auf die
Monteur-Handys installiert. Der Build erfolgt **außerhalb von Lovable** in
Android Studio.

> Kein Google Play Store erforderlich. Die APK wird direkt (Sideloading) auf
> den Geräten installiert.

## Voraussetzungen

- Node.js + npm
- Android Studio (inkl. Android SDK)
- Ein per USB verbundenes Testgerät oder Emulator

## Schritt für Schritt

### 1. Projekt zu GitHub exportieren / synchronisieren
Über das **+**-Menü in Lovable → **GitHub → Connect project** und das
Repository lokal klonen:

```bash
git clone <repo-url>
cd <projekt>
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Web-App bauen

```bash
npm run build
```

### 4. Capacitor installieren

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "TecNova ERP" "de.tecnova.erp"
```

Beim `init` als **Web Dir** den Build-Ausgabeordner (`dist`) angeben.

### 5. Android-Plattform hinzufügen

```bash
npm install @capacitor/android
npx cap add android
```

### 6. Build in das Android-Projekt synchronisieren

```bash
npx cap sync android
```

Diesen Schritt nach **jedem** neuen `npm run build` wiederholen.

### 7. Android Studio öffnen

```bash
npx cap open android
```

### 8. Debug-APK bauen
In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
Die APK liegt anschließend unter
`android/app/build/outputs/apk/debug/app-debug.apk`.

### 9. APK manuell installieren
APK auf das Monteur-Handy übertragen und installieren (Installation aus
unbekannten Quellen muss auf dem Gerät erlaubt sein). Alternativ per Kabel:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 10. Release-APK (später, optional)
Für eine signierte Release-APK in Android Studio einen Signing-Key anlegen
(**Build → Generate Signed Bundle / APK**). Auch dies ist **ohne** Play Store
möglich (Sideloading / interne Verteilung).

## Konfigurationshinweise

Für den Betrieb in der Android-WebView sollte in `capacitor.config.ts` die
produktive Domain als Server-URL hinterlegt werden, damit Auth-Redirects
korrekt funktionieren:

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.tecnova.erp",
  appName: "TecNova ERP",
  webDir: "dist",
  server: {
    // Für Live-Betrieb: auf die produktive Domain zeigen.
    url: "https://erp.tec-nova.de",
    cleartext: false,
  },
};

export default config;
```

## WebView-Kompatibilität (bereits berücksichtigt)

Die App ist auf den Betrieb in der Android-WebView ausgelegt:

- **Mobile-Worker-Route** (`/meine-arbeit`) ist mobil-first und funktioniert
  in der WebView.
- **Auth-Session bleibt erhalten** (Session-Persistenz über den Supabase-
  Client / lokalen Speicher).
- **Datei- und Dokument-Upload** über Standard-`<input type="file">`.
- **Kamera-Upload** über `<input type="file" accept="image/*" capture>` —
  greift in der WebView auf die Gerätekamera zu.
- **`tel:`-Links** öffnen den Telefon-Dialer.
- **Karten-/Navigations-Links** öffnen die Google-Maps-App (bzw. den Browser
  als Fallback).
- **Keine Browser-only-Annahmen** ohne Fallback.

Für erweiterten nativen Zugriff (native Kamera, Geolocation, Push) können
später offizielle Capacitor-Plugins ergänzt werden — für den ersten APK-Build
ist das nicht nötig.
