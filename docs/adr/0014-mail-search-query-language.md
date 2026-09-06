# Mail search query language

Mail search uses a small programming-style language instead of Gmail’s (`OR`, `in:anywhere`, `after:`). Operators are `&&` / juxtaposition (AND), `||` (OR), `-` (NOT), parentheses, and quotes. Field operators include `from:`, `to:`, `cc:`, `bcc:`, `subject:`, `since:`, `until:`, `has:`, plus thread operators `in:` (including `in:any` for all folders in the selected mailbox), `label:`, and `is:`. Dates are UTC. The same parser runs in the web field (pills) and in core so invalid queries fail the same way.
