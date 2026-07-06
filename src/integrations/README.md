# integrations/

External APIs and third-party services — Discord, Stripe, OpenAI, GitHub, email, etc.

One folder or client per external system, wrapping its SDK/HTTP details behind a small
interface so the rest of the app depends on your contract, not the vendor's.

Examples: `stripe/`, `openai/`, `github/`, `email/`.
