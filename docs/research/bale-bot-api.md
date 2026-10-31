# Research: Bale bot API (docs.bale.ai, 2026-10-31)

- Telegram Bot API–compatible with minor changes; Telegram bot libraries work with a changed base URL.
- Base URL: `https://tapi.bale.ai/bot<token>/METHOD_NAME` (GET/POST; query, form, JSON, multipart).
- Updates: `getUpdates` (long polling) or webhook. Server keeps the last 2000 updates for 24h.
- `KeyboardButton.request_contact` — user shares their phone number as a Contact.
- `InlineKeyboardButton.copy_text` (CopyTextButton) — copy a given text to clipboard.
- `web_app` (WebAppInfo) on both keyboard types — opens a mini-app.
- Bots created via @botfather inside Bale.
