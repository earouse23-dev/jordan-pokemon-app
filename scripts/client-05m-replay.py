"""Zero-network independent reconstruction of the private CLIENT-05M observation."""
import hashlib
import json
import math
import os
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path.home() / "Library/Application Support/Mica/client-05m-private"
OLD = Path.home() / "Library/Application Support/Mica/client-05l-private/attempt.json"
LEDGER = PRIVATE / "attempt.json"
OLD_HASH = "4a6a33dc3f54167d6e3b50c48a9e460a9ffb32a2497a2b6f42513bec332d1603"
LIST_URL = "https://api.pkmnprices.com/v1/cards?name=Clefable+%281%29&number=01&total_set_number=64&language=English&per_page=1&page=1"
SOLD_URL = "https://api.pkmnprices.com/v1/cards/20618/listings/ebay?limit=10&sort=date_desc&graded=true&variant=1st+Edition+Holofoil&grader=PSA&grade=10"


def load(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def words(text):
    normalized = "".join(ch for ch in unicodedata.normalize("NFKD", str(text or "").lower()) if not unicodedata.combining(ch))
    return re.findall(r"[^\W_]+", normalized, re.UNICODE)


def date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?", value):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    except ValueError:
        return None


def transaction(url):
    try:
        parsed = urlparse(url or "")
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
            return None
        if parsed.hostname not in {"ebay.com", "www.ebay.com", "ebay.co.uk", "www.ebay.co.uk", "ebay.ca", "www.ebay.ca", "ebay.de", "www.ebay.de", "ebay.fr", "www.ebay.fr", "ebay.it", "www.ebay.it", "ebay.es", "www.ebay.es", "ebay.com.au", "www.ebay.com.au"}:
            return None
        hit = re.fullmatch(r"/itm/(?:[^/]+/)?(\d+)/?", parsed.path)
        return f"ebay:{hit.group(1)}" if hit else None
    except (TypeError, ValueError):
        return None


def canonical(title):
    if not title:
        return False
    tokens = words(title)
    if "clefable" not in tokens or "jungle" not in tokens:
        return False
    if re.search(r"\b(bundle|lot|pair|playset|assorted|multi[- ]card)\b|\bset\s+of\s+\d+\b", title, re.I):
        return False
    fractions = [(int(a), int(b)) for a, b in re.findall(r"\b0*(\d+)\s*/\s*0*(\d+)\b", title, re.I)]
    if any(pair != (1, 64) for pair in fractions):
        return False
    tags = [int(number) for number in re.findall(r"#\s*0*(\d+)\b", title)]
    if any(number != 1 for number in tags):
        return False
    parentheses = re.findall(r"\(([^()]*)\)", title)
    if len(parentheses) > 1 or any(part != "1" for part in parentheses):
        return False
    if not fractions and 1 not in tags and not re.search(r"\b0*1\b", title):
        return False
    if any(w in tokens for w in ["japanese", "german", "deutsch", "deutsche"]):
        return False
    ignored = set("pokemon tcg set collection collections promo promos cards card psa bgs cgc sgc gem mint graded grade holo holofoil reverse rare english japanese german deutsch deutsche ebay pop low confetti label black gold silver pristine perfect en jp ja de the of first 1st edition clefable jungle".split())
    extras = [w for w in tokens if w not in ignored and not w.isdigit() and not re.fullmatch(r"(?:psa|bgs|cgc|sgc)\d+(?:\.\d+)?", w) and not re.fullmatch(r"[a-z]\d{1,3}", w)]
    return not extras


def adapter_reason(row):
    try:
        amount = float(row.get("price"))
    except (TypeError, ValueError):
        amount = float("nan")
    if not math.isfinite(amount) or amount <= 0 or not row.get("sold_at"):
        return "normalization_rejected"
    try:
        u = urlparse(row.get("listing_url") or "")
        safe = u.scheme == "https" and (u.hostname or "").endswith("ebay.com")
    except (TypeError, ValueError):
        safe = False
    if not safe or not row.get("currency") or row.get("attribution") != "exact":
        return "context_mismatch"
    if row.get("language") and str(row["language"]).lower() not in ("en", "english"):
        return "context_mismatch"
    variant = re.sub(r"\s+", " ", re.sub(r"[_·-]+", " ", str(row.get("variant") or "").lower())).strip()
    if variant not in ("1st edition holofoil", "1steditionholofoil", "first edition holofoil", "firsteditionholofoil"):
        return "context_mismatch"
    title = str(row.get("title") or "")
    if not re.search(r"\b(?:1st|first)\s*edition\b", f"{variant} {title}", re.I):
        return "context_mismatch"
    title_grades = re.findall(r"\b(PSA|BGS|CGC|SGC|TAG)\s*(\d{1,2}(?:\.\d)?)\b", title, re.I)
    if any(g.upper() != "PSA" or float(n) != 10 for g, n in title_grades):
        return "context_mismatch"
    if re.search(r"\b(?:black|gold|silver)\s+label\b|\b(?:pristine|perfect)\b", title, re.I):
        return "context_mismatch"
    if str(row.get("grader") or "").upper() != "PSA" or str(row.get("grade") or "") != "10" or row.get("grade_qualifier"):
        return "context_mismatch"
    return None if canonical(title) else "canonical_identity_mismatch"


def independent(rows, evaluation):
    decisions = []
    groups = defaultdict(list)
    for row in rows:
        rid = str(row.get("ebay_listing_id") or row.get("id") or "")
        reason = adapter_reason(row)
        decision = {"rawId": rid, "adapter": reason or "accepted", "estimator": None}
        decisions.append(decision)
        if reason:
            continue
        if row.get("sale_type") and row["sale_type"] not in ("sold", "completed", "completed_sale"):
            decision["estimator"] = "not_completed_sale"
        elif str(row.get("currency") or "").upper() != "USD":
            decision["estimator"] = "currency_mismatch"
        else:
            try:
                amount = float(row["price"])
            except (TypeError, ValueError):
                amount = float("nan")
            sold = date(row.get("sold_at"))
            key = transaction(row.get("listing_url"))
            if not math.isfinite(amount) or amount <= 0:
                decision["estimator"] = "invalid_amount"
            elif sold is None or sold > evaluation:
                decision["estimator"] = "invalid_or_future_sold_at"
            elif sold < evaluation - timedelta(days=90):
                decision["estimator"] = "outside_90_day_window"
            elif not key:
                decision["estimator"] = "missing_transaction_source"
            else:
                groups[key].append((row, decision, amount, sold))
    distinct = []
    for key, entries in groups.items():
        if any((amount, sold) != (entries[0][2], entries[0][3]) for _, _, amount, sold in entries):
            for _, decision, _, _ in entries:
                decision["estimator"] = "conflicting_duplicate"
        else:
            distinct.append((key, entries[0]))
            for _, decision, _, _ in entries[1:]:
                decision["estimator"] = "duplicate_transaction"
    amounts = [entry[2] for _, entry in distinct]
    baseline = statistics.median(amounts) if amounts else None
    mad = statistics.median(abs(value - baseline) for value in amounts) if amounts else None
    kept = []
    for key, entry in distinct:
        _, decision, amount, _ = entry
        deviation = abs(amount - baseline)
        unusual = len(distinct) >= 5 and deviation / baseline * 100 >= 40 and (mad == 0 or 0.6745 * deviation / mad > 3.5)
        if unusual:
            decision["estimator"] = "robust_price_outlier"
        else:
            decision["estimator"] = "contributor"
            kept.append((key, entry))
    kept_amounts = sorted(entry[2] for _, entry in kept)
    estimate = statistics.median(kept_amounts) if len(kept) >= 3 else None
    newest = max((entry[3] for _, entry in kept), default=None)
    age = (evaluation - newest).total_seconds() / 86400 if newest else None
    return {"decisions": decisions, "count": len(kept), "estimate": estimate, "rangeLow": kept_amounts[0] if kept_amounts else None, "rangeHigh": kept_amounts[-1] if kept_amounts else None, "medianBeforeOutliers": baseline, "medianAfterOutliers": statistics.median(kept_amounts) if kept_amounts else None, "newestSoldAt": max(kept, key=lambda item: item[1][3])[1][0].get("sold_at") if kept else None, "sourceMarketCount": 1 if kept else 0, "currency": "USD", "contributingEvidenceIds": sorted(key for key, _ in kept), "status": "insufficient" if estimate is None else "stale" if age > 30 else "ready"}


def replay():
    assert PRIVATE.stat().st_mode & 0o077 == 0
    assert LEDGER.stat().st_mode & 0o077 == 0
    assert sha(OLD) == OLD_HASH
    ledger = load(LEDGER)
    assert ledger["packet"] == "CLIENT-05M" and ledger["oldLedgerHash"] == OLD_HASH
    assert ledger["ruleVersion"] == "mica-exact-sold-v1"
    assert all(sha(ROOT / file) == expected for file, expected in ledger["frozenHashes"].items())
    assert sha(ROOT / "scripts/client-05m-proof.mjs") == ledger["runnerHash"]
    requests = ledger["requests"]
    assert len(requests) <= 2 and ledger["reservedCredits"] <= 11
    assert requests[0]["stage"] == "membership" and requests[0]["url"] == LIST_URL
    m = ledger["membership"]
    c = m["candidate"] if m else None
    membership_pass = requests[0]["status"] == 200 and m["dataCount"] == 1 and m["pagination"]["page"] == 1 and m["pagination"]["per_page"] == 1 and m["pagination"]["total"] >= 1 and str(c["id"]) == "20618" and c["name"] == "Clefable (1)" and c["set"] == "Jungle" and str(c["number"]).isdigit() and int(c["number"]) == 1 and str(c["total_set_number"]).isdigit() and int(c["total_set_number"]) == 64 and all(str(fact["value"]).lower() in ("en", "english", "none") for fact in c["languageFacts"])
    assert ledger["membershipGate"] == ("pass" if membership_pass else "fail")
    if not membership_pass:
        assert len(requests) == 1 and ledger["rows"] is None and ledger["cachedDirectUses"] == 0
        return {"outcome": "identity_blocked", "agreement": True, "requests": 1, "reservedCredits": 1, "reportedCharges": [r["charge"] for r in requests], "numericProof": False}
    assert ledger["cachedDirectUses"] == 1 and len(requests) == 2
    assert requests[1]["stage"] == "sales" and requests[1]["url"] == SOLD_URL
    if ledger["rows"] is None or ledger["api"] is None:
        assert ledger["outcome"] == "sales_unavailable"
        return {"outcome": "sales_unavailable", "agreement": True, "requests": 2, "reservedCredits": 11, "reportedCharges": [r["charge"] for r in requests], "numericProof": False}
    rows = ledger["rows"]
    assert len(rows) <= 10 and ledger["api"]["receivedCount"] == len(rows)
    independently = independent(rows, date(ledger["evaluatedAt"]))
    api = ledger["api"]
    prod = ledger["production"]
    actual_accepted = Counter(str(s.get("providerSaleId") or "") for s in api["sales"])
    expected_accepted = Counter(d["rawId"] for d in independently["decisions"] if d["adapter"] == "accepted")
    actual_upstream = Counter((e["id"].split(":")[-1] if e.get("id") else "", e["reason"]) for e in api["upstreamExclusions"])
    expected_upstream = Counter((d["rawId"], d["adapter"]) for d in independently["decisions"] if d["adapter"] != "accepted")
    actual_estimator = Counter((e["id"].split(":")[-1], e["reason"]) for e in prod["excluded"])
    expected_estimator = Counter((d["rawId"], d["estimator"]) for d in independently["decisions"] if d["adapter"] == "accepted" and d["estimator"] not in (None, "contributor"))
    numeric_fields = ("count", "estimate", "rangeLow", "rangeHigh", "medianBeforeOutliers", "medianAfterOutliers", "newestSoldAt", "sourceMarketCount", "currency", "status")
    production_fields = {"count": prod["distinctSaleCount"], **{key: prod.get(key) for key in numeric_fields if key != "count"}}
    expected_fields = {key: independently[key] for key in numeric_fields}
    checks = {"adapterAcceptedIds": actual_accepted == expected_accepted, "adapterExclusionRows": actual_upstream == expected_upstream, "estimatorExclusionRows": actual_estimator == expected_estimator, "valuation": production_fields == expected_fields, "contributorTransactionIds": sorted(prod["contributingEvidenceIds"]) == independently["contributingEvidenceIds"], "freshnessAndTruncation": prod["evaluatedAt"] == ledger["evaluatedAt"] and prod["hasMore"] == ledger["hasMore"] and prod["newestRetrievedAt"] == ledger["api"]["retrievedAt"]}
    private_result = {"checks": checks, "independent": independently, "production": production_fields, "receivedCount": len(rows), "acceptedCount": sum(expected_accepted.values()), "adapterExclusions": dict(Counter(d["adapter"] for d in independently["decisions"] if d["adapter"] != "accepted")), "estimatorExclusions": dict(Counter(d["estimator"] for d in independently["decisions"] if d["adapter"] == "accepted" and d["estimator"] not in (None, "contributor")))}
    target = PRIVATE / "reconstruction.json"
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(json.dumps(private_result, indent=2) + "\n")
        output.flush()
        os.fsync(output.fileno())
    agreement = all(checks.values())
    return {"outcome": prod["status"] if agreement else "disagreement", "agreement": agreement, "checks": checks, "requests": len(requests), "reservedCredits": ledger["reservedCredits"], "reportedCharges": [r["charge"] for r in requests], "receivedCount": len(rows), "acceptedCount": sum(expected_accepted.values()), "eligibleContributors": independently["count"], "hasMore": ledger["hasMore"], "numericProof": independently["estimate"] is not None, "privateReconstruction": str(target), "privateReconstructionHash": sha(target)}


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        fixture = lambda i, price, **changes: {"id": str(i), "ebay_listing_id": str(i), "title": "Clefable Jungle 01/64 1st Edition Holofoil PSA 10", "listing_url": f"https://www.ebay.com/itm/{i}", "price": price, "currency": "USD", "sold_at": "2026-09-20", "attribution": "exact", "variant": "1st Edition Holofoil", "grader": "PSA", "grade": "10", **changes}
        clock = datetime(2026, 9, 25, tzinfo=timezone.utc)
        positive = independent([fixture(1, 100), fixture(2, 120), fixture(3, 140)], clock)
        assert positive["count"] == 3 and positive["estimate"] == 120 and positive["rangeLow"] == 100 and positive["rangeHigh"] == 140 and positive["status"] == "ready"
        mixed = independent([fixture(4, 100), fixture(5, 120, currency="EUR"), fixture(6, 140, sold_at="2025-01-01"), fixture(7, 150, title="Raichu Jungle 01/64 1st Edition Holofoil PSA 10")], clock)
        assert mixed["count"] == 1 and mixed["estimate"] is None and [d["estimator"] for d in mixed["decisions"][:3]] == ["contributor", "currency_mismatch", "outside_90_day_window"] and mixed["decisions"][3]["adapter"] == "canonical_identity_mismatch"
        outlier = independent([fixture(i, 100) for i in range(10, 15)] + [fixture(15, 1000)], clock)
        assert outlier["count"] == 5 and outlier["estimate"] == 100 and outlier["decisions"][-1]["estimator"] == "robust_price_outlier"
        print(json.dumps({"syntheticPositive": True, "currencyAndStaleExclusions": True, "zeroMadOutlier": True}))
    else:
        result = replay()
        print(json.dumps(result))
        if not result["agreement"]:
            raise SystemExit(1)
