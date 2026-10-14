#!/usr/bin/env python3
import argparse, glob, json, os

def read_json(path):
    try:
        with open(path, encoding="utf-8") as f: return json.load(f)
    except (OSError, json.JSONDecodeError): return None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports-dir", required=True)
    parser.add_argument("--out")
    args = parser.parse_args()
    slither_path = os.path.join(args.reports_dir, "slither-report.json")
    slither = read_json(slither_path) if os.path.exists(slither_path) else None
    findings = []
    for issue in (slither or {}).get("results", {}).get("detectors", []):
        findings.append({"check": issue.get("check"), "impact": issue.get("impact"), "confidence": issue.get("confidence"), "description": issue.get("description"), "locations": issue.get("elements", [])})
    counts = {}
    for finding in findings: counts[finding.get("impact", "Informational").lower()] = counts.get(finding.get("impact", "Informational").lower(), 0) + 1
    result = {"slither": {"present": slither is not None, "counts": counts, "findings": findings}, "mythril": [{"path": p, "present": read_json(p) is not None} for p in sorted(glob.glob(os.path.join(args.reports_dir, "mythril-*.json")))], "forge_output": os.path.exists(os.path.join(args.reports_dir, "forge_output.txt")), "echidna_output": os.path.exists(os.path.join(args.reports_dir, "echidna_output.txt"))}
    output = json.dumps(result, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f: f.write(output + "\n")
    else: print(output)

if __name__ == "__main__": main()
