# Wiki Type UAT — Voice

## What it proves
End-to-end lifecycle for **voice** wikis: create 3 voice wikis, seed wiki types,
submit 3 entries via MCP (one per wiki), poll until processed, report extracted
fragments/people/edges, trigger regeneration, report final wiki state.

Voice wikis are "a style guide capturing communication patterns, tone preferences,
and voice identity."

## Prerequisites
- Server running at `$SERVER_URL` (default `http://localhost:3000`)
- `core/.env` populated with auth credentials
- `OPENROUTER_API_KEY` set in environment for LLM calls

## Fixtures

### Fixture 1 — Startup Product Voice Guide

> A founder documents the communication voice for their early-stage SaaS product,
> covering website copy, onboarding flows, error messages, and support channels.

```
Our product voice is the personality behind every word a user reads. We sound like a sharp friend who happens to be an expert — never a faceless corporation, never a condescending tutorial. Here is how we talk.

Core voice attributes: We are confident but not arrogant. When we know something, we say it plainly. We do not hedge with phrases like "we think" or "it might be possible that" unless genuine uncertainty exists. We are warm but efficient. Every sentence earns its place. We cut filler words ruthlessly — "actually," "basically," "just," "really" — unless they serve rhythm. We are precise about technical concepts but relaxed in delivery. A user should feel like they are reading a well-edited Slack message from a senior engineer, not a legal document.

Website copy guidelines: Headlines are active and specific. "Ship faster with automated deploys" beats "A solution for modern deployment workflows." Subheadings answer the question the headline raises. Body copy uses second person — "you" not "users" or "one." Feature descriptions lead with the outcome, not the mechanism. Wrong: "Our CI/CD pipeline integrates with GitHub Actions via webhook listeners." Right: "Push to main and your changes are live in ninety seconds." We never use superlatives we cannot prove. No "fastest," "most powerful," or "best-in-class" without a benchmark or citation.

Onboarding flow voice: First-run copy is encouraging without being patronizing. We acknowledge the user made a choice by signing up and we respect their time. Progress indicators use concrete language — "3 steps left" not "almost there!" Error states during setup are honest and actionable. "We could not connect to your GitHub account. Check that the OAuth app has repo access, then try again." We avoid cute error messages during onboarding because confusion compounds when someone is already learning. Celebration moments are brief. A checkmark and "You're set up" is better than confetti and three paragraphs of congratulation.

Error messages and system notifications: Every error message follows the pattern: what happened, why it matters, what to do next. We do not blame the user. "That API key is not valid" not "You entered an invalid API key." We distinguish between user-fixable problems and system problems. If the user cannot fix it, we say so: "Something went wrong on our end. We have been notified and are looking into it." Retry messaging includes expected wait times when possible. "Try again in a few minutes" beats "try again later." We never show raw error codes to users unless they are filing a support ticket, in which case we display them in a copyable format.

Support channel tone: Support conversations are warmer than product copy but equally precise. We greet by name when available. We do not use canned responses verbatim — templates exist as starting points, not scripts. Empathy is shown through action, not performative phrases. Instead of "I completely understand your frustration," we say "Let me fix that for you right now" and then do it. We explain what we are doing and why, so the user learns something. Closing a ticket includes a concrete summary of what changed and what the user should expect going forward.

Words we use: ship, build, connect, set up, check, update, deploy, configure. Words we avoid: leverage, utilize, facilitate, synergize, disrupt, innovative, cutting-edge, next-generation, seamless. Contractions are default: "we're," "you'll," "it's." Full forms are reserved for emphasis or legal contexts. Numbers under ten are spelled out in marketing copy, written as digits in product UI.
```

### Fixture 2 — Nonprofit Organization Communication Tone

> A nonprofit's communications director documents voice standards for grant
> proposals, donor outreach, social media, and internal team communications.

```
The Meridian Foundation speaks with one voice across every channel, from a grant application to an Instagram caption. That voice reflects who we are: practitioners first, advocates second, storytellers when it serves the mission. This document defines how we communicate and why those choices matter.

Our foundational voice principles: We lead with evidence, not emotion. Our work creates real impact and we let the numbers and stories speak. We never manufacture urgency or guilt. A donor who gives because they feel informed and inspired will give again. A donor who gives because they feel manipulated will not. We are specific about outcomes. "Provided clean water access to 4,200 households in the Rift Valley" is stronger than "helped thousands of families." We name places, count people, and cite timelines. We respect the communities we serve by centering their agency. They are not passive recipients of our help. They are partners, collaborators, and leaders in their own development. We say "families who participate in the program" not "families we serve" or "beneficiaries."

Grant proposal voice: Grant writing is precise, evidence-based, and forward-looking. We match the funder's vocabulary without losing our own voice. If a foundation uses "theory of change," we use it. If they prefer "logic model," we adapt. Proposals follow the structure the funder requests — creativity in structure is not appreciated. Every claim is sourced. We cite our own longitudinal data when available, third-party evaluations when they exist, and peer-reviewed research as context. Budget narratives read as clearly as program narratives. A program officer should understand exactly what each line item funds and why that amount is reasonable. We avoid jargon that obscures meaning. "Capacity building" only appears if we immediately define what capacity we are building and how.

Donor communication guidelines: Annual reports tell stories that data alone cannot. Each report opens with a single person or community whose trajectory changed because of the work. That person is named, quoted, and photographed only with their informed consent and editorial approval. Appeal letters are honest about what money does. We break down costs concretely: "Your gift of one hundred fifty dollars trains one community health worker for six months." We never imply that a single donation can solve a systemic problem. Acknowledgment letters are sent within forty-eight hours. They are warm, specific about the gift amount and designation, and include a sentence about recent program impact. Tax receipt language is clear and separated from emotional content. Email subject lines are factual, not clickbait. "Q3 Impact Report: Rift Valley Water Project" not "You Won't Believe What Your Donation Did."

Social media tone: Social media is where we are most conversational but never casual about the work. We post original photography with informed consent documentation on file. Stock photos are never used to represent communities or program participants. Captions lead with the most interesting fact or quote. Attribution is always included for quotes. We engage with comments thoughtfully and within twenty-four hours. We do not argue with critics publicly — we acknowledge, provide factual corrections if needed, and move substantive disagreements to direct messages. Hashtags are limited to three per post, all directly relevant to the content. We do not use trending hashtags that are unrelated to our mission. Humor is acceptable when it is self-deprecating or celebratory. We never joke about the problems we exist to address.

Internal communication standards: Internal emails and Slack messages model the same clarity we expect in external communications. Meeting agendas are circulated twenty-four hours in advance with required pre-reads clearly marked. Decision memos follow the BLUF format: bottom line up front, then supporting context. Feedback is specific, timely, and directed at work product rather than character. "The budget narrative needs stronger justification for the staffing increase" is useful. "This section needs work" is not. We cc people intentionally, not defensively. When staff disagree about strategy, the conversation happens in a meeting with a decision-maker present, not in an email thread. Andrea Williams established these standards in 2019 and they were revised by Marcus Chen during the 2023 organizational review.
```

### Fixture 3 — Personal Writing Voice Journal

> An individual writer journals about their evolving writing voice, capturing
> lessons from mentors, editorial feedback, and self-observation about their prose
> tendencies across blog posts, essays, and professional correspondence.

```
I have been thinking about voice as a writer for years but only recently started documenting what I actually do versus what I think I do. This is my attempt to pin down the patterns, good and bad, so I can be intentional about them instead of just hoping for consistency.

What my voice sounds like at its best: When I am writing well, my sentences are medium-length and varied in rhythm. I tend toward a three-beat pattern — short, medium, long — and then reset. I use concrete nouns and active verbs. I reach for metaphors from physical craft: woodworking, cooking, building. My friend Dara once told me that my best writing sounds like I am explaining something at a dinner party, not giving a lecture. I want to keep that quality. The hallmark of my voice is that I take complicated ideas seriously without taking myself seriously. I will spend a paragraph carefully unpacking a philosophical concept and then undercut it with an honest admission that I am not sure I have it right. That humility is genuine and readers seem to trust it. My editor at The Loom, James Hayward, calls this "earned informality" — you have to demonstrate competence before you can afford to be casual.

Patterns I am trying to break: I overuse em dashes. I use them as a crutch when I do not want to commit to a full aside or restructure a sentence. Limit is two per essay, maximum. I hedge too much in first drafts. "It seems like," "I think," "perhaps" — these are safety blankets that weaken claims. In revision, I audit every hedge and keep only the ones where genuine uncertainty exists. I have a habit of burying the most interesting idea three paragraphs in. My natural writing process is thinking-on-the-page, which means the first few paragraphs are often throat-clearing. In revision, I look for the sentence that would make someone stop scrolling and move it to the opening. Rachel Torres at the Brevity Workshop taught me to read my drafts backward paragraph by paragraph to find the buried lede. That technique alone improved my work more than any other single piece of advice.

Blog post voice versus essay voice: Blog posts are conversational, present-tense, and structured with clear section breaks. I write to a reader who has the same interests but maybe less context. I explain references. I link to sources. I use "you" freely. Sentences are shorter on average. I aim for a readability score that a motivated fifteen-year-old could follow. Essays are more layered. I allow longer sentences, more subordinate clauses, more ambiguity. I trust the reader to sit with an idea without needing it resolved immediately. I use fewer links and more integrated citations. The pacing is slower because the reader has committed to the form. The voice is still mine in both, but the blog post version of me is the one leaning forward in the chair, and the essay version is the one sitting back.

Professional correspondence voice: Emails to editors are warm but brief. I lead with gratitude, move to the ask, close with a timeline. I match their formality level after the first exchange — if they sign off with just their first name, I do too. Pitch letters are the one place I allow myself to sell. I lead with the hook, explain why now, and include a single relevant credential. No more than three hundred words. I learned this structure from Patricia Engel during a workshop residency in 2022, and every successful pitch I have landed since follows it. Emails to sources are careful about power dynamics. I explain exactly how I plan to use their words, offer quote approval before publication, and follow up to share the finished piece. These are relationships, not transactions.

Voice inventory — the words and rhythms that are mine: I start paragraphs with "The thing about" more than I should but it works as a transition device when used sparingly. I end pieces by circling back to the opening image or question. I use parallel structure in threes, almost always. I prefer "and" to ampersands, dashes to semicolons, periods to exclamation points. My sentence endings tend to land on a stressed syllable, which gives them a feeling of weight. This is not something I planned but something I noticed when I started reading my drafts aloud, a practice my mentor Sarah Kessler insisted on during my MFA year. She was right. The ear catches what the eye misses.
```

## Script

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "${PROJECT_ROOT:-.}"
source core/.env 2>/dev/null || true

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp /tmp/uat-voice-cookies-XXXXXX.txt)
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0; FAIL=0; SKIP=0
pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  ⊘ $1"; }

echo "Wiki Type UAT — Voice"
echo ""

# Guard: requires OPENROUTER_API_KEY for LLM pipeline
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  skip "OPENROUTER_API_KEY not set — skipping voice wiki UAT"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

########################################################################
# 1. Sign in
########################################################################
echo "— Sign in"
SIGNIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d "{\"email\":\"$INITIAL_USERNAME\",\"password\":\"$INITIAL_PASSWORD\"}" \
  "$SERVER_URL/api/auth/sign-in/email")
[ "$SIGNIN_HTTP" = "200" ] && pass "sign-in → 200" || fail "sign-in → HTTP $SIGNIN_HTTP"

########################################################################
# 2. Get MCP token from profile
########################################################################
echo "— MCP token"
PROFILE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" "$SERVER_URL/users/profile")
MCP_URL=$(echo "$PROFILE" | jq -r '.mcpEndpointUrl // ""')

if [ -n "$MCP_URL" ] && [ "$MCP_URL" != "null" ]; then
  MCP_TOKEN=$(echo "$MCP_URL" | grep -oP 'token=\K.*')
  MCP_URL="$SERVER_URL/mcp?token=$MCP_TOKEN"
  pass "MCP token acquired"
else
  fail "mcpEndpointUrl is empty — cannot proceed"
  echo ""
  echo "$PASS passed, $FAIL failed, $SKIP skipped"
  exit 0
fi

# Helper: parse SSE response
parse_sse() { grep '^data: ' | head -1 | sed 's/^data: //'; }

# MCP initialize (required before tool calls)
curl -s --max-time 10 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"uat-voice","version":"1.0"}}}' \
  "$MCP_URL" >/dev/null 2>&1

########################################################################
# 3. Seed wiki types
########################################################################
echo "— Seed wiki types"
SEED_HTTP=$(curl -s -o /tmp/uat-voice-seed.json -w "%{http_code}" \
  -X POST -b "$COOKIE_JAR" \
  -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/setup")
[ "$SEED_HTTP" = "200" ] && pass "POST /wiki-types/setup → 200" || fail "seed wiki types → HTTP $SEED_HTTP"

# Verify voice type exists
VOICE_EXISTS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wiki-types/voice" | jq -r '.slug // ""')
[ "$VOICE_EXISTS" = "voice" ] && pass "voice wiki type exists" || fail "voice wiki type not found after seed"

########################################################################
# 4. Create 3 voice wikis
########################################################################
echo "— Create voice wikis"

create_wiki() {
  local name="$1"
  local desc="$2"
  local var_name="$3"
  local result
  result=$(curl -s -w "\n%{http_code}" -X POST \
    -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost:3000" \
    -d "{\"name\":\"$name\",\"type\":\"voice\",\"prompt\":\"$desc\"}" \
    "$SERVER_URL/wikis")
  local http_code
  http_code=$(echo "$result" | tail -1)
  local body
  body=$(echo "$result" | sed '$d')
  local wiki_id
  wiki_id=$(echo "$body" | jq -r '.lookupKey // .id // ""')
  local wiki_slug
  wiki_slug=$(echo "$body" | jq -r '.slug // ""')

  if [ "$http_code" = "201" ] && [ -n "$wiki_id" ]; then
    pass "created wiki: $name (id=$wiki_id)"
    eval "${var_name}_ID='$wiki_id'"
    eval "${var_name}_SLUG='$wiki_slug'"
  else
    fail "create wiki '$name' → HTTP $http_code"
    eval "${var_name}_ID=''"
    eval "${var_name}_SLUG=''"
  fi
}

create_wiki "Startup Product Voice" "Style guide for SaaS product communication" "WIKI1"
create_wiki "Nonprofit Comms Tone" "Communication standards for nonprofit channels" "WIKI2"
create_wiki "Personal Writing Voice" "Voice journal for an individual writer" "WIKI3"

# Verify all created with type=voice
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  if [ -n "$WID" ]; then
    WTYPE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/$WID" | jq -r '.type // ""')
    [ "$WTYPE" = "voice" ] && pass "$WIKI_VAR type=voice" || fail "$WIKI_VAR type=$WTYPE (expected voice)"
  fi
done

# Enable regen on all 3 wikis
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  if [ -n "$WID" ]; then
    REGEN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PATCH -b "$COOKIE_JAR" \
      -H "Content-Type: application/json" \
      -H "Origin: http://localhost:3000" \
      -d '{"regenerate":true}' \
      "$SERVER_URL/wikis/$WID/regenerate")
    [ "$REGEN_HTTP" = "200" ] && pass "$WIKI_VAR regen enabled" || fail "$WIKI_VAR regen toggle → HTTP $REGEN_HTTP"
  fi
done

########################################################################
# 5. Submit 3 entries via MCP (one per wiki, using log_entry)
########################################################################
echo "— Submit entries via MCP"

TS=$(date +%s)

# Fixture 1: startup product voice guide
read -r -d '' FIXTURE1 << 'FIXTURE_EOF'
Our product voice is the personality behind every word a user reads. We sound like a sharp friend who happens to be an expert — never a faceless corporation, never a condescending tutorial. Here is how we talk.\n\nCore voice attributes: We are confident but not arrogant. When we know something, we say it plainly. We do not hedge with phrases like \"we think\" or \"it might be possible that\" unless genuine uncertainty exists. We are warm but efficient. Every sentence earns its place. We cut filler words ruthlessly — \"actually,\" \"basically,\" \"just,\" \"really\" — unless they serve rhythm. We are precise about technical concepts but relaxed in delivery. A user should feel like they are reading a well-edited Slack message from a senior engineer, not a legal document.\n\nWebsite copy guidelines: Headlines are active and specific. \"Ship faster with automated deploys\" beats \"A solution for modern deployment workflows.\" Subheadings answer the question the headline raises. Body copy uses second person — \"you\" not \"users\" or \"one.\" Feature descriptions lead with the outcome, not the mechanism. Wrong: \"Our CI/CD pipeline integrates with GitHub Actions via webhook listeners.\" Right: \"Push to main and your changes are live in ninety seconds.\" We never use superlatives we cannot prove. No \"fastest,\" \"most powerful,\" or \"best-in-class\" without a benchmark or citation.\n\nOnboarding flow voice: First-run copy is encouraging without being patronizing. We acknowledge the user made a choice by signing up and we respect their time. Progress indicators use concrete language — \"3 steps left\" not \"almost there!\" Error states during setup are honest and actionable. \"We could not connect to your GitHub account. Check that the OAuth app has repo access, then try again.\" We avoid cute error messages during onboarding because confusion compounds when someone is already learning. Celebration moments are brief. A checkmark and \"You are set up\" is better than confetti and three paragraphs of congratulation.\n\nError messages and system notifications: Every error message follows the pattern: what happened, why it matters, what to do next. We do not blame the user. \"That API key is not valid\" not \"You entered an invalid API key.\" We distinguish between user-fixable problems and system problems. If the user cannot fix it, we say so: \"Something went wrong on our end. We have been notified and are looking into it.\" Retry messaging includes expected wait times when possible. \"Try again in a few minutes\" beats \"try again later.\" We never show raw error codes to users unless they are filing a support ticket, in which case we display them in a copyable format.\n\nSupport channel tone: Support conversations are warmer than product copy but equally precise. We greet by name when available. We do not use canned responses verbatim — templates exist as starting points, not scripts. Empathy is shown through action, not performative phrases. Instead of \"I completely understand your frustration,\" we say \"Let me fix that for you right now\" and then do it. We explain what we are doing and why, so the user learns something. Closing a ticket includes a concrete summary of what changed and what the user should expect going forward.\n\nWords we use: ship, build, connect, set up, check, update, deploy, configure. Words we avoid: leverage, utilize, facilitate, synergize, disrupt, innovative, cutting-edge, next-generation, seamless. Contractions are default. Numbers under ten are spelled out in marketing copy, written as digits in product UI.
FIXTURE_EOF

# Fixture 2: nonprofit communication tone
read -r -d '' FIXTURE2 << 'FIXTURE_EOF'
The Meridian Foundation speaks with one voice across every channel, from a grant application to an Instagram caption. That voice reflects who we are: practitioners first, advocates second, storytellers when it serves the mission. This document defines how we communicate and why those choices matter.\n\nOur foundational voice principles: We lead with evidence, not emotion. Our work creates real impact and we let the numbers and stories speak. We never manufacture urgency or guilt. A donor who gives because they feel informed and inspired will give again. A donor who gives because they feel manipulated will not. We are specific about outcomes. \"Provided clean water access to 4,200 households in the Rift Valley\" is stronger than \"helped thousands of families.\" We name places, count people, and cite timelines. We respect the communities we serve by centering their agency. They are not passive recipients of our help. They are partners, collaborators, and leaders in their own development. We say \"families who participate in the program\" not \"families we serve\" or \"beneficiaries.\"\n\nGrant proposal voice: Grant writing is precise, evidence-based, and forward-looking. We match the funder vocabulary without losing our own voice. If a foundation uses \"theory of change,\" we use it. If they prefer \"logic model,\" we adapt. Proposals follow the structure the funder requests — creativity in structure is not appreciated. Every claim is sourced. We cite our own longitudinal data when available, third-party evaluations when they exist, and peer-reviewed research as context. Budget narratives read as clearly as program narratives. A program officer should understand exactly what each line item funds and why that amount is reasonable. We avoid jargon that obscures meaning. \"Capacity building\" only appears if we immediately define what capacity we are building and how.\n\nDonor communication guidelines: Annual reports tell stories that data alone cannot. Each report opens with a single person or community whose trajectory changed because of the work. That person is named, quoted, and photographed only with their informed consent and editorial approval. Appeal letters are honest about what money does. We break down costs concretely: \"Your gift of one hundred fifty dollars trains one community health worker for six months.\" We never imply that a single donation can solve a systemic problem. Acknowledgment letters are sent within forty-eight hours. They are warm, specific about the gift amount and designation, and include a sentence about recent program impact. Tax receipt language is clear and separated from emotional content. Email subject lines are factual, not clickbait. \"Q3 Impact Report: Rift Valley Water Project\" not \"You Won't Believe What Your Donation Did.\"\n\nSocial media tone: Social media is where we are most conversational but never casual about the work. We post original photography with informed consent documentation on file. Stock photos are never used to represent communities or program participants. Captions lead with the most interesting fact or quote. Attribution is always included for quotes. We engage with comments thoughtfully and within twenty-four hours. We do not argue with critics publicly — we acknowledge, provide factual corrections if needed, and move substantive disagreements to direct messages. Hashtags are limited to three per post, all directly relevant to the content. We do not use trending hashtags unrelated to our mission.\n\nInternal communication standards: Internal emails and Slack messages model the same clarity we expect in external communications. Meeting agendas are circulated twenty-four hours in advance with required pre-reads clearly marked. Decision memos follow the BLUF format: bottom line up front, then supporting context. Feedback is specific, timely, and directed at work product rather than character. \"The budget narrative needs stronger justification for the staffing increase\" is useful. \"This section needs work\" is not. We cc people intentionally, not defensively. When staff disagree about strategy, the conversation happens in a meeting with a decision-maker present, not in an email thread. Andrea Williams established these standards in 2019 and they were revised by Marcus Chen during the 2023 organizational review.
FIXTURE_EOF

# Fixture 3: personal writing voice journal
read -r -d '' FIXTURE3 << 'FIXTURE_EOF'
I have been thinking about voice as a writer for years but only recently started documenting what I actually do versus what I think I do. This is my attempt to pin down the patterns, good and bad, so I can be intentional about them instead of just hoping for consistency.\n\nWhat my voice sounds like at its best: When I am writing well, my sentences are medium-length and varied in rhythm. I tend toward a three-beat pattern — short, medium, long — and then reset. I use concrete nouns and active verbs. I reach for metaphors from physical craft: woodworking, cooking, building. My friend Dara once told me that my best writing sounds like I am explaining something at a dinner party, not giving a lecture. I want to keep that quality. The hallmark of my voice is that I take complicated ideas seriously without taking myself seriously. I will spend a paragraph carefully unpacking a philosophical concept and then undercut it with an honest admission that I am not sure I have it right. That humility is genuine and readers seem to trust it. My editor at The Loom, James Hayward, calls this \"earned informality\" — you have to demonstrate competence before you can afford to be casual.\n\nPatterns I am trying to break: I overuse em dashes. I use them as a crutch when I do not want to commit to a full aside or restructure a sentence. Limit is two per essay, maximum. I hedge too much in first drafts. \"It seems like,\" \"I think,\" \"perhaps\" — these are safety blankets that weaken claims. In revision, I audit every hedge and keep only the ones where genuine uncertainty exists. I have a habit of burying the most interesting idea three paragraphs in. My natural writing process is thinking-on-the-page, which means the first few paragraphs are often throat-clearing. In revision, I look for the sentence that would make someone stop scrolling and move it to the opening. Rachel Torres at the Brevity Workshop taught me to read my drafts backward paragraph by paragraph to find the buried lede. That technique alone improved my work more than any other single piece of advice.\n\nBlog post voice versus essay voice: Blog posts are conversational, present-tense, and structured with clear section breaks. I write to a reader who has the same interests but maybe less context. I explain references. I link to sources. I use \"you\" freely. Sentences are shorter on average. I aim for a readability score that a motivated fifteen-year-old could follow. Essays are more layered. I allow longer sentences, more subordinate clauses, more ambiguity. I trust the reader to sit with an idea without needing it resolved immediately. I use fewer links and more integrated citations. The pacing is slower because the reader has committed to the form. The voice is still mine in both, but the blog post version of me is the one leaning forward in the chair, and the essay version is the one sitting back.\n\nProfessional correspondence voice: Emails to editors are warm but brief. I lead with gratitude, move to the ask, close with a timeline. I match their formality level after the first exchange — if they sign off with just their first name, I do too. Pitch letters are the one place I allow myself to sell. I lead with the hook, explain why now, and include a single relevant credential. No more than three hundred words. I learned this structure from Patricia Engel during a workshop residency in 2022, and every successful pitch I have landed since follows it. Emails to sources are careful about power dynamics. I explain exactly how I plan to use their words, offer quote approval before publication, and follow up to share the finished piece. These are relationships, not transactions.\n\nVoice inventory — the words and rhythms that are mine: I start paragraphs with \"The thing about\" more than I should but it works as a transition device when used sparingly. I end pieces by circling back to the opening image or question. I use parallel structure in threes, almost always. I prefer \"and\" to ampersands, dashes to semicolons, periods to exclamation points. My sentence endings tend to land on a stressed syllable, which gives them a feeling of weight. This is not something I planned but something I noticed when I started reading my drafts aloud, a practice my mentor Sarah Kessler insisted on during my MFA year. She was right. The ear catches what the eye misses.
FIXTURE_EOF

submit_entry_mcp() {
  local content="$1"
  local label="$2"
  local raw
  raw=$(curl -s --max-time 30 -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$((RANDOM % 9000 + 1000)),\"method\":\"tools/call\",\"params\":{\"name\":\"log_entry\",\"arguments\":{\"content\":\"$content\",\"source\":\"mcp\"}}}" \
    "$MCP_URL" 2>/dev/null)
  local resp
  resp=$(echo "$raw" | parse_sse)

  if echo "$resp" | jq -e '.result' >/dev/null 2>&1; then
    local text
    text=$(echo "$resp" | jq -r '.result.content[0].text // ""')
    local is_err
    is_err=$(echo "$resp" | jq -r '.result.isError // false')
    if [ "$is_err" = "true" ]; then
      fail "MCP log_entry ($label): $text"
      echo ""
    else
      pass "MCP log_entry ($label): $text"
      # Extract entry key from "Entry queued: entry01ABC..." response
      echo "$text" | grep -oP 'entry[0-9A-Z]{26}' || echo ""
    fi
  else
    fail "MCP log_entry ($label): no result (raw: ${raw:0:200})"
    echo ""
  fi
}

ENTRY1_KEY=$(submit_entry_mcp "$FIXTURE1" "startup voice")
ENTRY2_KEY=$(submit_entry_mcp "$FIXTURE2" "nonprofit tone")
ENTRY3_KEY=$(submit_entry_mcp "$FIXTURE3" "personal voice")

########################################################################
# 6. Poll entries until processed (max 360s)
########################################################################
echo "— Poll entry processing (max 360s)"

poll_entry() {
  local entry_key="$1"
  local label="$2"
  if [ -z "$entry_key" ]; then
    fail "no entry key for $label — skipping poll"
    return
  fi

  local elapsed=0
  local max_wait=360
  local final_status=""
  while [ $elapsed -lt $max_wait ]; do
    sleep 10
    elapsed=$((elapsed + 10))
    local resp
    resp=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/entries/$entry_key" 2>/dev/null)
    local status
    status=$(echo "$resp" | jq -r '.ingestStatus // .state // "unknown"')
    echo "    $label: ${elapsed}s — $status"

    if [ "$status" = "processed" ] || [ "$status" = "RESOLVED" ]; then
      final_status="$status"
      break
    fi
    if [ "$status" = "failed" ]; then
      local err
      err=$(echo "$resp" | jq -r '.lastError // "unknown"')
      fail "$label entry failed: $err"
      final_status="failed"
      break
    fi
  done

  if [ "$final_status" = "processed" ] || [ "$final_status" = "RESOLVED" ]; then
    pass "$label reached $final_status in ${elapsed}s"
  elif [ -z "$final_status" ]; then
    fail "$label did not reach processed after ${max_wait}s (observe: LLM latency)"
  fi
}

poll_entry "$ENTRY1_KEY" "startup voice"
poll_entry "$ENTRY2_KEY" "nonprofit tone"
poll_entry "$ENTRY3_KEY" "personal voice"

########################################################################
# 7. Report fragments
########################################################################
echo "— Report: fragments"
FRAGS=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/fragments?limit=100")
FRAG_COUNT=$(echo "$FRAGS" | jq '.fragments | length' 2>/dev/null || echo "0")
echo "    total fragments: $FRAG_COUNT"
if [ "$FRAG_COUNT" -gt 0 ] 2>/dev/null; then
  pass "fragments exist ($FRAG_COUNT)"
  echo "$FRAGS" | jq -r '.fragments[:10][] | "    - \(.title // .id)"' 2>/dev/null
else
  fail "no fragments after processing 3 voice entries"
fi

########################################################################
# 8. Report people
########################################################################
echo "— Report: people"
PEOPLE=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/people")
PEOPLE_COUNT=$(echo "$PEOPLE" | jq '.people | length' 2>/dev/null || echo "0")
echo "    total people: $PEOPLE_COUNT"
if [ "$PEOPLE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "people extracted ($PEOPLE_COUNT)"
  echo "$PEOPLE" | jq -r '.people[:10][] | "    - \(.name // .id)"' 2>/dev/null
else
  echo "    (observe: people extraction is probabilistic — zero is acceptable)"
fi

########################################################################
# 9. Report edges (graph)
########################################################################
echo "— Report: graph edges"
GRAPH=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/graph")
NODE_COUNT=$(echo "$GRAPH" | jq '.nodes | length' 2>/dev/null || echo "0")
EDGE_COUNT=$(echo "$GRAPH" | jq '.edges | length' 2>/dev/null || echo "0")
echo "    nodes: $NODE_COUNT, edges: $EDGE_COUNT"
if [ "$NODE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has nodes ($NODE_COUNT)"
else
  echo "    (observe: graph population depends on pipeline — zero may be valid)"
fi
if [ "$EDGE_COUNT" -gt 0 ] 2>/dev/null; then
  pass "graph has edges ($EDGE_COUNT)"
  echo "$GRAPH" | jq -r '.edges[:5][] | "    - \(.edgeType): \(.source) → \(.target)"' 2>/dev/null
fi

########################################################################
# 10. Check wiki detail for each voice wiki (fragments + people)
########################################################################
echo "— Wiki detail snapshots"
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  eval "WSLUG=\${${WIKI_VAR}_SLUG}"
  if [ -n "$WID" ]; then
    DETAIL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/$WID")
    W_STATE=$(echo "$DETAIL" | jq -r '.state // "unknown"')
    W_FRAGS=$(echo "$DETAIL" | jq '.fragments | length' 2>/dev/null || echo "0")
    W_PEOPLE=$(echo "$DETAIL" | jq '.people | length' 2>/dev/null || echo "0")
    W_CONTENT_LEN=$(echo "$DETAIL" | jq -r '.wikiContent // ""' | wc -c)
    echo "    $WIKI_VAR ($WSLUG): state=$W_STATE, fragments=$W_FRAGS, people=$W_PEOPLE, contentLen=$W_CONTENT_LEN"
  fi
done

########################################################################
# 11. Trigger regeneration on each voice wiki
########################################################################
echo "— Trigger wiki regeneration"
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  if [ -n "$WID" ]; then
    REGEN_RESP=$(curl -s -w "\n%{http_code}" -X POST \
      -b "$COOKIE_JAR" \
      -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/$WID/regenerate")
    REGEN_HTTP=$(echo "$REGEN_RESP" | tail -1)
    REGEN_BODY=$(echo "$REGEN_RESP" | sed '$d')

    if [ "$REGEN_HTTP" = "200" ]; then
      RFRAG=$(echo "$REGEN_BODY" | jq -r '.fragmentCount // 0')
      pass "$WIKI_VAR regen → 200 (fragments=$RFRAG)"
    else
      # Regen may fail if no fragments linked yet — observe, don't hard-fail
      REGEN_ERR=$(echo "$REGEN_BODY" | jq -r '.error // "unknown"')
      echo "    $WIKI_VAR regen → HTTP $REGEN_HTTP: $REGEN_ERR (observe: regen depends on linked fragments)"
    fi
  fi
done

########################################################################
# 12. Report final wiki state
########################################################################
echo "— Final wiki state"
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  eval "WSLUG=\${${WIKI_VAR}_SLUG}"
  if [ -n "$WID" ]; then
    FINAL=$(curl -s -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/$WID")
    F_STATE=$(echo "$FINAL" | jq -r '.state // "unknown"')
    F_FRAGS=$(echo "$FINAL" | jq '.fragments | length' 2>/dev/null || echo "0")
    F_PEOPLE=$(echo "$FINAL" | jq '.people | length' 2>/dev/null || echo "0")
    F_CONTENT=$(echo "$FINAL" | jq -r '.wikiContent // ""')
    F_CONTENT_LEN=${#F_CONTENT}

    echo "    $WIKI_VAR ($WSLUG):"
    echo "      state: $F_STATE"
    echo "      fragments: $F_FRAGS"
    echo "      people: $F_PEOPLE"
    echo "      content length: $F_CONTENT_LEN chars"
    if [ "$F_CONTENT_LEN" -gt 0 ]; then
      echo "      content preview: ${F_CONTENT:0:200}..."
    fi

    # Assert: wiki state should be RESOLVED or PENDING after regen
    if [ "$F_STATE" = "RESOLVED" ]; then
      pass "$WIKI_VAR final state=RESOLVED"
    elif [ "$F_STATE" = "PENDING" ]; then
      echo "    (observe: $WIKI_VAR still PENDING — regen may not have completed)"
    else
      echo "    (observe: $WIKI_VAR state=$F_STATE — unexpected but not fatal)"
    fi
  fi
done

########################################################################
# 13. Verify voice wikis appear in type-filtered listing
########################################################################
echo "— Verify type-filtered listing"
VOICE_LIST_HTTP=$(curl -s -o /tmp/uat-voice-list.json -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: http://localhost:3000" \
  "$SERVER_URL/wikis?type=voice")
if [ "$VOICE_LIST_HTTP" = "200" ]; then
  VOICE_COUNT=$(jq '.wikis | length' /tmp/uat-voice-list.json 2>/dev/null || echo "0")
  if [ "$VOICE_COUNT" -ge 3 ] 2>/dev/null; then
    pass "GET /wikis?type=voice → $VOICE_COUNT wikis (>= 3 expected)"
  else
    fail "GET /wikis?type=voice → only $VOICE_COUNT wikis (expected >= 3)"
  fi
else
  fail "GET /wikis?type=voice → HTTP $VOICE_LIST_HTTP"
fi

########################################################################
# Cleanup: soft-delete test wikis
########################################################################
echo "— Cleanup"
for WIKI_VAR in WIKI1 WIKI2 WIKI3; do
  eval "WID=\${${WIKI_VAR}_ID}"
  if [ -n "$WID" ]; then
    curl -s -o /dev/null -X DELETE \
      -b "$COOKIE_JAR" \
      -H "Origin: http://localhost:3000" \
      "$SERVER_URL/wikis/$WID"
  fi
done
echo "    test wikis soft-deleted"

echo ""
echo "════════════════════════════════════════"
echo "$PASS passed, $FAIL failed, $SKIP skipped"
```
