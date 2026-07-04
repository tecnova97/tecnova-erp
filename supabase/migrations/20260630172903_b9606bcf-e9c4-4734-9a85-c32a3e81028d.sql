
-- KUNDEN
INSERT INTO public.kunden (name, ansprechpartner, email, telefon, strasse, plz, ort, notizen) VALUES
('Deutsche Telekom Technik GmbH','Herr Klaus Mertens','k.mertens@telekom-technik.de','+49 69 1234500','Mainzer Landstraße 50','60325','Frankfurt am Main','Rahmenvertrag FTTH-Ausbau Rhein-Main'),
('Stadtwerke München','Frau Petra Vogel','p.vogel@swm.de','+49 89 2361000','Emmy-Noether-Straße 2','80287','München','Backbone-Erweiterung Süd'),
('Glasfaser Nordwest GmbH','Herr Bernd Janssen','b.janssen@glasfaser-nordwest.de','+49 441 5550','Cloppenburger Straße 310','26133','Oldenburg','Gewerbegebiete Weser-Ems'),
('Deutsche Glasfaser','Frau Lena Schäfer','l.schaefer@deutsche-glasfaser.de','+49 2861 8901','Am Kuhm 31','46325','Borken','FTTH Innenstadtprojekt'),
('Vodafone Deutschland GmbH','Herr Oliver Brandt','o.brandt@vodafone.com','+49 211 5330','Ferdinand-Braun-Platz 1','40549','Düsseldorf','Nachverdichtung Bestandsnetz'),
('NetCologne GmbH','Herr Frank Lehmann','f.lehmann@netcologne.de','+49 221 2222','Am Coloneum 9','50829','Köln','Kabeltrasse Ehrenfeld');

-- MITARBEITER
INSERT INTO public.mitarbeiter (vorname, nachname, email, telefon, position, qualifikationen, farbe, aktiv) VALUES
('Markus','Schneider','m.schneider@tecnova.de','+49 171 2000001','Bauleiter','{"Bauleitung","Tiefbau","Dokumentation"}','#2563eb',true),
('Jürgen','Wagner','j.wagner@tecnova.de','+49 171 2000002','Glasfaser-Monteur','{"Glasfasermontage","Spleißen"}','#16a34a',true),
('Stefan','Becker','s.becker@tecnova.de','+49 171 2000003','Einblas-Techniker','{"Glasfaser Einblasen","Rohrverlegung"}','#ea580c',true),
('Andreas','Hoffmann','a.hoffmann@tecnova.de','+49 171 2000004','Monteur','{"Glasfasermontage","Hausanschluss"}','#9333ea',true),
('Daniel','Krüger','d.krueger@tecnova.de','+49 171 2000005','Tiefbau-Facharbeiter','{"Tiefbau","Erdarbeiten"}','#0891b2',true),
('Thomas','Richter','t.richter@tecnova.de','+49 171 2000006','Spleißtechniker','{"Spleißen","Messtechnik"}','#dc2626',true),
('Patrick','Wolf','p.wolf@tecnova.de','+49 171 2000007','Monteur','{"Hausanschluss","Glasfasermontage"}','#ca8a04',true),
('Sven','Maier','s.maier@tecnova.de','+49 171 2000008','Messtechniker','{"OTDR-Messung","Abnahme"}','#4f46e5',true);

-- PROJEKTE
INSERT INTO public.projekte (name, kunde_id, beschreibung, status, strasse, plz, ort, start_datum, end_datum) VALUES
('FTTH Ausbau Neubaugebiet Riedberg',(SELECT id FROM public.kunden WHERE name='Deutsche Telekom Technik GmbH'),'Glasfaser-Hausanschlüsse für 320 Wohneinheiten im Neubaugebiet','aktiv','Altenhöferallee','60438','Frankfurt am Main','2026-03-01','2026-09-30'),
('Glasfaser Backbone München-Süd',(SELECT id FROM public.kunden WHERE name='Stadtwerke München'),'Backbone-Trasse mit Einblasarbeiten über 12 km','aktiv','Boschetsrieder Straße','81379','München','2026-04-15','2026-12-15'),
('Gewerbegebiet Oldenburg-Etzhorn',(SELECT id FROM public.kunden WHERE name='Glasfaser Nordwest GmbH'),'Erschließung Gewerbegebiet mit 45 Anschlüssen','aktiv','Etzhorner Straße','26125','Oldenburg','2026-05-01','2026-08-31'),
('FTTH Borken Innenstadt',(SELECT id FROM public.kunden WHERE name='Deutsche Glasfaser'),'Innerstädtischer Glasfaserausbau','pausiert','Marktstraße','46325','Borken','2026-02-10','2026-07-20'),
('Kabeltrasse Köln-Ehrenfeld',(SELECT id FROM public.kunden WHERE name='NetCologne GmbH'),'Verlegung und Spleißung Hauptkabeltrasse','aktiv','Venloer Straße','50823','Köln','2026-06-01','2026-10-31');

-- AUFTRAEGE
INSERT INTO public.auftraege (auftragsnummer, titel, beschreibung, status, prioritaet, kunde_id, projekt_id, strasse, plz, ort, termin_start, termin_ende, interne_notizen) VALUES
('A-1001','Hausanschluss Glasfaser Altenhöferallee 12','Einzug Glasfaserkabel und Montage ONT','in_arbeit','hoch',(SELECT id FROM public.kunden WHERE name='Deutsche Telekom Technik GmbH'),(SELECT id FROM public.projekte WHERE name='FTTH Ausbau Neubaugebiet Riedberg'),'Altenhöferallee 12','60438','Frankfurt am Main',now()::date + time '08:00', now()::date + time '11:00','Kunde ist ab 8 Uhr vor Ort'),
('A-1002','Glasfaser Einblasen Abschnitt B3','Einblasen Mikrokabel 144 Fasern, 850m','zugewiesen','hoch',(SELECT id FROM public.kunden WHERE name='Stadtwerke München'),(SELECT id FROM public.projekte WHERE name='Glasfaser Backbone München-Süd'),'Boschetsrieder Straße 41','81379','München',now()::date + time '07:30', now()::date + time '15:00','Druckluftkompressor mitnehmen'),
('A-1003','Spleißung Muffe M-12','Spleißen 96 Fasern in Erdmuffe','geplant','mittel',(SELECT id FROM public.kunden WHERE name='NetCologne GmbH'),(SELECT id FROM public.projekte WHERE name='Kabeltrasse Köln-Ehrenfeld'),'Venloer Straße 220','50823','Köln',now()::date + time '09:00', now()::date + time '13:00',NULL),
('A-1004','OTDR-Abnahmemessung Trasse A','Abnahmemessung und Protokoll','neu','niedrig',(SELECT id FROM public.kunden WHERE name='Glasfaser Nordwest GmbH'),(SELECT id FROM public.projekte WHERE name='Gewerbegebiet Oldenburg-Etzhorn'),'Etzhorner Straße 8','26125','Oldenburg',now()::date + interval '1 day' + time '10:00', now()::date + interval '1 day' + time '12:00',NULL),
('A-1005','Hausanschluss Marktstraße 5','Glasfaser-Hausanschluss inkl. Bohrung','warten','mittel',(SELECT id FROM public.kunden WHERE name='Deutsche Glasfaser'),(SELECT id FROM public.projekte WHERE name='FTTH Borken Innenstadt'),'Marktstraße 5','46325','Borken',now()::date + interval '2 day' + time '08:30', now()::date + interval '2 day' + time '12:00','Warten auf Freigabe Hauseigentümer'),
('A-1006','Tiefbau Künettenaushub Bauabschnitt 2','Erdarbeiten und Rohrverlegung 120m','in_arbeit','hoch',(SELECT id FROM public.kunden WHERE name='Deutsche Telekom Technik GmbH'),(SELECT id FROM public.projekte WHERE name='FTTH Ausbau Neubaugebiet Riedberg'),'Altenhöferallee 40','60438','Frankfurt am Main',now()::date + time '07:00', now()::date + time '16:00','Verkehrssicherung beachten'),
('A-1007','Montage Verteilerschrank NVt-7','Aufbau und Verkabelung Netzverteiler','geplant','mittel',(SELECT id FROM public.kunden WHERE name='Stadtwerke München'),(SELECT id FROM public.projekte WHERE name='Glasfaser Backbone München-Süd'),'Boschetsrieder Straße 60','81379','München',now()::date + interval '3 day' + time '08:00', now()::date + interval '3 day' + time '14:00',NULL),
('A-1008','Hausanschluss Etzhorner Straße 22','Glasfaser-Hausanschluss Gewerbeeinheit','zugewiesen','mittel',(SELECT id FROM public.kunden WHERE name='Glasfaser Nordwest GmbH'),(SELECT id FROM public.projekte WHERE name='Gewerbegebiet Oldenburg-Etzhorn'),'Etzhorner Straße 22','26125','Oldenburg',now()::date + interval '1 day' + time '13:00', now()::date + interval '1 day' + time '16:00',NULL),
('A-1009','Glasfaser Einblasen Trasse C','Einblasen 96 Fasern 600m','abgeschlossen','mittel',(SELECT id FROM public.kunden WHERE name='NetCologne GmbH'),(SELECT id FROM public.projekte WHERE name='Kabeltrasse Köln-Ehrenfeld'),'Venloer Straße 150','50823','Köln',now()::date - interval '2 day' + time '08:00', now()::date - interval '2 day' + time '14:00','Sauber abgeschlossen'),
('A-1010','Spleißung Hauptverteiler HVt-1','Spleißen 288 Fasern','abgeschlossen','hoch',(SELECT id FROM public.kunden WHERE name='Deutsche Telekom Technik GmbH'),(SELECT id FROM public.projekte WHERE name='FTTH Ausbau Neubaugebiet Riedberg'),'Altenhöferallee 1','60438','Frankfurt am Main',now()::date - interval '5 day' + time '07:30', now()::date - interval '5 day' + time '17:00',NULL),
('A-1011','Nachverdichtung Hausanschluss Düsseldorf','Bestandsanschluss erweitern','neu','niedrig',(SELECT id FROM public.kunden WHERE name='Vodafone Deutschland GmbH'),NULL,'Ferdinand-Braun-Platz 1','40549','Düsseldorf',now()::date + interval '4 day' + time '09:00', now()::date + interval '4 day' + time '11:00',NULL),
('A-1012','Störungsbehebung Faserbruch','Lokalisierung und Reparatur Faserbruch','in_arbeit','dringend',(SELECT id FROM public.kunden WHERE name='Stadtwerke München'),(SELECT id FROM public.projekte WHERE name='Glasfaser Backbone München-Süd'),'Boschetsrieder Straße 90','81379','München',now()::date + time '06:30', now()::date + time '12:00','Dringend - Netzausfall Kunde'),
('A-1013','Abnahme und Dokumentation BA1','Endabnahme Bauabschnitt 1','geplant','mittel',(SELECT id FROM public.kunden WHERE name='Glasfaser Nordwest GmbH'),(SELECT id FROM public.projekte WHERE name='Gewerbegebiet Oldenburg-Etzhorn'),'Etzhorner Straße 1','26125','Oldenburg',now()::date + interval '5 day' + time '10:00', now()::date + interval '5 day' + time '15:00',NULL),
('A-1014','Hausanschluss storniert Marktstraße 9','Kunde abgesprungen','storniert','niedrig',(SELECT id FROM public.kunden WHERE name='Deutsche Glasfaser'),(SELECT id FROM public.projekte WHERE name='FTTH Borken Innenstadt'),'Marktstraße 9','46325','Borken',now()::date - interval '1 day' + time '08:00', now()::date - interval '1 day' + time '10:00','Storniert durch Kunde');

-- ABSCHLUSS-INFO für abgeschlossene Aufträge
UPDATE public.auftraege SET abgeschlossen_am = termin_ende, abschluss_notizen = 'Arbeiten vollständig ausgeführt und abgenommen.' WHERE status = 'abgeschlossen';

-- ZUWEISUNGEN
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1001' AND m.nachname IN ('Wagner','Hoffmann');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1002' AND m.nachname IN ('Becker');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1003' AND m.nachname IN ('Richter');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1006' AND m.nachname IN ('Krüger','Schneider');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1008' AND m.nachname IN ('Wolf');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1009' AND m.nachname IN ('Becker','Maier');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1010' AND m.nachname IN ('Richter','Wagner');
INSERT INTO public.auftrag_mitarbeiter (auftrag_id, mitarbeiter_id)
SELECT a.id, m.id FROM public.auftraege a, public.mitarbeiter m WHERE a.auftragsnummer='A-1012' AND m.nachname IN ('Maier','Becker');

-- HISTORIE
INSERT INTO public.auftrag_historie (auftrag_id, aktion, details)
SELECT id,'Auftrag erstellt','Auftrag im System angelegt' FROM public.auftraege;
INSERT INTO public.auftrag_historie (auftrag_id, aktion, details)
SELECT id,'Status geändert','Status auf "In Arbeit" gesetzt' FROM public.auftraege WHERE status='in_arbeit';
INSERT INTO public.auftrag_historie (auftrag_id, aktion, details)
SELECT id,'Auftrag abgeschlossen','Arbeiten abgenommen' FROM public.auftraege WHERE status='abgeschlossen';
