"""scratchpad의 schools_part1..4.json(에이전트 조사 결과)을 data/schools.json으로 병합. 원본 102교 순서·이름과 대조."""
import json, os
SCRATCH = r"C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Documents-claude-navi\643ea7b9-3c7b-4214-ae8a-de344f7ef1f9\scratchpad"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = json.load(open(os.path.join(SCRATCH, "schools_base.json"), encoding="utf-8"))
found = {}
for i in range(1, 5):
    p = os.path.join(SCRATCH, f"schools_part{i}.json")
    if not os.path.exists(p):
        print("missing", p); continue
    for r in json.load(open(p, encoding="utf-8-sig")):
        found[r["name"]] = r
out, missing, low, notes = [], [], [], []
for b in base:
    r = found.get(b["name"], {})
    hp = (r.get("homepage") or "").strip()
    out.append({"name": b["name"], "office": b["office"], "homepage": hp})
    if not hp: missing.append(b["name"])
    elif r.get("confidence") != "high": low.append((b["name"], hp, r.get("note", "")))
    if r.get("note"): notes.append((b["name"], r["note"]))
json.dump(out, open(os.path.join(ROOT, "data", "schools.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"total {len(out)}, with homepage {len(out)-len(missing)}, missing {missing}")
print("non-high:", low)
print("notes:", len(notes))
for n in notes: print(" -", n[0], ":", n[1][:120])
