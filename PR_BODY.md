# chore(security): full security baseline

## Summary
- Nonce-based audit ID generation
- Foundry unit and fuzz tests
- Slither, Mythril, and Echidna configuration
- Reproducible Docker/CI tooling
- Certora specification boilerplate

## Validation
- `./scripts/install_foundry.sh`
- `./scripts/run_full_security_suite.sh`
- `./scripts/package_artifacts.sh`

Attach `reports/summary.json` and the raw reports before requesting external audit review. Certora files are starting-point specifications and must be validated with the project's Certora Prover version.
