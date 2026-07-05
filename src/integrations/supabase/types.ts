export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          admin_note: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          hidden_from_ui: boolean
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          admin_note?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          hidden_from_ui?: boolean
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_note?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          hidden_from_ui?: boolean
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      auftraege: {
        Row: {
          abgeschlossen_am: string | null
          abschluss_notizen: string | null
          ag_bestell_nr: string | null
          ag_leb_nr: string | null
          ansprechpartner: string | null
          asb: string | null
          auftragsnummer: string
          beschreibung: string | null
          bezahlt: boolean
          bezahlt_am: string | null
          created_at: string
          created_by: string | null
          custom_felder: Json
          disponent: string | null
          esass_nr: string | null
          externe_auftragsnummer: string | null
          hausnummer: string | null
          id: string
          import_batch_id: string | null
          interne_notizen: string | null
          kls_id: string | null
          kostenstelle: string | null
          kunde_email: string | null
          kunde_festnetz: string | null
          kunde_id: string | null
          kunde_name: string | null
          kunde_telefon: string | null
          leistungsort: string | null
          nvt: string | null
          onkz: string | null
          ort: string | null
          plz: string | null
          projekt_id: string | null
          projektleiter: string | null
          projektnummer: string | null
          sm_nr: string | null
          status: string
          strasse: string | null
          team: string | null
          termin_ende: string | null
          termin_start: string | null
          titel: string
          updated_at: string
          wichtiginfo: string | null
        }
        Insert: {
          abgeschlossen_am?: string | null
          abschluss_notizen?: string | null
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          ansprechpartner?: string | null
          asb?: string | null
          auftragsnummer?: string
          beschreibung?: string | null
          bezahlt?: boolean
          bezahlt_am?: string | null
          created_at?: string
          created_by?: string | null
          custom_felder?: Json
          disponent?: string | null
          esass_nr?: string | null
          externe_auftragsnummer?: string | null
          hausnummer?: string | null
          id?: string
          import_batch_id?: string | null
          interne_notizen?: string | null
          kls_id?: string | null
          kostenstelle?: string | null
          kunde_email?: string | null
          kunde_festnetz?: string | null
          kunde_id?: string | null
          kunde_name?: string | null
          kunde_telefon?: string | null
          leistungsort?: string | null
          nvt?: string | null
          onkz?: string | null
          ort?: string | null
          plz?: string | null
          projekt_id?: string | null
          projektleiter?: string | null
          projektnummer?: string | null
          sm_nr?: string | null
          status?: string
          strasse?: string | null
          team?: string | null
          termin_ende?: string | null
          termin_start?: string | null
          titel: string
          updated_at?: string
          wichtiginfo?: string | null
        }
        Update: {
          abgeschlossen_am?: string | null
          abschluss_notizen?: string | null
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          ansprechpartner?: string | null
          asb?: string | null
          auftragsnummer?: string
          beschreibung?: string | null
          bezahlt?: boolean
          bezahlt_am?: string | null
          created_at?: string
          created_by?: string | null
          custom_felder?: Json
          disponent?: string | null
          esass_nr?: string | null
          externe_auftragsnummer?: string | null
          hausnummer?: string | null
          id?: string
          import_batch_id?: string | null
          interne_notizen?: string | null
          kls_id?: string | null
          kostenstelle?: string | null
          kunde_email?: string | null
          kunde_festnetz?: string | null
          kunde_id?: string | null
          kunde_name?: string | null
          kunde_telefon?: string | null
          leistungsort?: string | null
          nvt?: string | null
          onkz?: string | null
          ort?: string | null
          plz?: string | null
          projekt_id?: string | null
          projektleiter?: string | null
          projektnummer?: string | null
          sm_nr?: string | null
          status?: string
          strasse?: string | null
          team?: string | null
          termin_ende?: string | null
          termin_start?: string | null
          titel?: string
          updated_at?: string
          wichtiginfo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auftraege_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftraege_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekte"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_ausgaben: {
        Row: {
          auftrag_id: string
          betrag: number
          bezeichnung: string
          created_at: string
          created_by: string | null
          datum: string
          id: string
          kategorie_id: string | null
          notiz: string | null
          updated_at: string
        }
        Insert: {
          auftrag_id: string
          betrag?: number
          bezeichnung: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          kategorie_id?: string | null
          notiz?: string | null
          updated_at?: string
        }
        Update: {
          auftrag_id?: string
          betrag?: number
          bezeichnung?: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          kategorie_id?: string | null
          notiz?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_ausgaben_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftrag_ausgaben_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "ausgaben_kategorien"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_historie: {
        Row: {
          aktion: string
          auftrag_id: string
          created_at: string
          details: string | null
          id: string
          sichtbar: boolean
          typ: string
          user_id: string | null
        }
        Insert: {
          aktion: string
          auftrag_id: string
          created_at?: string
          details?: string | null
          id?: string
          sichtbar?: boolean
          typ?: string
          user_id?: string | null
        }
        Update: {
          aktion?: string
          auftrag_id?: string
          created_at?: string
          details?: string | null
          id?: string
          sichtbar?: boolean
          typ?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_historie_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_leistung_preise: {
        Row: {
          auftrag_leistung_id: string
          preis: number
          updated_at: string
        }
        Insert: {
          auftrag_leistung_id: string
          preis?: number
          updated_at?: string
        }
        Update: {
          auftrag_leistung_id?: string
          preis?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_leistung_preise_auftrag_leistung_id_fkey"
            columns: ["auftrag_leistung_id"]
            isOneToOne: true
            referencedRelation: "auftrag_leistungen"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_leistungen: {
        Row: {
          auftrag_id: string
          berechnungsart: string
          code: string
          created_at: string
          einheit: string
          id: string
          leistung_id: string | null
          menge: number
          mitarbeiter_anzahl: number
          name: string
          notiz: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          auftrag_id: string
          berechnungsart?: string
          code?: string
          created_at?: string
          einheit?: string
          id?: string
          leistung_id?: string | null
          menge?: number
          mitarbeiter_anzahl?: number
          name?: string
          notiz?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auftrag_id?: string
          berechnungsart?: string
          code?: string
          created_at?: string
          einheit?: string
          id?: string
          leistung_id?: string | null
          menge?: number
          mitarbeiter_anzahl?: number
          name?: string
          notiz?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_leistungen_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftrag_leistungen_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: false
            referencedRelation: "leistungspositionen"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_mitarbeiter: {
        Row: {
          auftrag_id: string
          created_at: string
          id: string
          mitarbeiter_id: string
        }
        Insert: {
          auftrag_id: string
          created_at?: string
          id?: string
          mitarbeiter_id: string
        }
        Update: {
          auftrag_id?: string
          created_at?: string
          id?: string
          mitarbeiter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_mitarbeiter_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftrag_mitarbeiter_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_status_zuweisungen: {
        Row: {
          assigned_by: string | null
          auftrag_id: string
          created_at: string
          id: string
          is_primary: boolean
          sichtbar: boolean
          sort_order: number
          status_key: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          auftrag_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          sichtbar?: boolean
          sort_order?: number
          status_key: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          auftrag_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          sichtbar?: boolean
          sort_order?: number
          status_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_status_zuweisungen_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auftrag_status_zuweisungen_status_key_fkey"
            columns: ["status_key"]
            isOneToOne: false
            referencedRelation: "status_definitionen"
            referencedColumns: ["key"]
          },
        ]
      }
      auftrag_zahlungsereignis_umsatz: {
        Row: {
          created_at: string
          ereignis_id: string
          positionen: Json
          umsatz: number
        }
        Insert: {
          created_at?: string
          ereignis_id: string
          positionen?: Json
          umsatz?: number
        }
        Update: {
          created_at?: string
          ereignis_id?: string
          positionen?: Json
          umsatz?: number
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_zahlungsereignis_umsatz_ereignis_id_fkey"
            columns: ["ereignis_id"]
            isOneToOne: true
            referencedRelation: "auftrag_zahlungsereignisse"
            referencedColumns: ["id"]
          },
        ]
      }
      auftrag_zahlungsereignisse: {
        Row: {
          auftrag_id: string
          created_at: string
          created_by: string | null
          datum: string
          id: string
          leistungen: Json
          notiz: string | null
          nummer: number | null
          status_farbe: string
          status_key: string
          status_label: string
          storniert: boolean
          storniert_am: string | null
          storniert_by: string | null
          updated_at: string
        }
        Insert: {
          auftrag_id: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          leistungen?: Json
          notiz?: string | null
          nummer?: number | null
          status_farbe?: string
          status_key: string
          status_label: string
          storniert?: boolean
          storniert_am?: string | null
          storniert_by?: string | null
          updated_at?: string
        }
        Update: {
          auftrag_id?: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          leistungen?: Json
          notiz?: string | null
          nummer?: number | null
          status_farbe?: string
          status_key?: string
          status_label?: string
          storniert?: boolean
          storniert_am?: string | null
          storniert_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auftrag_zahlungsereignisse_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      ausgaben_kategorien: {
        Row: {
          aktiv: boolean
          created_at: string
          farbe: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          farbe?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          farbe?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      betriebsausgaben: {
        Row: {
          auftrag_id: string | null
          auftraggeber_id: string | null
          beleg_url: string | null
          betrag: number
          bezeichnung: string
          created_at: string
          created_by: string | null
          datum: string
          id: string
          kategorie: string | null
          kategorie_id: string | null
          mitarbeiter_id: string | null
          mwst_satz: number
          notiz: string | null
          projekt_id: string | null
          updated_at: string
          wiederkehrend: boolean
        }
        Insert: {
          auftrag_id?: string | null
          auftraggeber_id?: string | null
          beleg_url?: string | null
          betrag?: number
          bezeichnung: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          kategorie?: string | null
          kategorie_id?: string | null
          mitarbeiter_id?: string | null
          mwst_satz?: number
          notiz?: string | null
          projekt_id?: string | null
          updated_at?: string
          wiederkehrend?: boolean
        }
        Update: {
          auftrag_id?: string | null
          auftraggeber_id?: string | null
          beleg_url?: string | null
          betrag?: number
          bezeichnung?: string
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          kategorie?: string | null
          kategorie_id?: string | null
          mitarbeiter_id?: string | null
          mwst_satz?: number
          notiz?: string | null
          projekt_id?: string | null
          updated_at?: string
          wiederkehrend?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "betriebsausgaben_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betriebsausgaben_auftraggeber_id_fkey"
            columns: ["auftraggeber_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betriebsausgaben_kategorie_id_fkey"
            columns: ["kategorie_id"]
            isOneToOne: false
            referencedRelation: "ausgaben_kategorien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betriebsausgaben_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betriebsausgaben_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekte"
            referencedColumns: ["id"]
          },
        ]
      }
      blocker: {
        Row: {
          created_at: string
          created_by: string | null
          end_zeit: string
          farbe: string
          grund: string | null
          id: string
          mitarbeiter_id: string
          notiz: string | null
          start_zeit: string
          titel: string
          typ: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_zeit: string
          farbe?: string
          grund?: string | null
          id?: string
          mitarbeiter_id: string
          notiz?: string | null
          start_zeit: string
          titel: string
          typ?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_zeit?: string
          farbe?: string
          grund?: string | null
          id?: string
          mitarbeiter_id?: string
          notiz?: string | null
          start_zeit?: string
          titel?: string
          typ?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocker_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_defs: {
        Row: {
          created_at: string
          entity_type: string
          erforderlich: boolean
          feldtyp: string
          field_key: string
          id: string
          label: string
          optionen: Json
          sichtbar: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          erforderlich?: boolean
          feldtyp?: string
          field_key: string
          id?: string
          label: string
          optionen?: Json
          sichtbar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          erforderlich?: boolean
          feldtyp?: string
          field_key?: string
          id?: string
          label?: string
          optionen?: Json
          sichtbar?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_role_layouts: {
        Row: {
          allow_customize: boolean
          base_role: Database["public"]["Enums"]["app_role"]
          config: Json
          created_at: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_customize?: boolean
          base_role: Database["public"]["Enums"]["app_role"]
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_customize?: boolean
          base_role?: Database["public"]["Enums"]["app_role"]
          config?: Json
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      document_links: {
        Row: {
          created_at: string
          document_id: string
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tag_links: {
        Row: {
          document_id: string
          tag_id: string
        }
        Insert: {
          document_id: string
          tag_id: string
        }
        Update: {
          document_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "dokument_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          extension: string | null
          groesse: number | null
          id: string
          mime_type: string | null
          original_dateiname: string
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          document_id: string
          extension?: string | null
          groesse?: number | null
          id?: string
          mime_type?: string | null
          original_dateiname: string
          storage_path: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          extension?: string | null
          groesse?: number | null
          id?: string
          mime_type?: string | null
          original_dateiname?: string
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          aktuelle_version: number
          archiviert: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          notiz: string | null
          updated_at: string
          vertraulich: boolean
          worker_sichtbar: boolean
        }
        Insert: {
          aktuelle_version?: number
          archiviert?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notiz?: string | null
          updated_at?: string
          vertraulich?: boolean
          worker_sichtbar?: boolean
        }
        Update: {
          aktuelle_version?: number
          archiviert?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notiz?: string | null
          updated_at?: string
          vertraulich?: boolean
          worker_sichtbar?: boolean
        }
        Relationships: []
      }
      dokument_tags: {
        Row: {
          created_at: string
          created_by: string | null
          farbe: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farbe?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farbe?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      dokumente: {
        Row: {
          auftrag_id: string | null
          created_at: string
          dateiname: string
          dateityp: string | null
          groesse: number | null
          id: string
          kunde_id: string | null
          projekt_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          auftrag_id?: string | null
          created_at?: string
          dateiname: string
          dateityp?: string | null
          groesse?: number | null
          id?: string
          kunde_id?: string | null
          projekt_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          auftrag_id?: string | null
          created_at?: string
          dateiname?: string
          dateityp?: string | null
          groesse?: number | null
          id?: string
          kunde_id?: string | null
          projekt_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dokumente_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dokumente_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekte"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      firmenprofil: {
        Row: {
          bank: string | null
          bic: string | null
          created_at: string
          default_theme: Json | null
          default_theme_mode: string
          email: string | null
          email_logo: string | null
          farbe_primary: string
          farbe_secondary: string
          favicon_dark: string | null
          favicon_light: string | null
          favicon_url: string | null
          firmenname: string
          full_logo_dark: string | null
          full_logo_light: string | null
          iban: string | null
          id: string
          invoice_logo: string | null
          login_logo_dark: string | null
          login_logo_light: string | null
          logo_full_url: string | null
          logo_round_url: string | null
          logo_white_url: string | null
          mobile_logo_dark: string | null
          mobile_logo_light: string | null
          ort: string | null
          pdf_logo: string | null
          plz: string | null
          round_logo_dark: string | null
          round_logo_light: string | null
          steuernummer: string | null
          strasse: string | null
          telefon: string | null
          updated_at: string
          ust_idnr: string | null
          website: string | null
        }
        Insert: {
          bank?: string | null
          bic?: string | null
          created_at?: string
          default_theme?: Json | null
          default_theme_mode?: string
          email?: string | null
          email_logo?: string | null
          farbe_primary?: string
          farbe_secondary?: string
          favicon_dark?: string | null
          favicon_light?: string | null
          favicon_url?: string | null
          firmenname?: string
          full_logo_dark?: string | null
          full_logo_light?: string | null
          iban?: string | null
          id?: string
          invoice_logo?: string | null
          login_logo_dark?: string | null
          login_logo_light?: string | null
          logo_full_url?: string | null
          logo_round_url?: string | null
          logo_white_url?: string | null
          mobile_logo_dark?: string | null
          mobile_logo_light?: string | null
          ort?: string | null
          pdf_logo?: string | null
          plz?: string | null
          round_logo_dark?: string | null
          round_logo_light?: string | null
          steuernummer?: string | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          ust_idnr?: string | null
          website?: string | null
        }
        Update: {
          bank?: string | null
          bic?: string | null
          created_at?: string
          default_theme?: Json | null
          default_theme_mode?: string
          email?: string | null
          email_logo?: string | null
          farbe_primary?: string
          farbe_secondary?: string
          favicon_dark?: string | null
          favicon_light?: string | null
          favicon_url?: string | null
          firmenname?: string
          full_logo_dark?: string | null
          full_logo_light?: string | null
          iban?: string | null
          id?: string
          invoice_logo?: string | null
          login_logo_dark?: string | null
          login_logo_light?: string | null
          logo_full_url?: string | null
          logo_round_url?: string | null
          logo_white_url?: string | null
          mobile_logo_dark?: string | null
          mobile_logo_light?: string | null
          ort?: string | null
          pdf_logo?: string | null
          plz?: string | null
          round_logo_dark?: string | null
          round_logo_light?: string | null
          steuernummer?: string | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          ust_idnr?: string | null
          website?: string | null
        }
        Relationships: []
      }
      fotos: {
        Row: {
          auftrag_id: string
          beschreibung: string | null
          created_at: string
          dateiname: string | null
          id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          auftrag_id: string
          beschreibung?: string | null
          created_at?: string
          dateiname?: string | null
          id?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          auftrag_id?: string
          beschreibung?: string | null
          created_at?: string
          dateiname?: string | null
          id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_auftrag_id_fkey"
            columns: ["auftrag_id"]
            isOneToOne: false
            referencedRelation: "auftraege"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_auftrag_count: number
          error_count: number
          id: string
          notes: string | null
          original_filename: string | null
          row_count: number
          source_name: string | null
          source_type: string
          status: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          uploaded_file_url: string | null
        }
        Insert: {
          created_at?: string
          created_auftrag_count?: number
          error_count?: number
          id?: string
          notes?: string | null
          original_filename?: string | null
          row_count?: number
          source_name?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_file_url?: string | null
        }
        Update: {
          created_at?: string
          created_auftrag_count?: number
          error_count?: number
          id?: string
          notes?: string | null
          original_filename?: string | null
          row_count?: number
          source_name?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          uploaded_file_url?: string | null
        }
        Relationships: []
      }
      import_confirmations: {
        Row: {
          confirmed_at: string
          confirmed_by: string | null
          created_auftrag_ids: string[]
          id: string
          import_batch_id: string
          notes: string | null
        }
        Insert: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_auftrag_ids?: string[]
          id?: string
          import_batch_id: string
          notes?: string | null
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string | null
          created_auftrag_ids?: string[]
          id?: string
          import_batch_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_confirmations_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mapping_profiles: {
        Row: {
          column_mapping_json: Json
          created_at: string
          created_by: string | null
          default_auftraggeber_id: string | null
          default_project_id: string | null
          default_status_id: string | null
          id: string
          name: string
          source_type: string
          updated_at: string
        }
        Insert: {
          column_mapping_json?: Json
          created_at?: string
          created_by?: string | null
          default_auftraggeber_id?: string | null
          default_project_id?: string | null
          default_status_id?: string | null
          id?: string
          name: string
          source_type?: string
          updated_at?: string
        }
        Update: {
          column_mapping_json?: Json
          created_at?: string
          created_by?: string | null
          default_auftraggeber_id?: string | null
          default_project_id?: string | null
          default_status_id?: string | null
          id?: string
          name?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          created_at: string
          created_auftrag_id: string | null
          duplicate_candidate_id: string | null
          edited_at: string | null
          edited_by: string | null
          error_messages: string | null
          id: string
          import_batch_id: string
          parsed_data_json: Json
          raw_data_json: Json
          row_number: number
          selected: boolean
          updated_at: string
          validation_status: string
        }
        Insert: {
          created_at?: string
          created_auftrag_id?: string | null
          duplicate_candidate_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          error_messages?: string | null
          id?: string
          import_batch_id: string
          parsed_data_json?: Json
          raw_data_json?: Json
          row_number?: number
          selected?: boolean
          updated_at?: string
          validation_status?: string
        }
        Update: {
          created_at?: string
          created_auftrag_id?: string | null
          duplicate_candidate_id?: string | null
          edited_at?: string | null
          edited_by?: string | null
          error_messages?: string | null
          id?: string
          import_batch_id?: string
          parsed_data_json?: Json
          raw_data_json?: Json
          row_number?: number
          selected?: boolean
          updated_at?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_user_id: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          nachname: string | null
          role_id: string | null
          status: string
          telefon: string | null
          token_hash: string | null
          updated_at: string
          vorname: string | null
        }
        Insert: {
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          nachname?: string | null
          role_id?: string | null
          status?: string
          telefon?: string | null
          token_hash?: string | null
          updated_at?: string
          vorname?: string | null
        }
        Update: {
          accepted_user_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          nachname?: string | null
          role_id?: string | null
          status?: string
          telefon?: string | null
          token_hash?: string | null
          updated_at?: string
          vorname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      kunden: {
        Row: {
          ansprechpartner: string | null
          archiviert: boolean
          created_at: string
          created_by: string | null
          email: string | null
          festnetz: string | null
          hausnummer: string | null
          id: string
          name: string
          notizen: string | null
          ort: string | null
          plz: string | null
          strasse: string | null
          telefon: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          ansprechpartner?: string | null
          archiviert?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          festnetz?: string | null
          hausnummer?: string | null
          id?: string
          name: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          ansprechpartner?: string | null
          archiviert?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          festnetz?: string | null
          hausnummer?: string | null
          id?: string
          name?: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      leistung_preise: {
        Row: {
          leistung_id: string
          preis: number
          updated_at: string
        }
        Insert: {
          leistung_id: string
          preis?: number
          updated_at?: string
        }
        Update: {
          leistung_id?: string
          preis?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leistung_preise_leistung_id_fkey"
            columns: ["leistung_id"]
            isOneToOne: true
            referencedRelation: "leistungspositionen"
            referencedColumns: ["id"]
          },
        ]
      }
      leistungspositionen: {
        Row: {
          aktiv: boolean
          berechnungsart: string
          code: string
          created_at: string
          einheit: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          worker_ohne_preis: boolean
        }
        Insert: {
          aktiv?: boolean
          berechnungsart?: string
          code: string
          created_at?: string
          einheit?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          worker_ohne_preis?: boolean
        }
        Update: {
          aktiv?: boolean
          berechnungsart?: string
          code?: string
          created_at?: string
          einheit?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          worker_ohne_preis?: boolean
        }
        Relationships: []
      }
      mitarbeiter: {
        Row: {
          aktiv: boolean
          created_at: string
          email: string | null
          farbe: string
          id: string
          linked_user_id: string | null
          nachname: string
          notizen: string | null
          position: string | null
          qualifikationen: string[]
          rolle: string | null
          telefon: string | null
          updated_at: string
          updated_by: string | null
          vorname: string
        }
        Insert: {
          aktiv?: boolean
          created_at?: string
          email?: string | null
          farbe?: string
          id?: string
          linked_user_id?: string | null
          nachname: string
          notizen?: string | null
          position?: string | null
          qualifikationen?: string[]
          rolle?: string | null
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          vorname: string
        }
        Update: {
          aktiv?: boolean
          created_at?: string
          email?: string | null
          farbe?: string
          id?: string
          linked_user_id?: string | null
          nachname?: string
          notizen?: string | null
          position?: string | null
          qualifikationen?: string[]
          rolle?: string | null
          telefon?: string | null
          updated_at?: string
          updated_by?: string | null
          vorname?: string
        }
        Relationships: []
      }
      mitarbeiter_ausstattung: {
        Row: {
          ausgabe_datum: string | null
          bezeichnung: string
          created_at: string
          created_by: string | null
          id: string
          kennzeichen: string | null
          mitarbeiter_id: string
          notiz: string | null
          rueckgabe_datum: string | null
          seriennummer: string | null
          typ: string
          updated_at: string
        }
        Insert: {
          ausgabe_datum?: string | null
          bezeichnung: string
          created_at?: string
          created_by?: string | null
          id?: string
          kennzeichen?: string | null
          mitarbeiter_id: string
          notiz?: string | null
          rueckgabe_datum?: string | null
          seriennummer?: string | null
          typ?: string
          updated_at?: string
        }
        Update: {
          ausgabe_datum?: string | null
          bezeichnung?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kennzeichen?: string | null
          mitarbeiter_id?: string
          notiz?: string | null
          rueckgabe_datum?: string | null
          seriennummer?: string | null
          typ?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_ausstattung_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter_leistungsnotizen: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mitarbeiter_id: string
          text: string
          typ: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mitarbeiter_id: string
          text: string
          typ?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mitarbeiter_id?: string
          text?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_leistungsnotizen_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter_verguetung: {
        Row: {
          beschaeftigungsart: string | null
          created_at: string
          eigene_sichtbar: boolean
          eintrittsdatum: string | null
          grundlohn: number | null
          id: string
          interne_notizen: string | null
          mitarbeiter_id: string
          sollstunden: number | null
          steuer_notizen: string | null
          stundenlohn: number | null
          updated_at: string
        }
        Insert: {
          beschaeftigungsart?: string | null
          created_at?: string
          eigene_sichtbar?: boolean
          eintrittsdatum?: string | null
          grundlohn?: number | null
          id?: string
          interne_notizen?: string | null
          mitarbeiter_id: string
          sollstunden?: number | null
          steuer_notizen?: string | null
          stundenlohn?: number | null
          updated_at?: string
        }
        Update: {
          beschaeftigungsart?: string | null
          created_at?: string
          eigene_sichtbar?: boolean
          eintrittsdatum?: string | null
          grundlohn?: number | null
          id?: string
          interne_notizen?: string | null
          mitarbeiter_id?: string
          sollstunden?: number | null
          steuer_notizen?: string | null
          stundenlohn?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_verguetung_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: true
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      mitarbeiter_verguetung_eintraege: {
        Row: {
          beschreibung: string | null
          betrag: number
          created_at: string
          created_by: string | null
          datum: string
          id: string
          mitarbeiter_id: string
          monat: string
          typ: string
        }
        Insert: {
          beschreibung?: string | null
          betrag?: number
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          mitarbeiter_id: string
          monat: string
          typ: string
        }
        Update: {
          beschreibung?: string | null
          betrag?: number
          created_at?: string
          created_by?: string | null
          datum?: string
          id?: string
          mitarbeiter_id?: string
          monat?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitarbeiter_verguetung_eintraege_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          beschreibung: string | null
          created_at: string
          kategorie: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          kategorie: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          kategorie?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled: boolean
          email: string | null
          force_password_change: boolean
          id: string
          last_login_at: string | null
          nachname: string | null
          telefon: string | null
          theme_custom: Json | null
          theme_mode: string
          updated_at: string
          vorname: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled?: boolean
          email?: string | null
          force_password_change?: boolean
          id: string
          last_login_at?: string | null
          nachname?: string | null
          telefon?: string | null
          theme_custom?: Json | null
          theme_mode?: string
          updated_at?: string
          vorname?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled?: boolean
          email?: string | null
          force_password_change?: boolean
          id?: string
          last_login_at?: string | null
          nachname?: string | null
          telefon?: string | null
          theme_custom?: Json | null
          theme_mode?: string
          updated_at?: string
          vorname?: string | null
        }
        Relationships: []
      }
      projekte: {
        Row: {
          ag_bestell_nr: string | null
          ag_leb_nr: string | null
          ag_sm_nr: string | null
          ag_vertrags_nr: string | null
          archiviert: boolean
          beschreibung: string | null
          created_at: string
          created_by: string | null
          custom_data: Json
          end_datum: string | null
          esass_nr: string | null
          hausnummer: string | null
          id: string
          kostenstelle: string | null
          kunde_id: string | null
          leistung_bis: string | null
          leistung_von: string | null
          leistungsort: string | null
          name: string
          notizen: string | null
          nvt: string | null
          ort: string | null
          plz: string | null
          projektleiter: string | null
          start_datum: string | null
          status: Database["public"]["Enums"]["projekt_status"]
          strasse: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          ag_sm_nr?: string | null
          ag_vertrags_nr?: string | null
          archiviert?: boolean
          beschreibung?: string | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          end_datum?: string | null
          esass_nr?: string | null
          hausnummer?: string | null
          id?: string
          kostenstelle?: string | null
          kunde_id?: string | null
          leistung_bis?: string | null
          leistung_von?: string | null
          leistungsort?: string | null
          name: string
          notizen?: string | null
          nvt?: string | null
          ort?: string | null
          plz?: string | null
          projektleiter?: string | null
          start_datum?: string | null
          status?: Database["public"]["Enums"]["projekt_status"]
          strasse?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          ag_sm_nr?: string | null
          ag_vertrags_nr?: string | null
          archiviert?: boolean
          beschreibung?: string | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          end_datum?: string | null
          esass_nr?: string | null
          hausnummer?: string | null
          id?: string
          kostenstelle?: string | null
          kunde_id?: string | null
          leistung_bis?: string | null
          leistung_von?: string | null
          leistungsort?: string | null
          name?: string
          notizen?: string | null
          nvt?: string | null
          ort?: string | null
          plz?: string | null
          projektleiter?: string | null
          start_datum?: string | null
          status?: Database["public"]["Enums"]["projekt_status"]
          strasse?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projekte_kunde_id_fkey"
            columns: ["kunde_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnung_gruppe_dokumente: {
        Row: {
          created_at: string
          created_by: string | null
          datei_name: string | null
          datei_pfad: string
          groesse: number | null
          id: string
          mime_type: string | null
          rechnung_gruppe_id: string
          titel: string
          typ: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datei_name?: string | null
          datei_pfad: string
          groesse?: number | null
          id?: string
          mime_type?: string | null
          rechnung_gruppe_id: string
          titel: string
          typ?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datei_name?: string | null
          datei_pfad?: string
          groesse?: number | null
          id?: string
          mime_type?: string | null
          rechnung_gruppe_id?: string
          titel?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "rechnung_gruppe_dokumente_rechnung_gruppe_id_fkey"
            columns: ["rechnung_gruppe_id"]
            isOneToOne: false
            referencedRelation: "rechnung_gruppen"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnung_gruppe_events: {
        Row: {
          created_at: string
          id: string
          included: boolean
          notes: string | null
          rechnung_gruppe_id: string
          sort_order: number
          zahlungsereignis_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          included?: boolean
          notes?: string | null
          rechnung_gruppe_id: string
          sort_order?: number
          zahlungsereignis_id: string
        }
        Update: {
          created_at?: string
          id?: string
          included?: boolean
          notes?: string | null
          rechnung_gruppe_id?: string
          sort_order?: number
          zahlungsereignis_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rechnung_gruppe_events_rechnung_gruppe_id_fkey"
            columns: ["rechnung_gruppe_id"]
            isOneToOne: false
            referencedRelation: "rechnung_gruppen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnung_gruppe_events_zahlungsereignis_id_fkey"
            columns: ["zahlungsereignis_id"]
            isOneToOne: false
            referencedRelation: "auftrag_zahlungsereignisse"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnung_gruppe_positionen: {
        Row: {
          betrag: number
          bezeichnung: string
          created_at: string
          created_by: string | null
          einzelpreis: number
          id: string
          menge: number
          notiz: string | null
          rechnung_gruppe_id: string
          sort_order: number
          typ: string
          updated_at: string
        }
        Insert: {
          betrag?: number
          bezeichnung: string
          created_at?: string
          created_by?: string | null
          einzelpreis?: number
          id?: string
          menge?: number
          notiz?: string | null
          rechnung_gruppe_id: string
          sort_order?: number
          typ?: string
          updated_at?: string
        }
        Update: {
          betrag?: number
          bezeichnung?: string
          created_at?: string
          created_by?: string | null
          einzelpreis?: number
          id?: string
          menge?: number
          notiz?: string | null
          rechnung_gruppe_id?: string
          sort_order?: number
          typ?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rechnung_gruppe_positionen_rechnung_gruppe_id_fkey"
            columns: ["rechnung_gruppe_id"]
            isOneToOne: false
            referencedRelation: "rechnung_gruppen"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnung_gruppen: {
        Row: {
          ag_bestell_nr: string | null
          ag_leb_nr: string | null
          auftraggeber_id: string | null
          created_at: string
          created_by: string | null
          custom_data: Json
          esass_nr: string | null
          id: string
          kostenstelle: string | null
          leistungsort: string | null
          leistungszeitraum_bis: string | null
          leistungszeitraum_von: string | null
          manuelle_anpassung: number
          name: string | null
          netto_manuell: number | null
          notes: string | null
          nummer: string
          nvt: string | null
          projekt_id: string | null
          projektleiter: string | null
          sm_nr: string | null
          status: string
          updated_at: string
          ust_prozent: number
        }
        Insert: {
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          auftraggeber_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          esass_nr?: string | null
          id?: string
          kostenstelle?: string | null
          leistungsort?: string | null
          leistungszeitraum_bis?: string | null
          leistungszeitraum_von?: string | null
          manuelle_anpassung?: number
          name?: string | null
          netto_manuell?: number | null
          notes?: string | null
          nummer: string
          nvt?: string | null
          projekt_id?: string | null
          projektleiter?: string | null
          sm_nr?: string | null
          status?: string
          updated_at?: string
          ust_prozent?: number
        }
        Update: {
          ag_bestell_nr?: string | null
          ag_leb_nr?: string | null
          auftraggeber_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_data?: Json
          esass_nr?: string | null
          id?: string
          kostenstelle?: string | null
          leistungsort?: string | null
          leistungszeitraum_bis?: string | null
          leistungszeitraum_von?: string | null
          manuelle_anpassung?: number
          name?: string | null
          netto_manuell?: number | null
          notes?: string | null
          nummer?: string
          nvt?: string | null
          projekt_id?: string | null
          projektleiter?: string | null
          sm_nr?: string | null
          status?: string
          updated_at?: string
          ust_prozent?: number
        }
        Relationships: [
          {
            foreignKeyName: "rechnung_gruppen_auftraggeber_id_fkey"
            columns: ["auftraggeber_id"]
            isOneToOne: false
            referencedRelation: "kunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnung_gruppen_projekt_id_fkey"
            columns: ["projekt_id"]
            isOneToOne: false
            referencedRelation: "projekte"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          beschreibung: string | null
          created_at: string
          farbe: string
          id: string
          is_system: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          beschreibung?: string | null
          created_at?: string
          farbe?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          beschreibung?: string | null
          created_at?: string
          farbe?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          action: string
          created_at: string
          details: Json
          email: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          email?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      status_definitionen: {
        Row: {
          aktiv: boolean
          ausschluss_kontakte_ohne_termin: boolean
          created_at: string
          farbe: string
          id: string
          ist_abschluss: boolean
          ist_bezahlt: boolean
          key: string
          label: string
          reihenfolge: number
          sichtbar_dashboard: boolean
          sichtbar_worker: boolean
          sperrt_bearbeitung: boolean
          updated_at: string
          worker_waehlbar: boolean
        }
        Insert: {
          aktiv?: boolean
          ausschluss_kontakte_ohne_termin?: boolean
          created_at?: string
          farbe?: string
          id?: string
          ist_abschluss?: boolean
          ist_bezahlt?: boolean
          key: string
          label: string
          reihenfolge?: number
          sichtbar_dashboard?: boolean
          sichtbar_worker?: boolean
          sperrt_bearbeitung?: boolean
          updated_at?: string
          worker_waehlbar?: boolean
        }
        Update: {
          aktiv?: boolean
          ausschluss_kontakte_ohne_termin?: boolean
          created_at?: string
          farbe?: string
          id?: string
          ist_abschluss?: boolean
          ist_bezahlt?: boolean
          key?: string
          label?: string
          reihenfolge?: number
          sichtbar_dashboard?: boolean
          sichtbar_worker?: boolean
          sperrt_bearbeitung?: boolean
          updated_at?: string
          worker_waehlbar?: boolean
        }
        Relationships: []
      }
      status_zugriff: {
        Row: {
          can_assign: boolean
          can_remove: boolean
          can_view: boolean
          created_at: string
          id: string
          role_id: string | null
          status_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_assign?: boolean
          can_remove?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          role_id?: string | null
          status_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_assign?: boolean
          can_remove?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          role_id?: string | null
          status_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_zugriff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_zugriff_status_key_fkey"
            columns: ["status_key"]
            isOneToOne: false
            referencedRelation: "status_definitionen"
            referencedColumns: ["key"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_id: string
          expires_at: string
          id: string
          label: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          expires_at: string
          id?: string
          label?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          expires_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      urlaub: {
        Row: {
          created_at: string
          created_by: string | null
          end_datum: string
          entschieden_am: string | null
          entschieden_von: string | null
          grund: string | null
          id: string
          mitarbeiter_id: string
          notiz: string | null
          start_datum: string
          status: string
          typ: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_datum: string
          entschieden_am?: string | null
          entschieden_von?: string | null
          grund?: string | null
          id?: string
          mitarbeiter_id: string
          notiz?: string | null
          start_datum: string
          status?: string
          typ?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_datum?: string
          entschieden_am?: string | null
          entschieden_von?: string | null
          grund?: string | null
          id?: string
          mitarbeiter_id?: string
          notiz?: string | null
          start_datum?: string
          status?: string
          typ?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "urlaub_mitarbeiter_id_fkey"
            columns: ["mitarbeiter_id"]
            isOneToOne: false
            referencedRelation: "mitarbeiter"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_settings: {
        Row: {
          config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_role_memberships: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: undefined }
      accept_self_invitation: { Args: never; Returns: Json }
      auftrag_gewinn_map: {
        Args: never
        Returns: {
          auftrag_id: string
          ausgaben: number
          gewinn: number
          umsatz: number
        }[]
      }
      auftrag_umsatz_map: {
        Args: never
        Returns: {
          auftrag_id: string
          umsatz: number
        }[]
      }
      can_edit_verguetung: { Args: never; Returns: boolean }
      can_view_document: { Args: { _doc: string }; Returns: boolean }
      can_view_verguetung: {
        Args: { _mitarbeiter_id: string }
        Returns: boolean
      }
      check_login_lock: { Args: { _email: string }; Returns: Json }
      cleanup_test_data: { Args: never; Returns: Json }
      current_permissions: {
        Args: never
        Returns: {
          permission_key: string
        }[]
      }
      ensure_mitarbeiter_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      get_branding: {
        Args: never
        Returns: {
          default_theme: Json
          default_theme_mode: string
          email_logo: string
          farbe_primary: string
          farbe_secondary: string
          favicon_dark: string
          favicon_light: string
          favicon_url: string
          firmenname: string
          full_logo_dark: string
          full_logo_light: string
          invoice_logo: string
          login_logo_dark: string
          login_logo_light: string
          logo_full_url: string
          logo_round_url: string
          logo_white_url: string
          mobile_logo_dark: string
          mobile_logo_light: string
          pdf_logo: string
          round_logo_dark: string
          round_logo_light: string
        }[]
      }
      get_firmenprofil_admin: {
        Args: never
        Returns: {
          bank: string | null
          bic: string | null
          created_at: string
          default_theme: Json | null
          default_theme_mode: string
          email: string | null
          email_logo: string | null
          farbe_primary: string
          farbe_secondary: string
          favicon_dark: string | null
          favicon_light: string | null
          favicon_url: string | null
          firmenname: string
          full_logo_dark: string | null
          full_logo_light: string | null
          iban: string | null
          id: string
          invoice_logo: string | null
          login_logo_dark: string | null
          login_logo_light: string | null
          logo_full_url: string | null
          logo_round_url: string | null
          logo_white_url: string | null
          mobile_logo_dark: string | null
          mobile_logo_light: string | null
          ort: string | null
          pdf_logo: string | null
          plz: string | null
          round_logo_dark: string | null
          round_logo_light: string | null
          steuernummer: string | null
          strasse: string | null
          telefon: string | null
          updated_at: string
          ust_idnr: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "firmenprofil"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          nachname: string
          valid: boolean
          vorname: string
        }[]
      }
      get_pending_invitation: {
        Args: { _email: string }
        Returns: {
          email: string
          nachname: string
          role_id: string
          telefon: string
          valid: boolean
          vorname: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_assigned_to_auftrag: {
        Args: { _auftrag_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      link_mitarbeiter_to_user: {
        Args: { _mitarbeiter_id: string; _user_id: string }
        Returns: undefined
      }
      log_activity: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _entity_id: string
          _entity_name: string
          _entity_type: string
        }
        Returns: undefined
      }
      record_login_attempt: {
        Args: {
          _action: string
          _email: string
          _ip?: string
          _user_agent?: string
        }
        Returns: undefined
      }
      setup_grant_owner_permissions: { Args: never; Returns: undefined }
      status_action_allowed: {
        Args: { _action: string; _status_key: string }
        Returns: boolean
      }
      system_needs_setup: { Args: never; Returns: boolean }
      zahlungsereignis_umsatz_map: {
        Args: never
        Returns: {
          ereignis_id: string
          positionen: Json
          umsatz: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "disponent" | "worker"
      auftrag_status:
        | "neu"
        | "geplant"
        | "zugewiesen"
        | "in_arbeit"
        | "warten"
        | "abgeschlossen"
        | "storniert"
      projekt_status: "aktiv" | "pausiert" | "abgeschlossen" | "archiviert"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "disponent", "worker"],
      auftrag_status: [
        "neu",
        "geplant",
        "zugewiesen",
        "in_arbeit",
        "warten",
        "abgeschlossen",
        "storniert",
      ],
      projekt_status: ["aktiv", "pausiert", "abgeschlossen", "archiviert"],
    },
  },
} as const
