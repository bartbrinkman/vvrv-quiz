# Vakkennis Machinist – oefenvragen

Moeilijke meerkeuzevragen (4 opties, Nederlands) om te oefenen voor het VVRV-examen **vakkennis machinist vergunning**, gebaseerd op het bronmateriaal van
<https://vvrv.nl/vakkennis/vakkennis-machinist-vergunning>.

**Oefenen:** https://bartbrinkman.github.io/vvrv-quiz/

## Functies
- Mobile first, werkt offline-vriendelijk als statische site (GitHub Pages).
- **Proefexamen theorie deel 1**: vaste set van 80 vragen over vakbekwaamheidseisen I–III (ATB/seinstelsel '54), 90 minuten, cesuur 80%, terugbladeren mogelijk, uitslag per eis.
- **Oefenset theorie deel 1**: 40 losse vragen (één feit per vraag, geen stellingen) over eisen I–III, te kiezen in de clusterlijst.
- Modi: **Oefenen** (directe feedback + uitleg + bronverwijzing), **Examen** (tijdslimiet, uitslag aan het eind), **Fouten** (herhaal fout beantwoorde of gemarkeerde vragen).
- Kies clusters en aantal vragen; antwoordvolgorde wordt elke keer geschud.
- Voortgang wordt lokaal in je browser bewaard.

## Inhoud
| Map | Inhoud |
|---|---|
| `docs/` | De website (`index.html`, `app.js`, `style.css`) |
| `docs/data/` | Vragen per cluster (JSON) + `manifest.json` |
| `docs/data/oefensets/` | Oefensets die als extra keuze bovenaan de clusterlijst staan |
| `docs/data/examens/` | Proefexamens (vaste vragensets met tijd, norm en eis per vraag) |
| `docs/bronnen/` | Gedownloade PDF's van vvrv.nl |
| `tekst/` | Uit de PDF's geëxtraheerde tekst |

Clusters 01–10, cluster 11 ERTMS/ETCS (versie per 1 oktober 2026) en de Operationele Regels ERTMS (ORE v2.2).

Na het aanpassen van vragen: `python build_manifest.py` (valideert en schrijft het manifest).

## Disclaimer
Onofficieel. Niet opgesteld of gecontroleerd door VVRV. De vragen zijn met AI gegenereerd uit de vakkennis en kunnen fouten bevatten; bij twijfel geldt altijd de tekst van de vakkennis. Het bronmateriaal is © VVRV.
