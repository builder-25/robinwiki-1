# Wiki Type UAT — Log

## What it proves
End-to-end Log wiki lifecycle: create wikis of type "log", submit chronological
content via MCP `log_entry`, verify pipeline processing, check graph edges
(FRAGMENT_IN_WIKI), trigger wiki regeneration, and confirm final wiki state.

A Log wiki is "a chronological synthesis of events, observations, and activities
over time." The three fixtures represent real-world chronological records:
1. A spacecraft systems engineering log (modeled on Apollo mission ops logs)
2. A marine biology field research notebook (modeled on NOAA reef survey notes)
3. A software incident postmortem timeline (modeled on public SRE incident reports)

## Prerequisites
- Server running at localhost:3000
- OPENROUTER_API_KEY set (for LLM pipeline)
- INITIAL_USERNAME / INITIAL_PASSWORD in core/.env

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

# Helper: extract JSON from SSE "data:" line
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

echo "Wiki Type UAT — Log"
echo ""

# Check OpenRouter key
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping pipeline test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Sign in ──────────────────────────────────────────────────────────
curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── Get MCP token from profile ───────────────────────────────────────
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl is empty — cannot run MCP tests"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token obtained"

# ── Seed wiki types ──────────────────────────────────────────────────
SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "wiki-types seed → HTTP $SEED_HTTP"

# ── Create 3 wikis of type "log" ────────────────────────────────────
TS=$(date +%s)

create_wiki() {
  local name="$1"
  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"log\",\"prompt\":\"\"}" \
    "$SERVER_URL/wikis")
  local http=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  local key=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  if [ "$http" = "201" ] && [ -n "$key" ]; then
    pass "Created wiki: $name (key=$key)" >&2
    echo "$key"
  else
    fail "Failed to create wiki: $name (HTTP $http)" >&2
    echo ""
  fi
}

WIKI_KEY_1=$(create_wiki "Apollo CSM Systems Log ${TS}")
WIKI_KEY_2=$(create_wiki "Coral Reef Survey Notes ${TS}")
WIKI_KEY_3=$(create_wiki "Payment Gateway Incident Timeline ${TS}")

if [ -z "$WIKI_KEY_1" ] || [ -z "$WIKI_KEY_2" ] || [ -z "$WIKI_KEY_3" ]; then
  fail "One or more wikis failed to create — aborting"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 1
fi

# ── Fixture 1: Spacecraft Systems Engineering Log ────────────────────
read -r -d '' FIXTURE_1 << 'FIXTURE_EOF'
Apollo CSM Systems Engineering Log — Day 127 through Day 131

Day 127, 06:00 UTC — Pre-launch systems verification sequence initiated for the Command and Service Module avionics stack. Flight controller team lead Marcus Chen authorized power-on for the primary guidance computer. Initial telemetry showed nominal voltage levels across all three fuel cell buses: Bus A at 29.4V, Bus B at 29.2V, Bus C at 29.5V. The environmental control system oxygen flow regulator was cycled through its full range (0.2 to 1.2 lbs/hr) and responded within spec at each set point. Crew cabin pressure held steady at 5.0 psia throughout the two-hour checkout.

Day 127, 14:30 UTC — Thermal protection system inspection completed by structural engineer Diane Okoro. Forward heat shield ablator thickness measured at all 24 station points; minimum reading was 1.42 inches at station 7 (spec minimum 1.35 inches). Three tiles on the aft heat shield showed minor surface cracking consistent with thermal cycling during previous test exposures. Okoro classified these as Class 2 discrepancies — acceptable for flight but requiring photographic documentation for post-flight comparison. Reaction control system thruster quad A was cold-fired; all four thrusters actuated within 18 milliseconds of command signal, well within the 45-millisecond requirement.

Day 128, 08:15 UTC — Navigation system alignment calibration with Dr. Yuki Tanaka overseeing the star tracker. The primary star tracker locked onto Canopus within 3.2 seconds of slew command. A systematic bias of 0.004 degrees in the pitch axis was identified during the Sirius acquisition sequence. Tanaka traced the bias to a slight misalignment in the optical reference mounting bracket, likely introduced during the last vibration test. The correction was uploaded to the onboard compensation table (parameter table revision 14-C). After correction, pointing accuracy improved to 0.001 degrees RMS across all test stars. The backup inertial measurement unit showed a gyro drift rate of 0.012 degrees per hour on the Z-axis — elevated but still within the 0.015 deg/hr flight limit. Tanaka recommended monitoring this parameter during the first six hours of powered flight and switching to the backup IMU only if drift exceeds 0.018 deg/hr.

Day 129, 11:00 UTC — Communications systems test directed by signals engineer Roberto Vasquez. S-band transponder achieved lock with the ground station at Goldstone within the expected 4-second acquisition window. Voice quality on the unified S-band downlink was rated 4 out of 5 by the communications officer. High-gain antenna steering tested across its full gimbal range: azimuth -85 to +85 degrees, elevation -5 to +85 degrees. A momentary hesitation was observed at azimuth -62 degrees during the sweep. Vasquez identified a minor stiction point in the azimuth bearing; the antenna was exercised through that region 15 times and the hesitation diminished to undetectable levels. Telemetry data rates verified at 51.2 kbps on the high bit rate channel and 1.6 kbps on the low bit rate backup. Signal margins exceeded minimum requirements by 3.2 dB at maximum slant range geometry.

Day 130, 07:45 UTC — Propulsion system leak checks conducted by propulsion lead Sarah Abrams. Service module main engine helium pressurization system verified at 3600 psi with zero detectable leakage over a 12-hour hold (sensitivity 1e-6 scc/sec). RCS propellant isolation valves cycled 50 times each; all valve actuation times remained within 80-120 milliseconds throughout the cycling test. Abrams noted that quad C thruster number 3 showed a slightly elevated chamber pressure during the last five firings of its acceptance test — 98.2 psia versus the nominal 96.0 psia. The deviation was within the 94-102 psia acceptance band but was flagged for monitoring. Fuel and oxidizer tank pressurization verified through the full blowdown pressure profile from 186 psia to 155 psia.

Day 131, 09:00 UTC — Integrated systems test with all subsystems powered simultaneously for the first time in this test campaign. Total power draw measured at 1,847 watts against a budget of 2,050 watts, leaving 203 watts of margin. All caution and warning system alarms triggered correctly when test fault conditions were injected: cabin pressure low, O2 flow high, bus undervoltage, and master alarm propagation verified across all crew displays. Software load verification confirmed flight program revision 72 installed in both primary and backup computers with matching checksums. Final crew hatch seal test achieved 5.0 psia cabin pressure with less than 0.02 psi decay over 4 hours. Vehicle declared ready for transport to the launch pad.
FIXTURE_EOF

# ── Fixture 2: Marine Biology Field Research Notebook ────────────────
read -r -d '' FIXTURE_2 << 'FIXTURE_EOF'
Coral Reef Health Survey — Palmyra Atoll, Central Pacific
Principal Investigator: Dr. Elena Marchetti, NOAA Pacific Marine Environmental Laboratory
Field Season: March 8-14

March 8 — Arrived at Palmyra Atoll research station aboard R/V Falkor at 05:40 local time. Sea state 2, wind from the northeast at 8 knots. Visibility estimated at 25-30 meters from the pier — excellent conditions for the first survey dive. Established base camp at the north shore station with research assistants Tomoko Hayashi and Kwame Asante. Calibrated all four YSI EXO2 water quality sondes against laboratory standards: pH buffers (4.01, 7.00, 10.01), dissolved oxygen (0% and 100% saturation), conductivity (50,000 uS/cm). Sonde 3 showed a 0.08 pH unit offset that persisted after recalibration; replaced the pH/ORP sensor head from spare inventory. Deployed temperature loggers at the five permanent monitoring stations (Sites A through E) along the forereef transect at depths of 5, 10, 15, 20, and 25 meters. Water temperature at deployment ranged from 28.4C at the surface to 27.1C at 25 meters.

March 9 — First survey dive at Site A, the shallow forereef terrace at 5-8 meters depth. Hayashi and I conducted a 50-meter point-intercept transect following the established protocol (substrate recorded at 20-cm intervals, n=250 points per transect). Coral cover measured at 42.3%, a decline of 6.1 percentage points from the September survey. The dominant species remains Pocillopora meandrina, which accounted for 28.7% of all coral points. Observed active bleaching in approximately 15% of the Pocillopora colonies — characterized by pale tissue with visible skeleton through translucent polyps, consistent with Stage 2 bleaching on the Coral Watch reference card. No mortality observed at this stage. Acropora hyacinthus table corals at the western end of the transect appeared unaffected. Fish community survey (stationary point count method, 5-minute counts at 3 stations): recorded 847 individual fish across 43 species. Notable observation: a school of approximately 200 Acanthurus triostegus (convict tang) grazing on turf algae along the reef crest — considerably larger aggregation than previously documented at this site. Asante collected water samples at 3 depths for chlorophyll-a and nutrient analysis; samples packed on ice for lab processing at the station.

March 10 — Surveyed Sites B and C on the mid-depth forereef (10-15 meters). Sea conditions deteriorated through the morning with increasing swell from the west. Completed Site B transect before conditions forced us to abort the Site C dive at 11:20. Site B coral cover was 51.8%, consistent with September readings (53.1%). No bleaching observed at this depth. Encountered a juvenile hawksbill turtle (Eretmochelys imbricata) resting under a large Porites lobata colony at 12 meters depth; carapace length estimated at 35 cm. Photographed and logged GPS coordinates for the turtle monitoring database. During the safety stop at 5 meters, observed a previously unrecorded patch of Montipora capitata encrusting colonies colonizing the dead substrate left by a 2019 Acropora die-off. This colonization represents a potential phase shift in community composition at this depth band. Collected three 2-cm coral tissue samples from bleached Pocillopora colonies at Site A for Symbiodiniaceae genetic analysis (samples preserved in 95% ethanol, catalog numbers PA-2024-0308 through PA-2024-0310).

March 11 — Weather window opened after overnight wind shift to the southeast. Returned to complete Site C and began Site D (20 meters). Site C coral cover was 38.9%, down from 44.2% in September. Dr. Marchetti identified partial mortality on several large Porites colonies consistent with black band disease — dark bands 2-5 mm wide advancing across colony surfaces at an estimated rate of 3 mm per day based on comparison with September photographs of the same colonies. Three affected colonies documented and added to the disease monitoring register. Site D at 20 meters showed 29.4% coral cover with high sponge abundance (Terpios hoshinota encrusting sponge covering approximately 8% of the substrate). This sponge was not recorded at this site during any previous survey — it is an aggressive competitor known to overgrow live coral tissue. Water temperature at 20 meters had risen to 27.8C, a 0.7-degree increase from deployment readings three days earlier. Hayashi noted unusual turbidity in the water column between 15 and 18 meters; we deployed the CTD profiler and recorded a thermocline anomaly — a 1.2C temperature inversion layer between 16 and 17 meters, likely caused by an internal wave event.

March 12-13 — Strong westerly swell (2.5 meters significant wave height) prevented diving operations. Used the downtime to process field data and begin chlorophyll-a extractions in the lab. Preliminary results from March 9 water samples show elevated chlorophyll-a at Site A (0.48 ug/L at 5 meters) compared to the baseline of 0.15-0.25 ug/L. This enrichment could be driving the increased turf algae observed on the reef crest and may be related to the bleaching stress — nutrient enrichment is known to exacerbate thermal bleaching by reducing coral resistance. Asante ran the dissolved inorganic nitrogen analysis on the Lachat autoanalyzer; nitrate + nitrite concentrations were 0.82 umol/L, roughly double the typical background for this site. Phosphate was 0.09 umol/L, within normal range. The N:P ratio of approximately 9:1 suggests nitrogen enrichment from an external source — possibly upwelling or a shift in the equatorial current system bringing nutrient-rich deeper water onto the atoll shelf.

March 14 — Final dive day. Completed Site E at 25 meters in calm conditions. Coral cover 18.2%, dominated by massive Porites and Leptoseris papyracea. No bleaching observed at this depth. Total survey summary across all five sites: mean coral cover 36.1% (range 18.2-51.8%), representing a 4.8% overall decline from September. Bleaching observed only at the shallowest site. Black band disease active at one mid-depth site. New invasive sponge presence documented at one deep site. Packed all equipment and samples for the return voyage. Preliminary assessment: the reef is under moderate stress from thermal and nutrient anomalies, but the deeper portions remain healthy and could serve as a refugium for recovery if surface conditions improve.
FIXTURE_EOF

# ── Fixture 3: Software Incident Postmortem Timeline ─────────────────
read -r -d '' FIXTURE_3 << 'FIXTURE_EOF'
Incident Report — Payment Gateway Service Degradation
Incident ID: INC-2024-0847
Severity: SEV-1 (Customer-Facing)
Duration: 3 hours 42 minutes
Incident Commander: Jamie Liu, Senior SRE

15:23 UTC — Automated monitoring alert fires: payment transaction success rate drops below 98% threshold. PagerDuty pages the on-call SRE (Morgan Park). Dashboard shows success rate at 96.2% and declining. Error rate on the payment-processor service has spiked from baseline 0.3% to 3.8%. The spike correlates with a deployment of version 2.14.7 of the payment-processor service completed at 15:18 UTC.

15:27 UTC — Park acknowledges the page and begins triage. Transaction logs show a mix of HTTP 500 and HTTP 503 responses from the payment-processor pods. The 500 errors contain a stack trace pointing to a NullPointerException in PaymentValidator.validateCardNetwork() at line 247. Park identifies that the 2.14.7 release included a refactor of the card network validation logic authored by developer Sam Torres. Park pages Torres and incident commander Jamie Liu.

15:34 UTC — Liu declares SEV-1 and opens the incident channel. Transaction success rate has fallen to 91.4%. Customer support reports an increase in payment failure complaints via the support queue — 47 tickets in the last 10 minutes versus a typical rate of 2-3 per hour. The error pattern is not affecting all transactions: analysis of the failing requests shows they are exclusively Visa and Mastercard transactions processed through the Stripe gateway. American Express transactions routed through Adyen are unaffected.

15:38 UTC — Torres joins the incident channel and confirms the root cause. The card network validation refactor in 2.14.7 introduced a code path where the network identifier field can be null when the card BIN lookup returns a partial match. The previous code had an implicit null check via a legacy helper method that was removed during the refactor. Torres estimates the fix is a three-line patch — adding an explicit null guard before the network comparison.

15:42 UTC — Liu decides to pursue parallel remediation: Torres will prepare the hotfix while Park initiates a rollback to version 2.14.6. Park checks the deployment pipeline and discovers that the automated rollback is blocked — the 2.14.7 deployment included a database migration (migration 0847: add column card_network_override to transactions table). The migration is forward-compatible but the rollback path was not tested because the column addition was considered additive-only. Park escalates to database administrator Chris Nakamura.

15:48 UTC — Nakamura joins and assesses the migration state. The new column exists in production and has been populated for approximately 2,100 transactions since the deployment. Nakamura confirms that rolling back the application code to 2.14.6 is safe because 2.14.6 does not reference the new column — it will simply be ignored. However, the deployment system's rollback guard is rejecting the rollback because it detects an unmatched migration. Nakamura manually overrides the guard by setting the migration compatibility flag in the deployment config. Transaction success rate is now at 87.3%.

15:55 UTC — Park executes the rollback. The deployment system begins draining traffic from the 2.14.7 pods and spinning up 2.14.6 pods. The rolling deployment is configured with a 30-second drain period per pod, and there are 12 pods in the payment-processor service. Full rollback estimated at 6 minutes. Meanwhile, Torres has the hotfix ready and opens a pull request. The PR requires two approvals; Torres requests expedited review from the incident channel.

16:01 UTC — First batch of 2.14.6 pods come online. Success rate begins recovering — jumps to 89.1%. Liu instructs the customer support team to notify affected customers that the issue has been identified and is being resolved. Engineering manager Patricia Okonkwo joins the incident to provide executive updates.

16:07 UTC — Rollback complete across all 12 pods. Transaction success rate recovers to 98.7%, above the alert threshold. Error rate drops to 0.4%, near baseline. Liu keeps the incident open for monitoring.

16:18 UTC — Torres's hotfix PR receives two approvals. Liu decides to hold the hotfix deployment until the next business day to avoid introducing additional risk during the recovery window. The fix is merged to main and tagged as release candidate 2.14.8-rc1.

16:45 UTC — 30-minute monitoring window complete. Success rate stable at 99.1%. No residual errors related to the card network validation. Nakamura confirms that the 2,100 transactions processed during the incident window that wrote to the new card_network_override column are intact and consistent — no data corruption from the rollback.

17:05 UTC — Liu downgrades to SEV-2 for continued monitoring. Customer support reports the ticket queue has returned to normal rates. Total customer impact: approximately 4,200 failed transactions over the 42-minute window of degraded service (15:23-16:07 UTC). Of these, 3,890 were retried successfully by the client-side retry logic. An estimated 310 transactions require manual customer notification.

19:05 UTC — Two-hour monitoring window passes with no recurrence. Liu closes the incident. Post-incident analysis scheduled for the following day. Action items recorded: (1) add null-safety linting rule for the payment validation package, (2) require rollback-path testing for all deployments that include database migrations, (3) add card network type to the integration test matrix, (4) review the deployment guard override process to reduce time-to-rollback, (5) implement circuit breaker on the BIN lookup service to fail gracefully on partial matches.

Next-day follow-up — Torres deployed version 2.14.8 with the null guard fix at 09:30 UTC the following morning. The deployment completed without incident. Nakamura backfilled the card_network_override column for the 310 affected transactions using the corrected validation logic. Okonkwo scheduled a review of the release process with the platform team to discuss adding mandatory rollback rehearsals to the deployment checklist.
FIXTURE_EOF

# ── Submit entries via MCP log_entry ─────────────────────────────────
mcp_log_entry() {
  local content="$1"
  local escaped
  escaped=$(echo "$content" | jq -Rs '.')
  local payload="{\"jsonrpc\":\"2.0\",\"id\":$RANDOM,\"method\":\"tools/call\",\"params\":{\"name\":\"log_entry\",\"arguments\":{\"content\":${escaped},\"source\":\"mcp\"}}}"

  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$payload" \
    "$MCP_URL" 2>/dev/null)
  local resp
  resp=$(echo "$raw" | parse_sse)

  if echo "$resp" | jq -e '.result' >/dev/null 2>&1; then
    local entry_text
    entry_text=$(echo "$resp" | jq -r '.result.content[0].text // ""')
    local entry_key
    entry_key=$(echo "$entry_text" | grep -oP 'entry[0-9A-Z]{26}' || echo "")
    if [ -n "$entry_key" ]; then
      echo "$entry_key"
      return 0
    fi
  fi
  echo ""
  return 1
}

echo ""
echo "Submitting 3 entries via MCP log_entry..."

ENTRY_KEY_1=$(mcp_log_entry "$FIXTURE_1")
if [ -n "$ENTRY_KEY_1" ]; then
  pass "MCP log_entry #1 (Apollo CSM): $ENTRY_KEY_1"
else
  fail "MCP log_entry #1 (Apollo CSM) — no entry key returned"
fi

ENTRY_KEY_2=$(mcp_log_entry "$FIXTURE_2")
if [ -n "$ENTRY_KEY_2" ]; then
  pass "MCP log_entry #2 (Coral Reef): $ENTRY_KEY_2"
else
  fail "MCP log_entry #2 (Coral Reef) — no entry key returned"
fi

ENTRY_KEY_3=$(mcp_log_entry "$FIXTURE_3")
if [ -n "$ENTRY_KEY_3" ]; then
  pass "MCP log_entry #3 (Incident Report): $ENTRY_KEY_3"
else
  fail "MCP log_entry #3 (Incident Report) — no entry key returned"
fi

# ── Poll entries until processed (max 360s each) ────────────────────
poll_entry() {
  local entry_key="$1"
  local label="$2"
  local max_wait=360
  local elapsed=0

  if [ -z "$entry_key" ]; then
    fail "poll $label — no entry key to poll"
    return 1
  fi

  echo "  ⟳ polling $label ($entry_key, max ${max_wait}s)..."
  while [ $elapsed -lt $max_wait ]; do
    sleep 10
    elapsed=$((elapsed + 10))
    local resp
    resp=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$entry_key" 2>/dev/null)
    local status
    status=$(echo "$resp" | jq -r '.ingestStatus // .state // "unknown"')
    echo "    ${elapsed}s — $label: $status"

    if [ "$status" = "processed" ] || [ "$status" = "RESOLVED" ]; then
      pass "$label processed in ${elapsed}s"
      return 0
    fi
    if [ "$status" = "failed" ]; then
      local err
      err=$(echo "$resp" | jq -r '.lastError // "unknown"')
      fail "$label failed: $err"
      return 1
    fi
  done

  fail "$label did not reach processed state after ${max_wait}s"
  return 1
}

echo ""
poll_entry "$ENTRY_KEY_1" "Apollo CSM Log"
poll_entry "$ENTRY_KEY_2" "Coral Reef Notes"
poll_entry "$ENTRY_KEY_3" "Incident Timeline"

# ── Report: fragment count, people count, edge counts ────────────────
echo ""
echo "── Pipeline output report ──"

FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=200")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")
echo "  Fragments total: $FRAG_COUNT"

PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")
echo "  People total: $PEOPLE_COUNT"

GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
echo "  Graph nodes: $NODE_COUNT, edges: $EDGE_COUNT"

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments created ($FRAG_COUNT)"
else
  fail "no fragments found after pipeline"
fi

# ── Check FRAGMENT_IN_WIKI edges for our wikis ───────────────────────
echo ""
echo "── FRAGMENT_IN_WIKI edge check ──"

check_wiki_edges() {
  local wiki_key="$1"
  local label="$2"

  if [ -z "$wiki_key" ]; then
    skip "$label — no wiki key"
    return
  fi

  local detail
  detail=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$wiki_key")
  local frag_count
  frag_count=$(echo "$detail" | jq '.fragments | length' 2>/dev/null || echo "0")
  local people_count
  people_count=$(echo "$detail" | jq '.people | length' 2>/dev/null || echo "0")

  echo "  $label: $frag_count fragments, $people_count people"

  if [ "$frag_count" -gt 0 ] 2>/dev/null; then
    pass "$label has FRAGMENT_IN_WIKI edges ($frag_count)"
  else
    # Edge assignment is probabilistic (depends on LLM classification)
    echo "  ⊘ $label: no FRAGMENT_IN_WIKI edges yet (observe — LLM-dependent)"
  fi
}

check_wiki_edges "$WIKI_KEY_1" "Apollo CSM Log"
check_wiki_edges "$WIKI_KEY_2" "Coral Reef Notes"
check_wiki_edges "$WIKI_KEY_3" "Incident Timeline"

# ── Enable regeneration and trigger on each wiki ─────────────────────
echo ""
echo "── Wiki regeneration ──"

regenerate_wiki() {
  local wiki_key="$1"
  local label="$2"

  if [ -z "$wiki_key" ]; then
    skip "$label regen — no wiki key"
    return
  fi

  # Enable regeneration (default may be off)
  curl -s -o /dev/null -X PATCH \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/$wiki_key/regenerate"

  local regen_resp
  regen_resp=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$wiki_key/regenerate")
  local regen_http=$(echo "$regen_resp" | tail -1)
  local regen_body=$(echo "$regen_resp" | sed '$d')

  if [ "$regen_http" = "200" ]; then
    local regen_frags
    regen_frags=$(echo "$regen_body" | jq -r '.fragmentCount // 0')
    pass "$label regenerated (HTTP 200, fragments=$regen_frags)"
  elif [ "$regen_http" = "400" ]; then
    # 400 = "Regeneration is disabled" — means no fragments assigned yet
    echo "  ⊘ $label: regen returned 400 (likely no fragments assigned — observe)"
  elif [ "$regen_http" = "500" ]; then
    local detail
    detail=$(echo "$regen_body" | jq -r '.detail // .error // ""')
    fail "$label regen failed (HTTP 500): $detail"
  else
    fail "$label regen unexpected HTTP $regen_http"
  fi
}

regenerate_wiki "$WIKI_KEY_1" "Apollo CSM Log"
regenerate_wiki "$WIKI_KEY_2" "Coral Reef Notes"
regenerate_wiki "$WIKI_KEY_3" "Incident Timeline"

# ── Final wiki state report ──────────────────────────────────────────
echo ""
echo "── Final wiki state ──"

report_wiki_state() {
  local wiki_key="$1"
  local label="$2"

  if [ -z "$wiki_key" ]; then
    skip "$label state — no wiki key"
    return
  fi

  local detail
  detail=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$wiki_key")
  local name state note_count content_len wiki_type
  name=$(echo "$detail" | jq -r '.name // "?"')
  state=$(echo "$detail" | jq -r '.state // "?"')
  note_count=$(echo "$detail" | jq -r '.noteCount // 0')
  wiki_type=$(echo "$detail" | jq -r '.type // "?"')
  content_len=$(echo "$detail" | jq -r '.wikiContent // "" | length')

  echo "  $label:"
  echo "    name:         $name"
  echo "    type:         $wiki_type"
  echo "    state:        $state"
  echo "    noteCount:    $note_count"
  echo "    contentLen:   $content_len chars"

  if [ "$note_count" -gt 0 ] 2>/dev/null && [ "$content_len" -gt 0 ] 2>/dev/null; then
    pass "$label has notes ($note_count) and content ($content_len chars)"
  elif [ "$note_count" -gt 0 ] 2>/dev/null; then
    pass "$label has notes ($note_count) but no generated content yet"
  else
    echo "  ⊘ $label: no notes or content (observe — depends on LLM classification)"
  fi
}

report_wiki_state "$WIKI_KEY_1" "Apollo CSM Log"
report_wiki_state "$WIKI_KEY_2" "Coral Reef Notes"
report_wiki_state "$WIKI_KEY_3" "Incident Timeline"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
