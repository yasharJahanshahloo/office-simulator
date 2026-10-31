# ADR-0004: Onboarding via a Bale bot

Status: accepted (2026-10-31)

## Decision
Employees onboard by starting our **Bale bot**. Bale's API is Telegram-compatible
(`https://tapi.bale.ai/bot<token>/…`), so a standard Telegram bot client is used with a swapped base URL.

Flow:
1. `/start` → greeting message with an inline button.
2. Button pressed:
   - **Registered user** → bot sends a **setup zip**: the latest reporter scripts with the user's
     **credential** (encrypted Bale user id) built in. The backend resolves events by this credential.
   - **Unregistered user** → bot sends a **top-view seat map** with a label on each **desk seat**
     (meeting rooms, kitchen and sofas are excluded). User types a label. If the seat is taken → error;
     otherwise the user is registered to that seat. Their Bale nickname becomes the **name tag**.
3. **Admin** (via the bot) can unregister a seat, ban a user id, and get a report of registered users.

Details (round 4):
- Only Bale user ids on the **allowlist** (provided by admin) may register.
- **Name tag** = Bale `@username`; if empty, first 14 chars of the display name.
- **Credential** = AES-GCM encryption of `{user_id, version}` with a server key. Every event is
  checked against registrations and bans; bumping `version` (Reissue button) kills a leaked zip.
- Zip = `install.md` + `ping.sh` + `ping.ps1` + `credential`. User tells their agent "follow install.md";
  the agent installs to `~/.office-presence/`, adds hooks, sends a test ping → bot replies "connected".
- Seat moves only via admin `/unregister`; credential is bound to the user, not the seat.
- Admin commands: `/help`, `/report` (message + CSV), `/unregister <label>`, `/ban <id>`, `/unban <id>`.
  Ban also unregisters. Banned users get silence. Admin is notified of each registration.
- Seat labels `A1…E4`; map PNG from the 3D top view with taken seats greyed; input normalized
  (case, spaces, Persian/Arabic digits).
- Bot language: Persian. `install.md`: English. No mini-app; long polling via `getUpdates`.

The employee's own AI agent performs the machine setup from the zip, guided by `install.md`
(a document written for agents). No cross-platform installer binary.

## Consequences
- Registration is self-service; misuse is handled after the fact by admin unregister/ban.
- One seat ↔ one user.
- `install.md` must be precise enough that four different agents on three OSes produce the same setup.
