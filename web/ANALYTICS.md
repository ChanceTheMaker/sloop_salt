# Website analytics

At the owner's request, Sloop shares Felucca Salt's GA4 property `G-JVF09MZEGD`.
Only `chancethemaker.github.io/sloop-fm1-sim/` sends analytics. Local previews and
other forks do not. This branch publishes the standalone simulator at the site root.

The implementation is adapted from Chance Roth's Felucca Salt code under GPL-3.0.
It retains Felucca's default-on notice and Essential only opt-out. Cookie settings
can be reopened from the device credits. The
choice persists independently under `sloop.web.analyticsConsent`. GA cookies use
the `sloop` prefix and `/sloop-fm1-sim/` path, following Google's
[configuration reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).

Page views, theme changes, ZIP/FWSC download clicks and successful initial browser
audio starts are tracked. Installation outcomes are not instrumented. Advertising
consent and Google signals are disabled. URLs omit query strings and referrers
are reduced to origins. Custom fields are allowlisted; MIDI data, device IDs,
audio and preset contents are not sent. Tracking never blocks audio or installation.

`web/test_analytics.mjs` verifies the property ID, production isolation, opt-out,
re-enabling, cookie scope, event filtering and mobile notice on all three pages.
Google requests are mocked, so tests do not add visits to the property. Confirm
actual reporting in GA4 Realtime; browser blockers and opt-outs can prevent it.
