# Contentmodel — Kroatisch leerplatform

Dit is het dataformaat waarin de content uit *Hrvatski za početnike 1* (udžbenik + vježbenica)
wordt gestructureerd. Doel: content kan groeien zonder dat de app herbouwd hoeft te worden.

## Bestandsindeling

```
content/
  syllabus.json          # syllabusmap van alle 21 broneenheden + bronmetadata
  lessons/
    lesson-01.json       # één bestand per les
    lesson-02.json
    ...
```

Alles is losse data. De app leest deze bestanden bij het seeden van de database in.
Nieuwe lessen toevoegen = een JSON-bestand toevoegen; geen codewijziging.

## Drie itemtypen — alle drie apart gepland door de SRS

| Type | Wat het is | Voorbeeld-id |
|---|---|---|
| `vocab` | Woord of vaste uitdrukking | `v.01.kuca` |
| `grammar` | Grammaticapunt (regel, paradigma) | `g.biti.present.short` |
| `form` | Eén specifieke verbogen vorm | `f.kuca.acc.sg` |

`form`-items zijn de sleutel tot het naamvallenprobleem: het systeem leert niet "kuća" als
één brok, maar houdt per naamval-vorm apart bij hoe stevig die zit. Zo kan het dashboard
tonen "je accusatief zit goed, je locatief lekt" in plaats van alleen "80% van de woorden".

## Vocab-item

```jsonc
{
  "id": "v.01.kuca",
  "hr": "kuća",
  "nl": "huis",
  "pos": "noun",              // noun | verb | adj | adv | pron | prep | num | phrase | interj
  "gender": "f",              // m | f | n  (alleen bij noun)
  "animacy": "inanimate",     // animate | inanimate (bepaalt accusatiefvorm bij m)
  "declension": "a",          // a (o-stam) | e (a-stam) | i (i-stam)
  "gen_sg": "kuće",           // stamcontrole: onthult vluchtige a, sibilarisatie enz.
  "nom_pl": "kuće",
  "aspect": null,             // perfective | imperfective (alleen bij verb)
  "pair": null,               // aspectpartner, bv. "kupovati" ↔ "kupiti"
  "present_1sg": null,        // alleen bij verb
  "verb_class": null,         // -ati | -iti | -jeti | -ovati | -irati | onregelmatig
  "tags": ["huis", "les-01"],
  "frequency_rank": 412,      // optioneel, voor prioritering
  "source": "udzbenik p.27"
}
```

## Grammar-item

```jsonc
{
  "id": "g.biti.present.short",
  "title_nl": "biti — korte vorm (sam, si, je ...)",
  "cefr": "A1.1",
  "explanation_nl": "Korte uitleg, max ~120 woorden, in het Nederlands.",
  "contrast_nl": "Expliciete vergelijking met het Nederlands — waar zit de val?",
  "paradigm": {
    "caption_nl": "biti — presens, onbeklemtoond",
    "columns": ["jednina", "množina"],
    "rows": [
      { "label": "1.", "cells": ["ja sam", "mi smo"] }
    ]
  },
  "pitfalls_nl": ["Concrete fouten die een Nederlandstalige hier maakt."],
  "prerequisites": [],
  "source": "udzbenik p.22"
}
```

## Exercise-item

```jsonc
{
  "id": "e.01.014",
  "type": "cloze",
  "mode": "productive",        // receptive | productive  (bepaalt XP en SRS-gewicht)
  "prompt_nl": "Vul de juiste vorm van biti in.",
  "given": "Ana ___ studentica.",
  "hint": null,
  "answer": "je",
  "accepts": ["je"],           // alle goedgekeurde antwoorden
  "distractors": [],           // alleen bij multiple choice
  "explain_nl": "3e persoon enkelvoud, onbeklemtoonde vorm.",
  "targets": ["g.biti.present.short"],   // welke items dit oefent → voedt de SRS
  "difficulty": 1,             // 1-5
  "audio": "Ana je studentica.",         // tekst die TTS uitspreekt
  "source": "vježbenica p.12"
}
```

### Oefentypen

| `type` | `mode` | Wat de leerder doet |
|---|---|---|
| `teaching_moment` | — | Leest korte theorie op het juiste moment (geen scoring) |
| `match` | receptive | Koppelt HR aan NL |
| `choice` | receptive | Kiest de juiste vorm uit opties |
| `cloze` | productive | Typt de juiste naamval/vervoeging in |
| `translate_nl_hr` | productive | Vertaalt naar het Kroatisch |
| `translate_hr_nl` | receptive | Vertaalt naar het Nederlands |
| `word_order` | productive | Zet losse woorden in de juiste volgorde |
| `listen_type` | productive | Typt wat via TTS te horen is |
| `error_correction` | productive | Vindt en verbetert de fout in een zin |
| `free_production` | productive | Beantwoordt een vraag vrij in het Kroatisch |

`productive` levert meer XP en telt zwaarder in de SRS dan `receptive` — herkennen is
makkelijker dan produceren, en het platform moet dat verschil niet wegpoetsen.

## Les-bestand

```jsonc
{
  "id": "lesson-01",
  "number": 1,
  "title_hr": "Dobro došli!",
  "title_nl": "Welkom!",
  "cefr": "A1.1",
  "source": { "udzbenik_pages": "19-30", "vjezbenica_pages": "11-14" },
  "can_do_nl": ["Ik kan iemand groeten en afscheid nemen."],
  "grammar": [ /* grammar-items */ ],
  "vocab":   [ /* vocab-items */ ],
  "sections": [
    {
      "id": "s.01.1",
      "title_nl": "Groeten",
      "kind": "input",         // input | grammar | practice | mixed_review
      "text_hr": "…",          // dialoog of tekst uit het boek (comprehensible input)
      "translation_nl": "…",
      "exercises": [ /* exercise-items */ ]
    }
  ]
}
```

De sectievolgorde binnen een les is altijd: **input → grammar → practice → mixed_review**.
De `mixed_review`-sectie bevat oefeningen die `targets` uit eerdere lessen aanspreken —
daar zit het interleaving.

## Herkomst en betrouwbaarheid

Elk item draagt een `source`-veld met boekpagina. Items die niet uit de PDF's komen maar
zijn aangevuld (paradigma's, Nederlandse vertalingen, uitleg) krijgen `"source": "aangevuld"`.
Zo blijft zichtbaar wat brondata is en wat redactie.
