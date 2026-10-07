#!/usr/bin/env python3
"""Prepare src/data/taxonomy.json for the Climate Taxonomy v5 Explorer.

Reads the read-only clone of github.com/Mlolita26/cgiar-climate-taxonomy and writes ONE compact
JSON file for the app. Standard library only. Re-runnable. Fails loudly when the sanity counts
differ from the expected values or when the privacy audit finds a forbidden string.

Usage:  python3 scripts/prepare-data.py --src <path-to-local-clone>
        (or set TAXONOMY_SRC=<path-to-local-clone>)
"""
import argparse, csv, json, os, re, subprocess, sys, collections
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "src", "data", "taxonomy.json")
EXPECTED_COMMIT = "2f867a0"
REPO_URL = "https://github.com/Mlolita26/cgiar-climate-taxonomy"
SITE_URL = "https://mlolita26.github.io/cgiar-climate-taxonomy/"

EXPECT = {
    "concepts": 739, "top_level": 306,
    "levels": {1: 306, 2: 240, 3: 99, 4: 71, 5: 21, 6: 2},
    "facets": {"Intervention": 256, "System": 114, "Output": 98, "Climate risk": 70, "Outcome": 69,
               "Stakeholder": 67, "Cross-cutting concept": 27, "Climate driver": 19, "Breeding trait": 9,
               "Impact": 5, "Adoption pathway": 5},
    "scope": {"Adaptation": 630, "Mitigation": 68, "Adaptation + Mitigation": 41},
    "domains": 17, "impact_areas": 6, "pathway_stages": 8,
    "synonyms": 982, "concepts_with_synonyms": 592,
    "concepts_with_relations": 162, "edges": 300, "with_example": 157,
    "term_changes": 782, "synonym_changes": 400, "retired": 23, "dna": 500, "fair": 10, "decisions": 1,
    "term_change_types": {"DEFINITION CHANGED": 219, "LEVEL CHANGED": 174, "ADDED": 128, "RE-PARENTED": 99,
                          "DESCRIPTOR CHANGED": 95, "RENAMED": 27, "SOURCE CHANGED": 21, "RETIRED": 15,
                          "FACET CHANGED": 4},
}

ID_RE = re.compile(r"\b(?:CRK|CDI|SYS|INT|OUT|OTC|IMP|ADP|TRT|STK|CCC)_\d+\b")

# ---------------------------------------------------------------- privacy scrubbing
# Free-text working notes in the change log and register name people and refer to messages.
# The explorer shows roles instead of names. Personal names are NOT hard-coded here: they are
# derived from the source files themselves (see build_scrubber): the decider column of the
# decision log (custodian) and the single-word person entries of the provenance map that map to
# the "Domain expert" class.
CHANNEL = r"(?:e-?mails?|slack|chats?|calls?|meetings?|transcripts?|teams)"
SCRUB = []
NAME_RE = None


def build_scrubber(prov_map, decisions):
    global SCRUB, NAME_RE
    roles = {}
    for r in decisions:
        m = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", r.get("decided_by", ""))
        if m:
            for tok in re.findall(r"[A-Z][a-z]+", m.group(1)):
                roles[tok] = m.group(2).strip().lower()
    for prov, classes in prov_map.items():
        if re.fullmatch(r"[A-Z][a-z]+", prov) and classes == ["Domain expert"]:
            roles.setdefault(prov, "domain expert")
    if not roles:
        fail("could not derive the person names to scrub")
    alt = "|".join(sorted(map(re.escape, roles), key=len, reverse=True))
    role_of = lambda m: roles[m.group("n")]
    SCRUB = [
        # a parenthetical that cites a message channel keeps only its first clause
        (re.compile(r"\(([^(),;]*?)\s*,[^()]*\b" + CHANNEL + r"\b[^()]*\)", re.I), lambda m: "(" + m.group(1).strip() + ")"),
        (re.compile(r"(?P<n>" + alt + r") (?P<d>\d{4}-\d{2}): "), lambda m: f"{role_of(m).capitalize()} ({m.group('d')}): "),
        (re.compile(r"^(?P<n>" + alt + r"): "), lambda m: role_of(m).capitalize() + ": "),
        (re.compile(r"\b(?P<n>" + alt + r")'s decision\b"), lambda m: f"{role_of(m).capitalize()}'s decision"),
        (re.compile(r"\b(?P<n>" + alt + r")'s\b"), lambda m: f"the {role_of(m)}'s"),
        (re.compile(r"\b(?P<n>" + alt + r")\b"), lambda m: f"the {role_of(m)}"),
        (re.compile(r"\bthe (domain expert|custodian) the (domain expert|custodian)\b"), r"the \1"),
        (re.compile(r"\braising with her\b"), "raising with the domain expert"),
        (re.compile(r"\bher ([\w-]+ )?list\b"), lambda m: f"the domain expert's {m.group(1) or ''}list"),
        # FAIR checklist: "... after the <event>" -> "... as a later step"
        (re.compile(r"\bafter the [\w-]+$"), "as a later step"),
    ]
    NAME_RE = re.compile(r"\b(" + alt + r")\b")


def scrub(s):
    if not s:
        return s
    for rx, rep in SCRUB:
        s = rx.sub(rep, s)
    # sentence-initial role words get a capital letter
    s = re.sub(r"(^|[.!?]\s+)(the|a) (domain expert|custodian)", lambda m: m.group(1) + m.group(2).capitalize() + " " + m.group(3), s)
    return s


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:  # utf-8-sig strips the BOM
        return list(csv.DictReader(f))


def fail(msg):
    print(f"\nFAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def check(label, got, want):
    ok = got == want
    print(f"  {'ok ' if ok else 'XX '} {label}: {got}" + ("" if ok else f"   (expected {want})"))
    if not ok:
        fail(f"sanity count '{label}' is {got}, expected {want}")


# ---------------------------------------------------------------- definition source families
def source_family(src):
    """Normalise a definition_source string (first-listed source) to (family, subfamily)."""
    s = (src or "").strip()
    if not s:
        return ("CGIAR (no external source)", "Blank")
    first = re.split(r";", s)[0].strip()
    f = first.lower()
    if "agrovoc" in f:
        return ("AGROVOC", "AGROVOC")
    if f.startswith("ipcc") or "ipcc" in f.split(" ")[0]:
        if "wgiii" in f: return ("IPCC", "IPCC AR6 WGIII")
        if "wgii" in f: return ("IPCC", "IPCC AR6 WGII")
        if "wgi" in f: return ("IPCC", "IPCC AR6 WGI")
        if "srocc" in f or "srccl" in f or "sr1.5" in f: return ("IPCC", "IPCC special reports")
        if "guidelines" in f or "wetlands supplement" in f or "2006" in f or "2013" in f: return ("IPCC", "IPCC inventory guidelines")
        if "ar6" in f: return ("IPCC", "IPCC AR6 glossary / other")
        return ("IPCC", "IPCC (other)")
    if re.match(r"^(cgiar portfolio (output|activity) category|cgiar partnership category|portfolio category|actor category|capacity-development modality)", f):
        return ("CGIAR (no external source)", first.split(":")[0].strip())
    if f.startswith("unfccc"): return ("UNFCCC", "UNFCCC")
    if f.startswith("fao") or f.startswith("un/fao") or f.startswith("codex"): return ("FAO", "FAO")
    if f.startswith("wmo") or f.startswith("cgiar/wmo"): return ("WMO", "WMO")
    if f.startswith("world bank"): return ("World Bank", "World Bank")
    if f.startswith("oecd"): return ("OECD", "OECD")
    if re.match(r"^(cgiar|cimmyt|ilri|irri|bioversity|world agroforestry|harvestplus|agledx|align)", f):
        return ("CGIAR research & centres", first.split(":")[0].strip())
    if re.search(r"\bet al\.|literature", f):
        return ("Academic literature", "Academic literature")
    if re.match(r"^(undrip|un\b|un-|un/|undp|undrr|unccd|cbd|convention on biological|ilo|who|ifad|itpgrfa|nagoya|cartagena|ramsar|sendai|sdg|unece|un convention|unep|unesco|un decade|iucn|ifrc|green climate fund|iea|mea\b)", f):
        return ("UN system & conventions", first.split(":")[0].strip())
    return ("Other", first.split(":")[0].strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.environ.get("TAXONOMY_SRC"), help="local clone of the custodians' repository")
    args = ap.parse_args()
    src = args.src
    if not src or not os.path.isdir(src):
        fail("pass --src <path-to-local-clone> or set TAXONOMY_SRC (clone of " + REPO_URL + ")")
    S = lambda *p: os.path.join(src, *p)

    try:
        commit = subprocess.check_output(["git", "-C", src, "rev-parse", "--short=7", "HEAD"], text=True).strip()
        commit_date = subprocess.check_output(["git", "-C", src, "log", "-1", "--format=%cI"], text=True).strip()
    except Exception as e:
        fail(f"cannot read git commit of {src}: {e}")
    print(f"Source clone @ {commit} ({commit_date})")
    if commit != EXPECTED_COMMIT:
        fail(f"source commit is {commit}, expected {EXPECTED_COMMIT}")

    raw = json.load(open(S("source", "taxonomy_v5.json"), encoding="utf-8"))
    meta, cv, concepts = raw["meta"], raw["controlled_vocab"], raw["concepts"]

    # ---- controlled values (definitions for legends/tooltips)
    cvals = collections.defaultdict(dict)
    for r in read_csv(S("source", "master_v5_controlled_values.csv")):
        cvals[r["Column"]][r["Value"]] = r["Definition"]

    def camel_to_kebab(s):
        return re.sub(r"([a-z])([A-Z])", lambda m: m.group(1) + "-" + m.group(2).lower(), s)

    rel_defs = {}
    for r in read_csv(S("source", "relation_definitions.csv")):
        rel_defs[camel_to_kebab(r["prop"])] = r["comment"]
    for k, v in cvals.get("Related IDs (relation)", {}).items():
        if not k.startswith("<"):
            rel_defs.setdefault(k, v)

    prov_map = {}
    for r in read_csv(S("source", "provenance_map.csv")):
        prov_map[r["provenance"]] = [x.strip() for x in r["prov_class"].split(";") if x.strip()]

    by_id = {c["id"]: c for c in concepts}

    # ---- children, paths
    children = collections.defaultdict(list)
    for c in concepts:
        if c["parent_id"]:
            if c["parent_id"] not in by_id:
                fail(f"{c['id']} has unknown parent {c['parent_id']}")
            children[c["parent_id"]].append(c["id"])

    def path_of(cid):
        p, seen = [], set()
        cur = by_id[cid]["parent_id"]
        while cur:
            if cur in seen:
                fail(f"cycle in parent chain at {cid}")
            seen.add(cur)
            p.append(cur)
            cur = by_id[cur]["parent_id"]
        return list(reversed(p))

    # ---- relations (typed edges only)
    out_rels, in_rels = collections.defaultdict(list), collections.defaultdict(list)
    edges = []
    for c in concepts:
        for r in c["relations"]:
            if not r.get("typed"):
                continue
            if not r.get("target_exists", True) or r["target"] not in by_id:
                print(f"  note: {c['id']} -> {r['target']} target missing; skipped")
                continue
            edges.append((c["id"], r["type"], r["target"]))
            out_rels[c["id"]].append({"t": r["type"], "to": r["target"]})
            in_rels[r["target"]].append({"t": r["type"], "from": c["id"]})
    rel_types_used = sorted({e[1] for e in edges})
    for t in rel_types_used:
        if t not in rel_defs:
            fail(f"relation type '{t}' has no definition")

    # ---- concepts out
    out_concepts = []
    unmapped_prov = set()
    for c in concepts:
        prov_raw = (c.get("provenance") or {}).get("source") or ""
        classes = prov_map.get(prov_raw)
        if classes is None:
            unmapped_prov.add(prov_raw)
            classes = []
        path = path_of(c["id"])
        root = path[0] if path else c["id"]
        fam, sub = source_family(c["definition_source"])
        refs = [u.strip() for u in re.split(r"[;\s]+", c.get("reference_urls") or "") if u.strip().startswith("http")]
        out_concepts.append({
            "id": c["id"], "label": c["term"], "syn": c["synonyms"] or [],
            "facet": c["facet"], "level": c["level"], "parent": c["parent_id"],
            "children": children.get(c["id"], []), "path": path, "root": root,
            "rootFacet": by_id[root]["facet"],
            "def": c["definition"] or "", "defSrc": c["definition_source"] or "",
            "srcFamily": fam, "srcSub": sub,
            "stage": c["pathway_stage"], "scope": c["climate_scope"], "domain": c["domain"], "impact": c["impact_area"],
            "aTag": c["adaptation"]["tag"], "aCond": c["adaptation"]["condition"],
            "mTag": c["mitigation"]["tag"], "mCond": c["mitigation"]["condition"],
            "rels": out_rels.get(c["id"], []), "inRels": in_rels.get(c["id"], []),
            "prov": classes,
            "example": c.get("cgiar_example") or "", "refs": refs,
            "group": c["derived"]["group"], "anchorA": c["derived"]["is_anchor_adaptation"],
            "hazard": c["derived"]["is_hazard"], "anchorM": c["derived"]["is_anchor_mitigation"],
        })
    if unmapped_prov:
        fail(f"provenance strings without a class in provenance_map.csv: {sorted(unmapped_prov)}")

    # ---- side tables
    term_changes = read_csv(S("source", "v4_to_v5_TERM_CHANGES.csv"))
    syn_changes = read_csv(S("source", "v4_to_v5_SYNONYM_CHANGES.csv"))
    retired = read_csv(S("source", "v5_retired_ids.csv"))
    dna = read_csv(S("source", "DO_NOT_ADD_register.csv"))
    fair = read_csv(S("source", "fair_checklist.csv"))
    decisions = read_csv(S("governance", "decisions.csv"))
    build_scrubber(prov_map, decisions)

    def prov_value(v):
        v = (v or "").strip()
        if v in prov_map:
            return "; ".join(prov_map[v])
        return v

    changes_out = []
    for r in term_changes:
        v4, v5 = r["value in v4"].strip(), r["value in v5"].strip()
        if r["field changed"] == "Source":  # raw provenance strings -> controlled classes
            v4, v5 = prov_value(v4), prov_value(v5)
        changes_out.append({
            "type": r["change"], "id": r["ID"], "label": r["term"], "facet": r["facet"], "level": r["level (v5)"],
            "parent": r["parent (v5)"], "field": r["field changed"], "v4": scrub(v4), "v5": scrub(v5),
            "why": scrub(r["why"]),
        })
    syn_out = [{
        "type": r["change"], "syn": r["synonym"], "fromId": r["from ID (v4)"], "fromLabel": r["from term (v4)"],
        "toId": r["to ID (v5)"], "toLabel": r["to term (v5)"], "why": scrub(r["why"]),
    } for r in syn_changes]
    retired_out = []
    for r in retired:
        succ_ids = [i for i in ID_RE.findall(r["successor"]) if i in by_id]
        retired_out.append({"id": r["ID"], "label": r["Term"], "facet": r["Facet"], "successor": r["successor"],
                            "successorIds": succ_ids, "reason": scrub(r["reason"])})
    dna_out = []
    for r in dna:
        st = r["status_in_v5_today"]
        dna_out.append({"word": r["word_or_ID"], "type": r["exclusion_type"], "date": r["date"],
                        "reason": scrub(r["reason"]), "status": st,
                        "statusIds": [i for i in ID_RE.findall(st) if i in by_id]})  # decided_by omitted on purpose
    fair_out = []
    for r in fair:
        m = re.match(r"^(Yes|Pending|Proposed|No)\s*:\s*(.*)$", r["status"])
        state, text = (m.group(1), m.group(2)) if m else ("", r["status"])
        fair_out.append({"principle": r["principle"], "test": r["test"], "state": state, "text": scrub(text)})
    dec_out = []
    for r in decisions:
        role = re.search(r"\(([^)]+)\)", r.get("decided_by", ""))
        dec_out.append({"date": r["date"], "issue": r["issue"], "kind": r["kind"], "proposal": r["proposal"],
                        "decision": r["decision"], "reason": scrub(r["reason"]), "redirect": scrub(r["redirect"]),
                        "change": r["vocabulary_change"], "decidedByRole": role.group(1) if role else "custodian"})

    # ---- vocab with definitions
    def with_defs(col, values):
        return [{"name": v, "def": cvals.get(col, {}).get(v, "")} for v in values]

    vocab = {
        "facets": with_defs("Facet", cv["facets"]),
        "levels": with_defs("Level", cv["levels"]),
        "pathwayStages": with_defs("Pathway stage", cv["pathway_stage"]),
        "scopes": with_defs("Climate scope", cv["climate_scope"]),
        "adaptationTags": with_defs("Adaptation tag", cv["adaptation_tag"]),
        "mitigationTags": with_defs("Mitigation tag", cv["mitigation_tag"]),
        "domains": with_defs("Domain", cv["domain"]),
        "impactAreas": with_defs("Impact area", cv["impact_area"]),
        "relationTypes": [{"name": t, "def": rel_defs[t]} for t in rel_types_used],
        "provClasses": sorted({x for v in prov_map.values() for x in v}),
    }

    # ---- sanity checks
    print("\nSanity checks")
    check("concepts", len(out_concepts), EXPECT["concepts"])
    check("top-level concepts", sum(1 for c in out_concepts if not c["parent"]), EXPECT["top_level"])
    check("levels", dict(sorted(collections.Counter(c["level"] for c in out_concepts).items())), EXPECT["levels"])
    check("facets", dict(collections.Counter(c["facet"] for c in out_concepts)), EXPECT["facets"])
    check("climate scope", dict(collections.Counter(c["scope"] for c in out_concepts)), EXPECT["scope"])
    check("domains used", len({c["domain"] for c in out_concepts}), EXPECT["domains"])
    check("impact areas used", len({c["impact"] for c in out_concepts}), EXPECT["impact_areas"])
    check("pathway stages used", len({c["stage"] for c in out_concepts}), EXPECT["pathway_stages"])
    check("synonyms", sum(len(c["syn"]) for c in out_concepts), EXPECT["synonyms"])
    check("concepts with synonyms", sum(1 for c in out_concepts if c["syn"]), EXPECT["concepts_with_synonyms"])
    check("concepts with typed relations", sum(1 for c in out_concepts if c["rels"]), EXPECT["concepts_with_relations"])
    check("typed edges", len(edges), EXPECT["edges"])
    check("typed edges (meta)", meta["n_edges"], EXPECT["edges"])
    check("concepts with a CGIAR example", sum(1 for c in out_concepts if c["example"].strip()), EXPECT["with_example"])
    check("term changes", len(changes_out), EXPECT["term_changes"])
    check("term change types", dict(collections.Counter(c["type"] for c in changes_out)), EXPECT["term_change_types"])
    check("synonym changes", len(syn_out), EXPECT["synonym_changes"])
    check("retired ids", len(retired_out), EXPECT["retired"])
    check("DO-NOT-ADD rows", len(dna_out), EXPECT["dna"])
    check("FAIR rows", len(fair_out), EXPECT["fair"])
    check("governance decisions", len(dec_out), EXPECT["decisions"])
    check("every facet is a known facet", all(c["facet"] in cv["facets"] for c in out_concepts), True)
    nodes = {e[0] for e in edges} | {e[2] for e in edges}
    print(f"  ..  network nodes (sources + targets): {len(nodes)}")
    print(f"  ..  max depth: {max(c['level'] for c in out_concepts)}")
    fam = collections.Counter(c["srcFamily"] for c in out_concepts)
    print(f"  ..  definition source families: {dict(fam.most_common())}")
    print(f"  ..  AGROVOC anywhere in source: {sum(1 for c in out_concepts if 'AGROVOC' in c['defSrc'])}; AGROVOC first-listed: {fam['AGROVOC']}")
    pc = collections.Counter(x for c in out_concepts for x in c["prov"])
    print(f"  ..  provenance classes: {dict(pc)}")
    print(f"  ..  cross-facet parent links: {sum(1 for c in out_concepts if c['parent'] and by_id[c['parent']]['facet'] != c['facet'])}")

    data = {
        "meta": {
            "title": "CGIAR Climate Adaptation and Mitigation Taxonomy",
            "version": "5.0.0-draft", "versionDate": "2026-09-23", "contentBuiltAt": meta["built_at"],
            "sourceCommit": commit, "sourceCommitDate": commit_date, "repo": REPO_URL, "site": SITE_URL,
            "preparedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "validation": {"errors": len(raw["validation"]["errors"]), "warnings": len(raw["validation"]["warnings"]),
                           "info": len(raw["validation"]["info"])},
        },
        "vocab": vocab, "concepts": out_concepts,
        "changes": changes_out, "synChanges": syn_out, "retired": retired_out,
        "dna": dna_out, "fair": fair_out, "decisions": dec_out,
    }

    # ---- privacy audit: no person names or channel words anywhere in the output
    blob = json.dumps(data, ensure_ascii=False)
    # vocabulary content may legitimately use these words (the Workshop concept is a "facilitated meeting")
    forbidden = re.compile(NAME_RE.pattern + r"|(?<!facilitated )\b" + CHANNEL + r"\b", re.I)
    hits = collections.Counter(m.group(0) for m in forbidden.finditer(blob))
    print(f"\nPrivacy audit: {dict(hits) if hits else 'clean'}")
    if hits:
        for m in list(forbidden.finditer(blob))[:10]:
            print("   ...", blob[max(0, m.start() - 80): m.end() + 40])
        fail("forbidden strings in output")

    soft = re.compile(r"\b(called|workshops?|price|prices|cost)\b", re.I)
    notes = json.dumps([data["changes"], data["synChanges"], data["retired"], data["dna"], data["fair"], data["decisions"]], ensure_ascii=False)
    soft_hits = collections.Counter(m.group(0).lower() for m in soft.finditer(notes))
    print(f"Soft-word check in notes (review manually): {dict(soft_hits) if soft_hits else 'none'}")
    for m in list(soft.finditer(notes))[:12]:
        print("   ...", notes[max(0, m.start() - 70): m.end() + 40].replace("\n", " "))
    if re.search(r"/(Users|Volumes|home)/", blob):
        fail("absolute local path in output")
    # raw provenance must never be shipped
    for c in data["concepts"]:
        assert set(c.keys()).isdisjoint({"provenance", "source_ids", "original_label", "related_ids_raw"}), c["id"]
    assert all("decided_by" not in r for r in data["dna"])

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"\nWrote src/data/taxonomy.json ({os.path.getsize(OUT)/1024:.0f} KB) — all sanity checks passed.")


if __name__ == "__main__":
    main()
