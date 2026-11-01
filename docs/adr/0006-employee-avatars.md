# ADR-0006: Employee-designed avatars

Status: accepted (2026-10-31), built 2026-11-01

## Decision
- A character creator at `/avatar` on the office site. No authentication: the page only produces a code.
- Options: skin tone (6), hairstyle (short, long, curly, bald, ponytail), hair colour, beard/moustache,
  shirt colour, trousers colour, glasses on/off, headphones on/off. No headscarf. No body shapes.
- Live 3D preview using the same figure as the office (desk typing pose, switchable to idle), rotatable,
  with a "random" button. Nothing is saved server-side until the bot receives the code.
- **Avatar code**: short, versioned, about 10 chars, e.g. `A1-7K3Q9XPM`. Copy button copies `/avatar A1-7K3Q9XPM`.
  Also an "Open in Bale" deep link (`ble.ir/office_sims_bot?start=…`) if Bale supports start parameters.
- Bot `/avatar <code>`: validates the code, stores it per user, replies in Persian with the chosen parts and the
  office link (no server-side render). Invalid codes get a clear error. `/avatar reset` restores the automatic look.
- People without an avatar keep the automatic look derived from their id. The owner's sofa figure uses the
  owner's avatar.
- The page is in Persian (RTL), like the bot.
