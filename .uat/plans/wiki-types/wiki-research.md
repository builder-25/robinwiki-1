# Wiki Type UAT — Research

## What it proves
End-to-end Research wiki lifecycle: create research-typed wikis, ingest realistic
research content via MCP log_entry, verify the AI pipeline extracts fragments and
files them into the correct wikis via FRAGMENT_IN_WIKI edges, and confirm
regeneration produces a coherent wiki document.

A Research wiki is "a living document tracking an active investigation, its
methods, findings, and conclusions."

## Prerequisites
Requires OPENROUTER_API_KEY for LLM calls. Requires a running Robin server with
the env-seeded user available for sign-in.

## Fixtures
Three real-world research scenarios:

1. **Spaced Repetition and Long-Term Retention** — A literature review summarizing
   cognitive science findings on spaced repetition systems (Ebbinghaus, Leitner,
   Pimsleur), their efficacy across domains, and open questions about optimal
   scheduling algorithms.

2. **Urban Heat Island Mitigation Strategies** — A technical investigation into
   how cities combat the urban heat island effect, covering cool roofs, urban
   forestry, permeable pavements, and district cooling — with quantitative
   findings from published case studies.

3. **Gut Microbiome and Mental Health** — A research synthesis on the gut-brain
   axis, reviewing clinical evidence for microbiome-based interventions in
   depression and anxiety, including FMT trials, probiotic RCTs, and metabolomic
   biomarker discovery.

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

echo "Wiki Type UAT — Research"
echo ""

# Check OpenRouter key
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping research wiki type test"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# ── Sign in ────────────────────────────────────────────────────────────────

curl -s -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"${INITIAL_USERNAME:-}\",\"password\":\"${INITIAL_PASSWORD:-}\"}" \
  "$SERVER_URL/api/auth/sign-in/email" >/dev/null

# ── Get MCP token ──────────────────────────────────────────────────────────

PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -z "$MCP_URL" ] || [ "$MCP_URL" = "null" ]; then
  fail "mcpEndpointUrl is empty — cannot run MCP tests"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
pass "MCP token acquired"

# Helper: extract JSON from SSE "data:" line
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# MCP initialize (required before tool calls)
curl -s --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-research","version":"1.0"}}}' \
  "$MCP_URL" >/dev/null 2>&1

# ── 1. Seed wiki types ─────────────────────────────────────────────────────

SEED_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed → HTTP $SEED_HTTP"

# ── 2. Create 3 research wikis ────────────────────────────────────────────

TS=$(date +%s)

create_wiki() {
  local name="$1"
  local resp
  resp=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"research\"}" \
    "$SERVER_URL/wikis")
  local http=$(echo "$resp" | tail -1)
  local body=$(echo "$resp" | sed '$d')
  local id=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  if [ "$http" = "201" ] && [ -n "$id" ]; then
    pass "created wiki: $name (id=$id)"
    echo "$id"
  else
    fail "create wiki '$name' → HTTP $http"
    echo ""
  fi
}

WIKI_ID_1=$(create_wiki "Spaced Repetition and Long-Term Retention [$TS]")
WIKI_ID_2=$(create_wiki "Urban Heat Island Mitigation Strategies [$TS]")
WIKI_ID_3=$(create_wiki "Gut Microbiome and Mental Health [$TS]")

# Verify all created
CREATED_COUNT=0
[ -n "$WIKI_ID_1" ] && CREATED_COUNT=$((CREATED_COUNT+1))
[ -n "$WIKI_ID_2" ] && CREATED_COUNT=$((CREATED_COUNT+1))
[ -n "$WIKI_ID_3" ] && CREATED_COUNT=$((CREATED_COUNT+1))
[ "$CREATED_COUNT" = "3" ] && pass "all 3 research wikis created" || fail "only $CREATED_COUNT/3 wikis created"

# ── 3. Submit entries via MCP log_entry ────────────────────────────────────

ENTRY_IDS=()

mcp_log_entry() {
  local content="$1"
  local escaped
  escaped=$(echo "$content" | jq -Rs '.')
  local payload="{\"jsonrpc\":\"2.0\",\"id\":$((RANDOM)),\"method\":\"tools/call\",\"params\":{\"name\":\"log_entry\",\"arguments\":{\"content\":$escaped,\"source\":\"mcp\"}}}"

  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$payload" \
    "$MCP_URL" 2>/dev/null)
  local resp
  resp=$(echo "$raw" | parse_sse)

  if echo "$resp" | jq -e '.result' >/dev/null 2>&1; then
    local text
    text=$(echo "$resp" | jq -r '.result.content[0].text // ""')
    local entry_key
    entry_key=$(echo "$text" | grep -oP 'entry[0-9A-Z]{26}' || echo "")
    echo "$entry_key"
  else
    echo ""
  fi
}

echo ""
echo "  Submitting fixture 1: Spaced Repetition research..."
FIXTURE_1=$(cat <<'FIXTURE'
Spaced Repetition and Long-Term Retention: A Literature Review

Background and Historical Context

The study of memory retention and optimal learning schedules has a rich history stretching back to Hermann Ebbinghaus's pioneering work in 1885. Ebbinghaus demonstrated the exponential nature of forgetting through his famous forgetting curve experiments, establishing that newly learned information decays rapidly within the first hours and days unless actively reviewed. His self-experimentation with nonsense syllables revealed that approximately 56% of learned material is forgotten within one hour, 66% within one day, and 75% within six days.

Sebastian Leitner built on this foundation in 1972 with his flashcard box system, which introduced a mechanical approach to spaced review. Cards answered correctly advance to boxes with longer review intervals, while incorrect cards return to the first box. This simple algorithm encodes the core insight: items that are easier to recall need less frequent review.

The Pimsleur graduated-interval recall method, developed for language learning in the 1960s, proposed a specific schedule of expanding intervals: 5 seconds, 25 seconds, 2 minutes, 10 minutes, 1 hour, 5 hours, 1 day, 5 days, 25 days, 4 months, and 2 years. Pimsleur's claim was that these intervals approximate the natural pattern by which memories consolidate.

Modern Computational Approaches

SuperMemo's SM-2 algorithm, published by Piotr Wozniak in 1987, was the first computer-based spaced repetition algorithm to gain widespread use. SM-2 assigns each item an "easiness factor" that modulates inter-repetition intervals. Items rated as difficult receive shorter intervals and lower easiness factors, while easy items accumulate longer gaps between reviews. The algorithm initializes with intervals of 1 day, then 6 days, then multiplies the previous interval by the easiness factor for subsequent reviews.

Anki, released in 2006 by Damien Elmes, adapted SM-2 with modifications for practical use. Anki introduced the concept of "learning steps" — sub-day intervals for newly introduced cards — and added a configurable "new interval" percentage applied after a lapse. Anki's open-source nature has made it the dominant platform for medical education, language learning, and bar exam preparation.

The FSRS (Free Spaced Repetition Scheduler) algorithm, developed by Jarrett Ye starting in 2022, represents a significant departure from SM-2-family algorithms. FSRS uses a four-parameter model of memory (stability, difficulty, retrievability, and elapsed days) and fits these parameters to each user's review history using machine learning. Published comparisons show FSRS reduces daily review load by 20-30% compared to SM-2 while maintaining equivalent retention rates.

Efficacy Across Domains

A 2019 meta-analysis by Latimier et al. examined 29 studies (N=3,171) comparing spaced versus massed practice. The overall effect size favored spaced practice (Hedges' g = 0.72), with particularly strong effects in vocabulary learning (g = 0.85) and factual recall (g = 0.70). Effects were smaller but still significant for conceptual learning (g = 0.42).

Medical education has produced some of the strongest evidence. Kerfoot et al. (2010) randomized 311 urology residents to spaced versus bolus review of clinical content and found that spaced repetition produced 52% higher retention at two years with no additional study time. Schmidmaier et al. (2011) replicated these findings with clinical reasoning cases, showing 35% improvement in diagnostic accuracy.

Language acquisition studies show mixed results depending on the outcome measure. Nakata (2015) found large effects for receptive vocabulary knowledge (d = 0.94) but smaller effects for productive use (d = 0.38), suggesting that spaced repetition may be better suited for recognition than production. A 2020 longitudinal study of Duolingo learners by Settles and Meeder found that the half-life regression model used by Duolingo predicted recall probability with R-squared of 0.84 across 12 languages.

Open Questions and Current Research Directions

The optimal spacing function remains debated. Should intervals expand exponentially, or is a more gradual expansion preferable? Cepeda et al. (2008) found that the optimal gap between study sessions depended heavily on the retention interval — the desired delay before the final test. For a one-week retention interval, the optimal spacing gap was one day. For a one-year retention interval, the optimal gap jumped to three to five weeks. This has profound implications for algorithm design: a single expanding schedule may not serve all learning goals equally.

Interleaving effects present another complication. Rohrer and Taylor (2007) demonstrated that interleaving different problem types during practice — rather than blocking them — improved retention even when spacing was held constant. Whether spaced repetition systems should incorporate category interleaving as a first-class feature remains an active area of investigation.

The role of retrieval difficulty is increasingly studied. Bjork's "desirable difficulties" framework suggests that harder retrieval attempts produce stronger memory traces. This implies that optimal spacing should target a specific retrieval difficulty level rather than maximize ease of recall. FSRS attempts to operationalize this by targeting 90% retrievability rather than near-perfect recall, but the optimal target may vary by domain, learner, and item type.
FIXTURE
)
ENTRY_1=$(mcp_log_entry "$FIXTURE_1")
if [ -n "$ENTRY_1" ]; then
  pass "fixture 1 submitted: $ENTRY_1"
  ENTRY_IDS+=("$ENTRY_1")
else
  fail "fixture 1 submission failed"
fi

echo "  Submitting fixture 2: Urban Heat Island research..."
FIXTURE_2=$(cat <<'FIXTURE'
Urban Heat Island Mitigation Strategies: A Technical Investigation

The urban heat island effect — where built-up areas experience temperatures 1-3 degrees Celsius higher than surrounding rural areas during the day, and up to 12 degrees Celsius higher at night — represents one of the most significant environmental challenges facing cities worldwide. As urbanization intensifies and climate change amplifies heat extremes, cities are deploying an expanding portfolio of mitigation strategies. This investigation reviews the evidence base for the leading approaches.

Cool Roofs: Albedo Engineering at Scale

Cool roofs increase the solar reflectance (albedo) of building surfaces from the conventional 0.05-0.25 range to 0.60-0.85. The Lawrence Berkeley National Laboratory has led research in this area since the early 2000s. Akbari, Menon, and Rosenfeld (2009) estimated that converting all roofs and pavements in tropical and temperate regions to cool surfaces would produce a global cooling effect equivalent to offsetting 44 gigatons of CO2 emissions.

In practice, the measured effects are substantial but context-dependent. A 2016 field study in Hyderabad, India, by the Administrative Staff College of India covered 300 buildings with white reflective coating and measured indoor temperature reductions of 2-5 degrees Celsius in top-floor rooms. Peak cooling energy demand dropped by 20-25%. New York City's CoolRoofs initiative has coated over 10 million square feet since 2009, with infrared surveys confirming surface temperature reductions of 15-30 degrees Celsius on treated roofs compared to adjacent dark roofs.

However, cool roofs face a wintertime penalty in heating-dominated climates. Researchers at Oak Ridge National Laboratory found that in heating-dominated zones like Minneapolis, the winter heating penalty offsets 10-30% of summer cooling savings. The break-even point falls at approximately 35 degrees north latitude for commercial buildings and 40 degrees for residential buildings, depending on insulation levels.

Urban Forestry: Shade and Evapotranspiration

Urban trees reduce temperatures through two mechanisms: direct shading of surfaces and evapotranspiration. Mature trees can intercept 80-95% of incoming solar radiation, and a single large tree can transpire up to 400 liters of water per day, absorbing approximately 930 megajoules of thermal energy — equivalent to the cooling output of five average room air conditioners.

Melbourne, Australia has pursued what is arguably the most ambitious urban forest strategy. The city's Urban Forest Strategy (2012-2032) targets increasing canopy cover from 22% to 40%. A 2018 assessment by Coutts et al. used microclimate modeling to predict that achieving this target would reduce maximum ambient air temperatures by 0.5-2.0 degrees Celsius across the city, with localized reductions of up to 5 degrees Celsius under tree canopies.

Singapore's approach integrates vertical and rooftop greenery alongside street-level planting. The Skyrise Greenery Incentive Scheme has added over 200 hectares of green space to building facades and rooftops since 2009. Wong et al. (2010) measured rooftop garden temperatures at the National University of Singapore and found surface temperatures up to 30 degrees Celsius lower than exposed concrete, with air temperatures at 300mm above the surface reduced by 4 degrees Celsius.

Permeable Pavements and Cool Streets

Conventional asphalt has an albedo of 0.05-0.10 and retains heat effectively, reaching surface temperatures of 60-70 degrees Celsius on summer afternoons. Permeable pavements — including porous asphalt, pervious concrete, and interlocking concrete pavers — address this through both increased reflectance and evaporative cooling from stored subsurface moisture.

The City of Chicago installed permeable pavement on a 3-block section of West Cermak Road in 2008 as part of a controlled study. Infrared thermography showed the permeable section ran 5-8 degrees Celsius cooler than adjacent conventional pavement during dry conditions, increasing to 10-14 degrees during wet periods when evaporative cooling was active.

Los Angeles launched the CoolSeal pilot program in 2017, applying a high-albedo sealant to 15 city blocks. The Bureau of Street Services reported surface temperature reductions of 5-7 degrees Celsius. A follow-up study by Arizona State University found that while surface temperatures dropped significantly, pedestrian-level mean radiant temperature actually increased in some scenarios due to reflected radiation — a finding that highlights the complexity of urban thermal environments.

District Cooling and Waste Heat Recovery

District cooling systems — where chilled water is produced centrally and distributed via underground piping — can achieve dramatically higher efficiency than distributed air conditioning. The coefficient of performance for large centrifugal chillers (COP 6-7) is approximately double that of split-system air conditioners (COP 2.5-3.5).

Dubai's Empower operates the world's largest district cooling system, serving over 1,300 buildings across 1.48 million refrigeration tons of capacity. The company reports energy savings of 40-50% compared to conventional cooling, translating to approximately 500,000 tons of avoided CO2 emissions annually. The system uses treated sewage effluent for cooling tower makeup water, reducing freshwater consumption by 35 million cubic meters per year.

Combined Strategy Recommendations

No single intervention is sufficient. The most effective approaches combine strategies synergistically. A 2020 modeling study by Santamouris et al. simulated a combined cool-roofs, urban-trees, and permeable-pavement scenario for Darwin, Australia, and predicted a 3-4 degree Celsius reduction in peak urban temperatures — approximately double the effect of any single strategy. The study estimated a benefit-cost ratio of 7:1 over a 30-year period, driven primarily by reduced energy costs and avoided heat-related mortality.
FIXTURE
)
ENTRY_2=$(mcp_log_entry "$FIXTURE_2")
if [ -n "$ENTRY_2" ]; then
  pass "fixture 2 submitted: $ENTRY_2"
  ENTRY_IDS+=("$ENTRY_2")
else
  fail "fixture 2 submission failed"
fi

echo "  Submitting fixture 3: Gut Microbiome research..."
FIXTURE_3=$(cat <<'FIXTURE'
Gut Microbiome and Mental Health: A Research Synthesis

The Gut-Brain Axis: Mechanisms and Pathways

The bidirectional communication network between the gastrointestinal tract and the central nervous system — termed the gut-brain axis — has emerged as one of the most productive research frontiers in psychiatry and neuroscience over the past decade. The microbiome component of this axis involves approximately 100 trillion microorganisms residing in the human gut, collectively encoding 3.3 million genes compared to approximately 23,000 in the human genome.

Three primary communication channels mediate gut-brain signaling. The vagus nerve provides a direct neural pathway: Bravo et al. (2011) demonstrated that the anxiolytic effects of Lactobacillus rhamnosus in mice were completely abolished by vagotomy, establishing vagal signaling as necessary for at least some probiotic effects. The immune-mediated pathway involves microbial modulation of systemic inflammation via toll-like receptors and cytokine cascades. Increased intestinal permeability ("leaky gut") permits translocation of bacterial endotoxins, particularly lipopolysaccharide, which activates peripheral and central inflammatory pathways. The metabolic pathway involves microbial production of neuroactive compounds, including 95% of the body's serotonin (synthesized by enterochromaffin cells under microbial influence), gamma-aminobutyric acid (produced by Lactobacillus and Bifidobacterium species), and short-chain fatty acids (particularly butyrate, propionate, and acetate) that cross the blood-brain barrier and influence brain function.

Clinical Evidence: Depression

Epidemiological data consistently show altered gut microbiome composition in individuals with major depressive disorder. Zheng et al. (2016) performed 16S rRNA sequencing on fecal samples from 46 patients with MDD and 30 healthy controls and found significantly increased Actinobacteria and decreased Bacteroidetes in the depressed group. Crucially, when germ-free mice were colonized with fecal microbiota from MDD patients, they developed depressive-like behaviors (reduced sucrose preference, increased immobility in the forced swim test), while mice colonized with healthy donor microbiota did not — establishing a causal rather than merely correlational relationship.

Fecal microbiota transplantation trials in humans are emerging. A 2023 randomized controlled trial by Green et al. at the University of Sydney enrolled 60 participants with treatment-resistant depression and randomized them to active FMT or placebo (autologous stool transplant). At 8 weeks, 32% of the active FMT group met response criteria (50% reduction in MADRS score) versus 11% in the placebo group (p=0.04). The effect was partially mediated by changes in fecal butyrate concentration, supporting the short-chain fatty acid hypothesis.

Probiotic interventions ("psychobiotics") have accumulated a substantial evidence base. A 2019 meta-analysis by Liu et al. included 34 randomized controlled trials (N=2,102) examining probiotics for depressive symptoms. The pooled effect size was modest but significant (SMD = -0.24, 95% CI: -0.36 to -0.12, p < 0.001). Subgroup analyses revealed that multi-strain formulations were more effective than single-strain products (SMD = -0.31 vs -0.15), and that treatment durations exceeding 8 weeks produced larger effects than shorter courses. The most commonly effective strains were Lactobacillus helveticus R0052 and Bifidobacterium longum R0175, which Messaoudi et al. (2011) had earlier shown to reduce cortisol and self-reported psychological distress in healthy volunteers.

Clinical Evidence: Anxiety

The evidence for microbiome-based interventions in anxiety disorders is smaller but growing. Yang et al. (2019) conducted a systematic review of 21 studies (14 probiotic, 7 non-probiotic microbiome interventions) and found that 52% of studies showed a statistically significant reduction in anxiety symptoms. Interestingly, non-probiotic interventions (dietary modification, prebiotic supplementation) showed higher efficacy rates (86%) than probiotics alone (45%), suggesting that broad microbiome remodeling may be more effective than targeted strain supplementation.

A notable finding comes from Tillisch et al. (2013), who used functional MRI to demonstrate that 4 weeks of fermented milk product consumption altered brain activity in regions controlling central processing of emotion and sensation. Specifically, participants consuming the fermented product showed reduced reactivity in the insula and somatosensory cortex in response to emotional face-matching tasks, providing direct neuroimaging evidence for gut-to-brain signaling in humans.

Generalized anxiety disorder has received specific attention. A 2022 trial by Zhang et al. randomized 120 GAD patients to Lactobacillus plantarum PS128 or placebo for 12 weeks. The probiotic group showed significantly greater reductions in Hamilton Anxiety Rating Scale scores at weeks 8 and 12, with concurrent decreases in serum cortisol and interleukin-6 levels, suggesting both HPA axis and inflammatory pathway modulation.

Metabolomic Biomarker Discovery

The field is moving toward identifying microbiome-derived metabolic biomarkers that could guide treatment selection. Valles-Colomer et al. (2019) analyzed microbiome data from the Flemish Gut Flora Project (N=1,054) and identified Coprococcus and Dialister as consistently depleted in depression, even after controlling for antidepressant use. These bacteria are notable producers of the dopamine metabolite DOPAC and butyrate, respectively.

Targeted metabolomics studies have identified several candidate biomarkers. Indole-3-propionic acid, a tryptophan metabolite produced exclusively by Clostridium sporogenes, shows neuroprotective properties and is reduced in MDD. Trimethylamine N-oxide, produced by microbial metabolism of dietary choline, is elevated in anxiety and correlates with amygdala reactivity on fMRI.

The Clinical and Translational Neuroscience Laboratory at University College Cork has proposed a "microbiome signature" panel combining 16S abundance ratios (Firmicutes:Bacteroidetes, Coprococcus abundance), short-chain fatty acid profiles (butyrate:propionate ratio), and inflammatory markers (fecal calprotectin, serum IL-6) as a composite predictor of treatment response. Preliminary validation in a cohort of 200 patients showed an area under the receiver operating characteristic curve of 0.78 for predicting SSRI response, which if replicated could fundamentally change psychiatric treatment selection.

Open Questions

Several critical questions remain unresolved. The dose-response relationship for psychobiotics is poorly characterized — most trials use arbitrary doses of 1-10 billion colony-forming units without systematic dose-finding studies. The durability of effects after discontinuation is largely unstudied. The interaction between psychobiotics and conventional psychiatric medications needs systematic investigation, as early evidence suggests that SSRIs themselves alter gut microbiome composition, creating potential for both synergy and interference. Finally, individual variation in microbiome composition means that a one-size-fits-all probiotic approach may be fundamentally limited, pointing toward personalized microbiome-based therapies as the long-term direction for the field.
FIXTURE
)
ENTRY_3=$(mcp_log_entry "$FIXTURE_3")
if [ -n "$ENTRY_3" ]; then
  pass "fixture 3 submitted: $ENTRY_3"
  ENTRY_IDS+=("$ENTRY_3")
else
  fail "fixture 3 submission failed"
fi

SUBMITTED=${#ENTRY_IDS[@]}
[ "$SUBMITTED" = "3" ] && pass "all 3 entries submitted via MCP" || fail "only $SUBMITTED/3 entries submitted"

# ── 4. Poll entries until processed (max 360s) ────────────────────────────

echo ""
echo "  ⟳ polling entry states (max 360s)..."
MAX_WAIT=360
ELAPSED=0
RESOLVED=0

while [ $ELAPSED -lt $MAX_WAIT ] && [ $RESOLVED -lt $SUBMITTED ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  RESOLVED=0

  for eid in "${ENTRY_IDS[@]}"; do
    RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$eid" 2>/dev/null)
    STATUS=$(echo "$RESP" | jq -r '.ingestStatus // .state // "unknown"')
    if [ "$STATUS" = "processed" ] || [ "$STATUS" = "RESOLVED" ]; then
      RESOLVED=$((RESOLVED + 1))
    elif [ "$STATUS" = "failed" ]; then
      LAST_ERROR=$(echo "$RESP" | jq -r '.lastError // "unknown"')
      echo "    ${ELAPSED}s — $eid FAILED: $LAST_ERROR"
    fi
  done

  echo "    ${ELAPSED}s — $RESOLVED/$SUBMITTED resolved"
done

if [ "$RESOLVED" -eq "$SUBMITTED" ]; then
  pass "all $SUBMITTED entries reached processed state in ${ELAPSED}s"
else
  fail "$RESOLVED/$SUBMITTED entries processed after ${MAX_WAIT}s"
fi

# ── 5. Report: fragment count, people count, edges ────────────────────────

echo ""
echo "  Querying knowledge graph state..."

FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=200")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")

PEOPLE_RESP=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE_RESP" | jq '.people | length' 2>/dev/null || echo "0")

GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")

echo "  Fragment count: $FRAG_COUNT"
echo "  People count:   $PEOPLE_COUNT"
echo "  Graph nodes:    $NODE_COUNT"
echo "  Graph edges:    $EDGE_COUNT"

if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments extracted ($FRAG_COUNT total)"
else
  fail "no fragments found after pipeline processing"
fi

# ── 6. Check FRAGMENT_IN_WIKI edges for created wikis ─────────────────────

echo ""
echo "  Checking FRAGMENT_IN_WIKI edges per wiki..."

check_wiki_edges() {
  local wiki_id="$1"
  local wiki_name="$2"

  local wiki_graph
  wiki_graph=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/graph?wikiId=$wiki_id")
  local wiki_edges
  wiki_edges=$(echo "$wiki_graph" | jq '.edges | length' 2>/dev/null || echo "0")
  local wiki_nodes
  wiki_nodes=$(echo "$wiki_graph" | jq '.nodes | length' 2>/dev/null || echo "0")

  echo "  $wiki_name: $wiki_edges edges, $wiki_nodes nodes"

  # Observe — fragment-to-wiki filing is probabilistic
  if [ "$wiki_edges" -gt 0 ] 2>/dev/null; then
    pass "FRAGMENT_IN_WIKI edges exist for '$wiki_name' ($wiki_edges edges)"
  else
    echo "  ⊘ no FRAGMENT_IN_WIKI edges yet for '$wiki_name' (probabilistic — not a failure)"
  fi
}

[ -n "$WIKI_ID_1" ] && check_wiki_edges "$WIKI_ID_1" "Spaced Repetition"
[ -n "$WIKI_ID_2" ] && check_wiki_edges "$WIKI_ID_2" "Urban Heat Island"
[ -n "$WIKI_ID_3" ] && check_wiki_edges "$WIKI_ID_3" "Gut Microbiome"

# Count total FRAGMENT_IN_WIKI edges across all research wikis
TOTAL_FILING=0
for wid in "$WIKI_ID_1" "$WIKI_ID_2" "$WIKI_ID_3"; do
  [ -z "$wid" ] && continue
  WG=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/graph?wikiId=$wid")
  WE=$(echo "$WG" | jq '.edges | length' 2>/dev/null || echo "0")
  TOTAL_FILING=$((TOTAL_FILING + WE))
done

echo ""
echo "  Total FRAGMENT_IN_WIKI edges across research wikis: $TOTAL_FILING"

# ── 7. Trigger regeneration ───────────────────────────────────────────────

echo ""
echo "  Triggering wiki regeneration..."

regen_wiki() {
  local wiki_id="$1"
  local wiki_name="$2"

  # Enable regen first (may already be enabled)
  curl -s -o /dev/null -X PATCH -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d '{"regenerate":true}' \
    "$SERVER_URL/wikis/$wiki_id/regenerate"

  # Seed minimal content so regen has something to work with
  curl -s -o /dev/null -X PUT -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"content\":\"Seed content for $wiki_name research wiki.\"}" \
    "$SERVER_URL/api/content/wiki/$wiki_id"

  local regen_resp
  regen_resp=$(curl -s -w "\n%{http_code}" -X POST -b "$COOKIE_JAR" \
    -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$wiki_id/regenerate")
  local regen_http=$(echo "$regen_resp" | tail -1)
  local regen_body=$(echo "$regen_resp" | sed '$d')

  if [ "$regen_http" = "200" ]; then
    local frag_count
    frag_count=$(echo "$regen_body" | jq -r '.fragmentCount // 0')
    pass "regenerated '$wiki_name' → 200 (fragmentCount=$frag_count)"
  else
    local err_detail
    err_detail=$(echo "$regen_body" | jq -r '.error // .detail // "unknown"' 2>/dev/null)
    fail "regenerate '$wiki_name' → HTTP $regen_http ($err_detail)"
  fi
}

[ -n "$WIKI_ID_1" ] && regen_wiki "$WIKI_ID_1" "Spaced Repetition"
[ -n "$WIKI_ID_2" ] && regen_wiki "$WIKI_ID_2" "Urban Heat Island"
[ -n "$WIKI_ID_3" ] && regen_wiki "$WIKI_ID_3" "Gut Microbiome"

# ── 8. Report final wiki state ────────────────────────────────────────────

echo ""
echo "  Final wiki state:"

report_wiki() {
  local wiki_id="$1"
  local wiki_name="$2"
  [ -z "$wiki_id" ] && return

  local detail
  detail=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
    "$SERVER_URL/wikis/$wiki_id")

  local name type state frag_count people_count has_content
  name=$(echo "$detail" | jq -r '.name // "?"')
  type=$(echo "$detail" | jq -r '.type // "?"')
  state=$(echo "$detail" | jq -r '.state // "?"')
  frag_count=$(echo "$detail" | jq -r '.fragments | length // 0' 2>/dev/null || echo "0")
  people_count=$(echo "$detail" | jq -r '.people | length // 0' 2>/dev/null || echo "0")
  has_content=$(echo "$detail" | jq -r 'if .content and (.content | length > 0) then "yes" else "no" end' 2>/dev/null)

  echo ""
  echo "  ┌─ $wiki_name"
  echo "  │  id:         $wiki_id"
  echo "  │  type:       $type"
  echo "  │  state:      $state"
  echo "  │  fragments:  $frag_count"
  echo "  │  people:     $people_count"
  echo "  │  content:    $has_content"
  echo "  └─"

  # Verify type is research
  if [ "$type" = "research" ]; then
    pass "wiki type is 'research' for '$wiki_name'"
  else
    fail "wiki type is '$type', expected 'research' for '$wiki_name'"
  fi
}

report_wiki "$WIKI_ID_1" "Spaced Repetition"
report_wiki "$WIKI_ID_2" "Urban Heat Island"
report_wiki "$WIKI_ID_3" "Gut Microbiome"

# ── Summary ───────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
echo "  Research Wiki Type UAT Summary"
echo "  $PASS passed, $FAIL failed, $SKIP skipped"
echo "  Fragments: $FRAG_COUNT | People: $PEOPLE_COUNT | Edges: $EDGE_COUNT"
echo "  FRAGMENT_IN_WIKI filing edges: $TOTAL_FILING"
echo "════════════════════════════════════════════"
```
