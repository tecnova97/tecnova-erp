# TecNova ERP — Deployment (Produktion)

Dieses Dokument beschreibt den Weg vom Lovable-Projekt zum produktiven Betrieb
unter **erp.tec-nova.de**.

## 1. Architektur (Kurzüberblick)

- **Frontend:** React (TanStack Start / Vite), gebaut als Web-App.
- **Backend:** Lovable Cloud (Supabase) — Datenbank, Auth, Storage.
- **Kein eigener Node-Server erforderlich:** Es gibt keine selbst betriebene
  API. Alle Datenzugriffe laufen direkt gegen Lovable Cloud über den
  öffentlichen anon-Schlüssel + Row Level Security (RLS).
- **Ziel-Hosting:** Cloudflare. Der Build ist bereits auf Cloudflare als
  Ziel ausgelegt.

> Hinweis: Der einfachste und offiziell unterstützte Weg ist die **Lovable-
> Veröffentlichung** (Publish). Sie erledigt Build und Hosting automatisch.
> Die manuelle GitHub-/Cloudflare-Route unten ist optional für Teams, die die
> volle Kontrolle über Repository und Deployment möchten.

## 2. Umgebungsvariablen

Diese Variablen werden zur Build-Zeit benötigt (Prefix `VITE_`, damit sie im
Frontend verfügbar sind):

| Variable | Beschreibung |
| --- | --- |
| `VITE_SUPABASE_URL` | URL des Lovable-Cloud-Backends |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Öffentlicher anon-Schlüssel (darf im Frontend liegen) |
| `VITE_SUPABASE_PROJECT_ID` | Projekt-Kennung |

Die aktuellen Werte stehen in der Datei `.env`. Der anon-Schlüssel ist ein
**öffentlicher** Schlüssel — der Datenschutz wird durch RLS-Policies
sichergestellt, nicht durch Geheimhaltung des Schlüssels.

## 3. Build

```bash
npm install
npm run build
```

- **Build-Befehl:** `npm run build`
- **Ausgabe:** Der Build erzeugt das Deployment-Artefakt im Ausgabeordner
  (`dist/`). Bei Cloudflare Pages wird dieser Ordner automatisch erkannt,
  wenn das passende Framework-Preset gewählt ist.

## 4. Variante A — Veröffentlichen über Lovable (empfohlen)

1. In Lovable oben rechts auf **Publish** klicken.
2. Nach der ersten Veröffentlichung unter **Project Settings → Domains** die
   Domain **erp.tec-nova.de** verbinden (A-Record auf `185.158.133.1` sowie
   TXT-Verifizierung — die genauen Werte zeigt der Domain-Dialog an).
3. `www`-Subdomain separat hinzufügen, falls gewünscht.
4. SSL wird automatisch bereitgestellt.

## 5. Variante B — GitHub → Cloudflare Pages (optional)

1. **Projekt zu GitHub exportieren:** In Lovable über das **+**-Menü →
   **GitHub → Connect project** ein Repository anlegen. Der Code wird
   automatisch synchronisiert.
2. **Cloudflare Pages verbinden:** Im Cloudflare-Dashboard
   **Workers & Pages → Create → Pages → Connect to Git** das GitHub-Repo
   auswählen.
3. **Build-Befehl setzen:** `npm run build`
4. **Ausgabeordner setzen:** `dist`
5. **Umgebungsvariablen setzen:** die drei `VITE_*`-Variablen aus Abschnitt 2
   unter **Settings → Environment variables** eintragen.
6. **Custom Domain hinzufügen:** unter **Custom domains** die Domain
   **erp.tec-nova.de** verbinden und den DNS-Anweisungen folgen.

## 6. Auth Redirect-URLs

Damit Login, Passwort-Reset und Einladungen funktionieren, im Backend unter
**Auth-Konfiguration** eintragen:

- **Site URL:** `https://erp.tec-nova.de`
- **Zusätzliche Redirect-URLs:**
  - `https://erp.tec-nova.de`
  - `https://erp.tec-nova.de/*`
  - (optional die Lovable-Preview-URL für Tests)

## 7. Abnahme-Checks nach dem Go-Live

1. **Login testen** (Inhaber-Konto).
2. **Mobile-Worker-Route testen:** `/meine-arbeit` auf einem Smartphone
   öffnen — Anmeldung, Auftragsliste, Abschluss-Wizard.
3. **Datei-/Foto-Upload testen** (Dokumente & Auftragsfotos).
4. **Testdaten bereinigen:** Einstellungen → System → Testdaten bereinigen.
5. **Security-Scan** in Lovable durchführen und Ergebnisse prüfen.
6. **Backup-Strategie** festlegen (regelmäßiger Datenexport).

## 8. In-App-Prüfliste

Eine interaktive Version dieser Checkliste findet sich unter
**Einstellungen → System → Deployment Check** (nur für den Inhaber sichtbar).
