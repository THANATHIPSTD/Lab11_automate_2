# Think First Answers

## Think first #1 — FX test triage

Predicted passes: Not recorded before the run.

Actual: 9 passed / 1 failed.

Classification: Environment, likely caused by the deliberately unreliable exchange-rate service. The failure output showed “Exchange rate unavailable.” The current run did not retain a Network trace, so the HTTP 503 was not confirmed in the trace.

Evidence: The failing test displayed “Exchange rate unavailable”; server/api/rates.get.ts configures the simulated service to return 503 for 35% of requests. A Network trace should be captured before claiming that 503 was directly observed.

## Think first #2 — Git ignore entries

1. .nuxt/ -> Generated Nuxt cache and development files could be committed to GitHub.
2. .output/ -> Built application output could be committed to GitHub.
3. .env -> Local credentials and other environment values could be exposed on GitHub.

Note: PL-01 also requires .vercel/ to be ignored. The starter .gitignore I checked lacked this entry too, so it was added as well.

## Think first #3 — $fetch retry

Without { retry: 0 }, fetch retries a failed GET request once by default. With a 35failure probability per attempt, the probability that both attempts fail is $0.35^2 = 0.1225, or **12.25%**, assuming independent attempts.

A retry hidden inside the application can mask an outage and make the test pass even though the dependency failed on its first request. Playwright retries operate at the test level and keep the initial failure visible for diagnosis.

## Think first #4 — Exposed password

No. Removing the password in a later commit does not remove it from the earlier commit or from existing clones. A real team should revoke or rotate the credential immediately, investigate possible access, and remove the exposed value from repository history as a best-effort cleanup. The replacement should be stored in a secret manager, not committed to the repository.