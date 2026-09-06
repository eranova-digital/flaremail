# ADR-0014: Mail search query language

## Status

Accepted

## Context

Mail search needs operators that the UI can parse into pills and that core can evaluate the same way. Gmail’s language (`OR`, `in:anywhere`, `after:`) is a poor fit.

## Decision

Use a small programming-style language. Operators are `&&` / juxtaposition (AND), `||` (OR), `-` (NOT), parentheses, and quotes. Field operators include `from:`, `to:`, `cc:`, `bcc:`, `subject:`, `since:`, `until:`, `has:`, plus thread operators `in:` (including `in:any` for all folders in the selected mailbox), `label:`, and `is:`. Dates are UTC. The same parser (`packages/mail-search-query`) runs in the web field (pills) and in core so invalid queries fail the same way.

## Consequences

- Invalid queries fail identically in UI and API.
- Default folder scope (every folder except trash and spam) is a search rule, not a Gmail `in:anywhere` equivalent.
