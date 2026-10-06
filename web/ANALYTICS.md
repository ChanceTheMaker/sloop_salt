# Website analytics

At the owner's request, Sloop shares Felucca Salt's GA4 property `G-JVF09MZEGD`.
Only `chancethemaker.github.io/sloop_salt/` sends analytics. Local previews and
other forks do not. The public installer, editor and alternate Salt homepage
load the same optional module; the root redirect does not send a duplicate view.

The implementation is adapted from Chance Roth's Felucca Salt code under GPL-3.0.
It retains Felucca's default-on notice and Essential only opt-out. Cookie settings
can be reopened from the website settings menu, or the installer footer. The
choice persists independently under `sloop.web.analyticsConsent`. GA cookies use
the `sloop` prefix and `/sloop_salt/` path, following Google's
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
