"""Valideer docs/data/*.json en schrijf docs/data/manifest.json."""
import json, glob, os, collections
D = os.path.join(os.path.dirname(__file__), 'docs', 'data')
files = sorted(os.path.basename(f) for f in glob.glob(os.path.join(D, '[0-9][0-9].json')))
total = 0
for f in files:
    d = json.load(open(os.path.join(D, f), encoding='utf-8'))
    ids = set()
    pos = collections.Counter()
    for q in d['vragen']:
        assert len(q['opties']) == 4 and len(set(q['opties'])) == 4, q['id']
        assert 0 <= q['antwoord'] < 4, q['id']
        assert q['id'] not in ids, q['id']
        ids.add(q['id']); pos[q['antwoord']] += 1
    total += len(d['vragen'])
    print(f"{f}: {len(d['vragen']):3d} vragen  {d['titel']}  posities={dict(sorted(pos.items()))}")
extra = [
    {"titel": "ORE v2.1 (vorige versie)", "href": "bronnen/ertms-operationele-regels-versie-2-1.pdf"},
    {"titel": "Cluster ERTMS/ETCS nov 2025 (vorige versie)", "href": "bronnen/11-nov-25-cluster-ertms-etcs.pdf"},
    {"titel": "Wijzigingsdocument vakkennis mei 2026", "href": "bronnen/exam-vak-20260501-wijzigingsdocument-vakkennis.pdf"},
    {"titel": "Wijzigingsdocument ERTMS/ETCS per 1 okt 2026", "href": "bronnen/exam-vak-20260612-wijzigingsdocument-vakkennis-ertms.pdf"},
    {"titel": "Alle clusters gecombineerd mei 2026 (vvrv.nl)", "href": "https://vvrv.nl/uploads/files/page/mei-26-alle-clusters-gecombineerd.pdf"},
]
sets = sorted('oefensets/' + os.path.basename(f) for f in glob.glob(os.path.join(D, 'oefensets', '*.json')))
for f in sets:
    d = json.load(open(os.path.join(D, f), encoding='utf-8'))
    ids = set()
    pos = collections.Counter()
    for q in d['vragen']:
        assert len(q['opties']) == 4 and len(set(q['opties'])) == 4, q['id']
        assert 0 <= q['antwoord'] < 4, q['id']
        assert q['id'] not in ids, q['id']
        ids.add(q['id']); pos[q['antwoord']] += 1
    total += len(d['vragen'])
    print(f"{f}: {len(d['vragen']):3d} vragen  {d['titel']}  posities={dict(sorted(pos.items()))}")
exams = sorted('examens/' + os.path.basename(f) for f in glob.glob(os.path.join(D, 'examens', '*.json')))
for f in exams:
    d = json.load(open(os.path.join(D, f), encoding='utf-8'))
    ids = set()
    pos = collections.Counter()
    eisen = collections.Counter()
    for q in d['vragen']:
        assert len(q['opties']) == 4 and len(set(q['opties'])) == 4, q['id']
        assert 0 <= q['antwoord'] < 4, q['id']
        assert q['id'] not in ids, q['id']
        assert q['eis'].split('.')[0] in d['eisen'], q['id']
        ids.add(q['id']); pos[q['antwoord']] += 1; eisen[q['eis'].split('.')[0]] += 1
    print(f"{f}: {len(d['vragen']):3d} vragen  {d['titel']}  eisen={dict(eisen)}  posities={dict(sorted(pos.items()))}")
json.dump({"oefensets": sets, "clusters": files, "examens": exams, "extra": extra}, open(os.path.join(D, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('totaal', total)
