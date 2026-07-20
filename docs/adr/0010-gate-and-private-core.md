# Gate and private core

Browser traffic hits a public **gate** Worker (SPA + `/api/*` proxy). Mail, the HTTP API, crons, and platform bindings live on a private **core** Worker reached from the browser only via a service binding — not a public workers.dev URL. Assets stay on gate so email/API and UI can deploy on independent cadences. Rejected alternatives: public core HTTP (CORS/cookie dual-origin), and merging the SPA onto core.
