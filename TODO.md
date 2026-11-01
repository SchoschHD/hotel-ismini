# Noch zu erledigen

## Sofort: SMTP absichern

- [ ] Das alte Gmail-/SMTP-Passwort endgültig widerrufen.
- [ ] Prüfen, ob beim SMTP-Anbieter noch Nachrichten in einer Warteschlange liegen.
- [ ] Ein separates Gmail-App-Passwort erstellen oder SMTP bis zur Fertigstellung deaktiviert lassen.
- [ ] Sicherstellen, dass `.env` niemals committet oder öffentlich geteilt wird.

## Schutz vor Buchungsbots

- [ ] Cloudflare Turnstile für die echte Produktionsdomain einrichten.
- [ ] `TURNSTILE_SECRET_KEY` nur in `.env` hinterlegen.
- [ ] Turnstile-Token serverseitig vor dem Speichern der Buchung prüfen.
- [ ] Honeypot-Feld in das Buchungsformular einbauen und serverseitig validieren.
- [ ] Fehlermeldungen für abgelehnte Bot-Anfragen testen.
- [ ] Rate-Limits in der Produktionsumgebung prüfen:
  - [ ] `BOOKING_RATE_LIMIT_MAX`
  - [ ] `BOOKING_GLOBAL_RATE_LIMIT_MAX`
  - [ ] `BOOKING_EMAIL_RATE_LIMIT_MAX`
- [ ] Bei einem Reverse Proxy `TRUST_PROXY` korrekt konfigurieren, damit IP-Limits nicht umgangen werden.

## E-Mail-Versand

- [ ] E-Mail-Versand von der Buchung entkoppeln.
- [ ] Eine Versandwarteschlange mit maximaler Versandmenge pro Minute einbauen.
- [ ] Fehlgeschlagene E-Mails kontrolliert wiederholen, aber ohne Endlosschleife.
- [ ] E-Mail-Versand mit einer echten Testadresse und deaktiviertem SMTP für Bot-Tests prüfen.
- [ ] Niemals Testadressen wie `anna@example.com` für echte Zustelltests verwenden.

## Buchungsprozess

- [ ] Optional: Buchung erst nach Bestätigung der E-Mail-Adresse endgültig bestätigen.
- [ ] Doppelte Buchungen und wiederholte Formularübermittlungen mit einer Request-ID verhindern.
- [ ] Erfolgreiche, abgelehnte und blockierte Buchungen im Admin-Bereich sichtbar machen.

## Tests und Produktion

- [ ] Tests für Turnstile, Honeypot und globale Rate-Limits ergänzen.
- [ ] Mit verschiedenen IPs und E-Mail-Adressen prüfen, dass das globale Limit greift.
- [ ] Produktionsdaten, Preise, Zimmer, Empfängeradresse und Domain ersetzen.
- [ ] Datenbank-Backups und Wiederherstellung testen.
- [ ] Fehlerüberwachung und Benachrichtigungen für SMTP-Fehler einrichten.
- [ ] Vor dem Livegang `npm test` ausführen und die Sicherheitskonfiguration dokumentieren.
