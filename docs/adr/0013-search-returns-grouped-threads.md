# Search returns grouped threads

`POST /search` previously returned a flat page of message hits. The mail UI lists **threads**, and a query can match several **messages** in one conversation. We overwrite `/search` so each item is a **search result**: the thread plus its **search hits** (empty when the query is thread-only). Pagination and sort are per result (newest hit `receivedAt`, or `lastMessageAt` when there are no hits). A thread is never split across pages.
