# ADR-0002: Minimal payload, opt-in participation

Status: accepted (2026-10-31)

## Decision
- An activity event contains only `{employee, tool, event type, timestamp}`.
  Never prompts, file names, repo names, or code. Hook payloads from the tools often include
  prompt text — the reporter must drop it before sending.
- The reporter is short and readable so anyone can audit it.
- Participation is **opt-in** via a one-command install. Not installed → seat shows **away**.

## Why
The goal is adoption. Surveillance-feeling tooling gets resented or gamed, and mandatory
activity tracking may carry HR/legal implications.
