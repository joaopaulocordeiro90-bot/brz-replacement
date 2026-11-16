#!/usr/bin/env python3
"""BRZ F63: independently reconcile the legacy port-only FOB formula.

Local, offline, read-only. No network requests, no DB mutations and no source
data printed. Usage: python tools/audit_f63_port.py /path/to/V4FQ.html
A complete operational certification requires other route/month/carry checks.
"""
import hashlib
import json
import re
import sys
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

EXPECTED_SOURCE_SHA256 = "d39ecfc34d3f95f6f4e463d59de49c76609c86db09994728dc349a5eca482085"
EXPECTED_LEGACY_SHA256 = "f1ceedff4313940365154f1ab518f73e066590af6ad66cc4558cb6592c41b043"
EXPECTED_CURRENT_SHA256 = "cd813ee8dae3b28b776911fc680b57894582312a3e08cc1dc3ca91ef350baa6e"
PORTS = {"Santos", "Paranaguá", "Rio Grande", "São Francisco do Sul", "Barcarena", "Itaqui", "São Luís"}
VALID_PRODUCTS = {"Soja", "Milho", "Sorgo"}


def dec(value):
    return Decimal(str(value or 0))


def calc_state(html_file):
    data = Path(html_file).read_bytes()
    source_sha = hashlib.sha256(data).hexdigest()
    if source_sha != EXPECTED_SOURCE_SHA256:
        raise ValueError("Original V4FQ SHA-256 diverges from the sealed source")
    match = re.search(
        r'<script id="dataState" type="application/json">(.*?)</script>',
        data.decode("utf-8"), re.S
    )
    if not match:
        raise ValueError("Canonical dataState not present")
    state = json.loads(match.group(1))
    if len(state["negocios"]) != 4011:
        raise ValueError("Expected 4,011 original trades")
    found = []
    for trade in state["negocios"]:
        origin_city = (trade.get("origem") or "").split(" - ")[0]
        if (not str(trade.get("corredor") or "").startswith("FAS")
                or origin_city not in PORTS
                or trade.get("produto") not in VALID_PRODUCTS
                or dec(trade.get("preco")) <= 0
                or dec(trade.get("cambio")) <= 0
                or trade.get("cbot") is None):
            continue
        port = "Itaqui" if origin_city == "São Luís" else origin_city
        fobbing_cost = Decimal("14") if port in ("Itaqui", "Barcarena") else Decimal("11")
        factor = Decimal("2.2046") if trade["produto"] == "Soja" else Decimal("2.3621")
        fob_cbu = (dec(trade["preco"]) / dec(trade["cambio"])
                   + Decimal("0.06") * fobbing_cost) * Decimal("100") / factor
        basis_cbu = fob_cbu - dec(trade["cbot"])
        margin_cbu = dec(trade.get("premio")) - basis_cbu
        found.append({
            "id": str(trade["id"]), "date": trade.get("data") or "",
            "port": port, "product": trade["produto"],
            "fob": fob_cbu, "basis": basis_cbu, "margin": margin_cbu
        })
    return found, source_sha


def sha_ledger(deals):
    def fmt(num):
        return str(num.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))
    rows = [
        "\x1f".join((d["id"], d["port"], fmt(d["fob"]), fmt(d["basis"]), fmt(d["margin"])))
        for d in sorted(deals, key=lambda x: x["id"])
    ]
    return hashlib.sha256("\n".join(rows).encode("utf-8")).hexdigest()


def audit(path):
    deals, source_sha = calc_state(path)
    past = [d for d in deals if d["date"] < "2026-11-11"]
    future = [d for d in deals if d["date"] >= "2026-11-11"]
    current_hash = sha_ledger(deals)
    historical_hash = sha_ledger(past)
    unique_ids = len({d["id"] for d in deals}) == len(deals)
    passed = (
        len(deals) == 204
        and len(past) == 201
        and len(future) == 3
        and unique_ids
        and historical_hash == EXPECTED_LEGACY_SHA256
        and current_hash == EXPECTED_CURRENT_SHA256
    )
    return {
        "schema": "BRZ_F63_PORT_FINANCIAL_AUDIT_V1",
        "status": "PASS_SUBSET" if passed else "FAIL",
        "source_sha256": source_sha,
        "eligible_deals": len(deals),
        "by_product": dict(sorted(Counter(d["product"] for d in deals).items())),
        "historical_deals": len(past),
        "current_deals_added_after_reference": len(future),
        "ids_unique": unique_ids,
        "historical_reference_sha256": historical_hash,
        "v4fq_port_ledger_sha256": current_hash,
        "full_route_parity_certified": False,
        "d1_d7_d30_certified": False,
        "ocean_corn_missing_reference_count": 117,
        "note": "Port-only FOB formula. Does not certify inland freight, all routes, CFR, TAB or historical lookbacks."
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python tools/audit_f63_port.py /path/to/V4FQ.html")
    report = audit(sys.argv[1])
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["status"] == "PASS_SUBSET" else 1)
