---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-youtube-automation-2026-01-07.md"
  - "_bmad-output/analysis/brainstorming-session-2026-01-07.md"
workflowType: 'prd'
lastStep: 11
workflowComplete: true
completedAt: "2026-01-07"
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
date: "2026-01-07"
author: "Conan"
project_name: "youtube-automation"
---

# Product Requirements Document - youtube-automation

**Author:** Conan
**Date:** 2026-01-07

## Executive Summary

NEXUS-AI is a fully autonomous YouTube channel delivering daily 5-8 minute AI and technology news to time-constrained professionals. By combining intelligent news curation, programmatic visual generation, and precision voice synthesis, NEXUS-AI solves the "AI news firehose problem" - the reality that keeping up with AI developments has become a full-time job for people who already have full-time jobs.

The channel targets developers, founders, and tech enthusiasts who need to stay current on AI developments but lack the time to monitor fragmented sources across Twitter, arXiv, GitHub, and dozens of newsletters. NEXUS-AI delivers a curated daily briefing that respects viewers' time while ensuring they never miss developments that could impact their work.

**Revenue Target:** $3,000+/month within 6 months through AdSense (40%), affiliate partnerships (30%), and sponsorships (30%).

**Key Innovation:** Full automation pipeline from news sourcing to published video, enabling consistent daily output without creator burnout.

### What Makes This Special

1. **Pronunciation Moat** - Living IPA dictionary ensures proper nouns and technical terms are spoken correctly. Saying "Yann LeCun" and "Mixtral" correctly builds trust that competitors erode.

2. **Visual Intelligence** - 100% original Remotion animations, zero stock footage. Animated component library (neural networks, data flows, comparisons) creates a distinctive visual language.

3. **Freshness Algorithm** - News ranked by `(virality_velocity × source_authority) / hours_since_break` ensures coverage of what matters, not just what's easy.

4. **Cost Efficiency** - <$0.50/video using Gemini 3 Pro + Google Cloud TTS free tier + $300 GCP credits. Sustainable economics from Day 1.

5. **Multi-Agent Script Quality** - Writer → Critic → Optimizer pipeline catches errors before TTS, ensuring professional output without human review.

6. **Gemini 3 Pro Thumbnails** - Custom AI-generated thumbnails with 3 A/B variants per video, not templates.

7. **Full Automation Architecture** - End-to-end autonomous pipeline eliminates creator burnout. Human intervention only for strategic decisions and crisis response.

## Project Classification

**Technical Type:** Automation Pipeline / Developer Tool
**Domain:** General (AI/ML Content)
**Complexity:** Medium
**Project Context:** Greenfield - new project

### Tech Stack

- **AI Models:** Gemini 3 Pro (text/reasoning) + Gemini 3 Pro Image (thumbnails)
- **TTS:** Google Cloud gemini-2.5-pro-tts → ElevenLabs (Month 3+)
- **Video:** Remotion 4.x (React-based composition)
- **Infrastructure:** GCP Cloud Run + Cloud Functions + Firestore
- **Budget:** $300 GCP credit / 90-day runway

### Timeline

- **MVP:** 2-3 weeks to first autonomous video
- **Day 30:** Go/No-Go checkpoint (1,000 subscribers target)
- **Month 3:** Monetization eligible (1,000 subs + 4,000 watch hours)
- **Month 6:** Full profitability target ($3,000/month)

## Success Criteria

### User Success

**Core Promise:** "Watch NEXUS-AI for 6 minutes a day and you'll know more about AI than 95% of tech professionals."

| Persona | Success State | Proxy Metrics |
|---------|---------------|---------------|
| **Dev Marcus** | "I'm the AI guy on my team" | Comments: "heard about X here first"; Slack/Discord referral traffic; Weekday 7-9 AM views; "mentioned in standup" comments |
| **Founder Priya** | "I command AI conversations" | LinkedIn shares; Multi-subscriber company domains (team adoption); "what should we use for..." comments; Sponsor inquiries |
| **Enthusiast Jordan** | "I can pivot my career" | Affiliate link clicks; Evening/weekend views (9 PM+); "just tried this!" comments; GitHub referral traffic to featured repos |

**Quantitative User Metrics:**
- Watch Time: >50% average retention
- Return Rate: >30% watch 3+ videos/week
- Subscribe Rate: >5% of new viewers subscribe
- Share Rate: Measurable Slack/Twitter/LinkedIn mentions

### Business Success

**6-Month Growth Trajectory:**

| Month | Subscribers | Monthly Views | Revenue | Revenue Mix |
|-------|-------------|---------------|---------|-------------|
| 1 | 1,000 | 10,000 | $0 | Pre-monetization |
| 2 | 3,000 | 30,000 | $100-200 | 100% Affiliate |
| 3 | 6,000 | 60,000 | $300-500 | 60% Affiliate, 20% AdSense, 20% Sponsors |
| 4 | 12,000 | 120,000 | $600-1,000 | Mixed |
| 5 | 20,000 | 200,000 | $1,200-1,800 | Mixed |
| 6 | 30,000+ | 300,000+ | $2,500-3,500+ | 40% AdSense, 30% Affiliate, 30% Sponsors |

**Key Business Indicators:**
- Leading: Subscriber growth rate, Day-1 views, CTR, audience retention curve
- Lagging: Monthly revenue, cost per video, subscriber-to-view ratio
- Quality: >98% pronunciation accuracy, 100% original visuals, <12hr news freshness

### Technical Success

**Quality Gates (Hard Requirements):**

| Gate | Target | Trigger Action |
|------|--------|----------------|
| **TTS Pronunciation** | <2% errors/video | >3 flagged terms → human review; auto-add to dictionary |
| **Script Length** | 1,200-1,800 words | Outside range → regenerate |
| **Visual Coverage** | Scene change every 30 sec | Validation before render |
| **Thumbnail CTR** | >3.5 predicted score | Below threshold → regenerate variants |
| **Upload Verification** | API confirms success | Verify before marking complete |

**Data Freshness Guarantee:**
- Hard rule: Never publish news older than 24 hours
- Target: <12 hours from source trending → video live
- Exception: "Deep dive" format allows 48-72hr topics with added analysis

**API Fallback Chain:**
1. Primary: `gemini-3-pro-preview`
2. Fallback 1: `gemini-2.5-pro` (if primary down)
3. Fallback 2: Queue topic, skip day, alert owner
4. **Principle: Never publish garbage - skip > bad content**

**System Reliability:**
- Daily health check: 6 AM UTC before pipeline runs
- Critical service down → Discord alert + skip day
- Never publish partial/broken videos

### Automation Health Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Daily Publish Rate | 100% | Any miss = Critical |
| Pipeline Latency | <4 hours | >6 hours = Warning |
| Cost per Video (Credit) | <$0.50 | >$0.75 = Review |
| Cost per Video (Post-Credit) | <$1.50 | >$2.00 = Review |
| Error Rate | <2% failed renders | >5% = Investigation |
| Human Intervention | <5% (Month 5-6) | >10% = Automation gap |

### Measurable Outcomes

**MVP Go/No-Go Decision (Day 30):**

| Criteria | Target | Red Flag | Decision Impact |
|----------|--------|----------|-----------------|
| Videos Published | 30/30 | <28 | Automation crisis - pause and fix |
| Subscribers | 1,000+ | <500 | Positioning/content issue (OK if trend sharply up) |
| Avg Watch Time | >40% | <30% | Script/pacing issue |
| Click-Through Rate | >4% | <2% | Thumbnail/title issue |
| Cost Per Video | <$0.60 | >$1.00 | Cost optimization needed |
| Human Intervention | <25% | >40% | Automation gaps to fix |

**Go/No-Go Logic:**
- All criteria met → Full speed to Month 2
- 1-2 criteria missed but trend positive → Continue with targeted fixes
- 3+ criteria missed or negative trend → Pause, diagnose, fix before scaling

## Product Scope

### MVP - Minimum Viable Product (Weeks 1-3)

**12 Core Components:**
1. News Sourcing (5 sources: GitHub Trending, HuggingFace Papers, HN, r/MachineLearning, arXiv)
2. Freshness Scoring Algorithm
3. Multi-Agent Script Generation (Writer → Critic → Optimizer)
4. Pronunciation Dictionary (200 initial terms)
5. Visual Components (5-7 Remotion templates)
6. TTS (gemini-2.5-pro-tts)
7. Video Assembly Pipeline
8. A/B Thumbnail Testing (3 variants)
9. YouTube Upload Automation
10. Twitter/X Auto-Post
11. Daily Digest Email
12. Human Review Queue

**MVP Outcome:** System autonomously sources → scripts → renders → uploads → tweets 1 video daily.

### Growth Features (Month 2-3)

- Twitter thread generation (not just links)
- Manim integration for technical explainers
- A/B test video lengths and formats
- Basic analytics dashboard
- Pronunciation dictionary expansion via ML
- ElevenLabs TTS upgrade

### Vision (Month 4+)

- Multi-platform expansion (TikTok shorts, LinkedIn)
- Sponsor integration system
- Revenue optimization engine
- Multiple daily videos (morning brief, deep dive, weekly recap)
- Podcast audio version
- Newsletter companion
- **North Star:** NEXUS-AI becomes the "Bloomberg Terminal of AI news"

## User Journeys

### Journey 1: System Operator - The 10-Minute Morning Ritual

**The Story:**

It's 7:45 AM. Conan pours his first coffee and opens his laptop - not to work, but to check on his money machine. The Discord notification badge shows green: "NEXUS-AI: Pipeline healthy. Video #47 published at 6:00 AM UTC."

He clicks through to the Daily Digest email. Three sections scan in 90 seconds:
- **Published**: "GPT-5 Rumors Debunked + 3 More" - 1,247 views in first hour, 4.2% CTR ✓
- **Flags**: One pronunciation alert - "Mistral" variant detected, added to dictionary automatically
- **Tomorrow**: Pipeline already sourced 7 stories, ranked by freshness score. Top 3 look solid.

Nothing needs his attention. He closes the laptop and gets on with his day.

**Weekly Optimization (Sunday, 30 minutes):**

Conan runs his optimization ritual. YouTube Studio shows retention curves - the "metrics explainer" segments are losing 12% of viewers. He notes: "Test shorter metric animations next week." He checks the cost dashboard: $0.41/video average, well under the $0.50 target. The pronunciation dictionary has grown from 200 to 247 terms - mostly auto-added from flagged words.

He drafts one strategic decision: "Week 8: Test 10-minute deep-dive format on Saturdays."

**Monthly Review (2 hours):**

Revenue review. Affiliate links: $127 from Cursor referrals. AdSense pending (Month 2). He updates the growth spreadsheet and adjusts the 6-month projection. Reaches out to one potential sponsor for Month 4.

**The Insight:**

"Autonomous" means: 90 seconds daily, 30 minutes weekly, 2 hours monthly. The system runs itself; Conan steers.

### Journey 2: Failed Pipeline - Crisis Recovery

**The Story:**

Conan's phone buzzes at 5:17 AM. Discord alert: "🚨 CRITICAL: Pipeline failed - Gemini API timeout after 3 retries."

He groans, grabs the phone, and opens the incident dashboard. The failure log shows: Gemini 3 Pro returned 503 for 47 minutes during peak Google Cloud maintenance.

**Decision tree activates:**

1. **Check fallback**: Did it try `gemini-2.5-pro`? Yes - also 503. Google-wide outage.
2. **Check time**: 5:17 AM. Video scheduled for 6:00 AM. 43 minutes to fix or skip.
3. **Check buffer**: Yesterday's backup video sits in queue - a "Top 5 AI Papers This Week" evergreen piece.

**The call:**

Conan triggers the manual override: "Publish backup video. Mark today as 'buffer deployed.' Queue original topic for tomorrow's slot."

Three taps. Done. He goes back to sleep.

**At 8 AM:**

The Daily Digest arrives with a yellow banner: "⚠️ Fallback deployed. Original video queued. Buffer depleted - regenerate this week."

Conan adds a task: "Build new evergreen backup by Friday."

**Post-mortem (logged automatically):**

```
Incident #003: Gemini API outage
Duration: 47 min
Resolution: Buffer video deployed
Root cause: Google Cloud maintenance window
Action: No code change needed - fallback worked as designed
Recommendation: Consider secondary LLM provider for Month 3
```

**The Insight:**

The system doesn't promise zero failures. It promises: fail gracefully, alert immediately, recover without panic. The pipeline's job is to never publish garbage - skipping beats broken.

### Viewer Journeys (Summary)

Primary viewer personas (Dev Marcus, Founder Priya, Enthusiast Jordan) follow a simple discovery-to-habit journey: Discover via algorithm → First watch impresses → Subscribe → Daily viewing ritual at their "NEXUS moment" → Share with peers. YouTube handles the UX; NEXUS-AI optimizes for their time slots and content preferences.

### Future User Types (Deferred)

- **Sponsors/Advertisers**: Onboarding flow designed in Month 4+ after 10K subscriber threshold
- **Newsletter Curators / Team Leads**: Passive discovery; enable with embed codes, shareable timestamps, and quotable summaries in video descriptions

### Journey Requirements Summary

| Capability | Source Journey | Priority |
|------------|----------------|----------|
| Daily Digest Email | Operator Morning | MVP |
| Health Dashboard | Operator Morning | MVP |
| Pronunciation Auto-Flag | Operator Morning | MVP |
| Cost Tracking Dashboard | Operator Weekly | MVP |
| Retention Analytics View | Operator Weekly | Month 2 |
| API Fallback Chain | Failed Pipeline | MVP |
| Buffer Video System | Failed Pipeline | MVP |
| Manual Override Trigger | Failed Pipeline | MVP |
| Incident Logging | Failed Pipeline | MVP |
| Discord/Alert Integration | Failed Pipeline | MVP |

## Automation Pipeline Architecture

### Pipeline Overview

NEXUS-AI operates as a 10-stage autonomous pipeline running daily at 6 AM UTC, with ~2.5 hours processing time and 5.25 hours buffer before scheduled publish at 2 PM UTC.

**Design Principles:**
- Each stage has defined inputs, outputs, and failure modes
- Graceful degradation: prefer skip over garbage
- Fallback chains at every critical stage
- Observable: every stage emits status for daily digest

### Pipeline Stages

#### Stage 1: SOURCE (6:00 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | GitHub Trending, HuggingFace Papers, Hacker News, r/MachineLearning, arXiv RSS |
| **Process** | Fetch → Score `(virality × authority / hours)` → Rank → Select top topic |
| **Output** | Selected topic with source URLs, metadata |
| **Failure** | <3 viable topics → alert + use fallback "deep dive" on 48hr topic |

#### Stage 2: RESEARCH (6:15 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Selected topic + source URLs |
| **Process** | Gemini 3 Pro deep research → compile facts, context, implications |
| **Output** | 2,000-word research brief |
| **Failure** | API error → retry 3x → fallback to Gemini 2.5 Pro |

#### Stage 3: SCRIPT (6:30 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Research brief + script template |
| **Process** | Writer agent → Critic agent → Optimizer agent |
| **Output** | 1,200-1,800 word script with visual cues + pronunciation hints |
| **Failure** | Script too short/long → regenerate with adjusted prompt |

#### Stage 4: PRONUNCIATION CHECK (6:45 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Script text |
| **Process** | Extract tech terms → check against IPA dictionary → flag unknowns |
| **Output** | Script with SSML pronunciation tags |
| **Failure** | >3 unknown terms → human review queue |

#### Stage 5: TTS SYNTHESIS (7:00 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | SSML-tagged script |
| **Process** | Google Cloud gemini-2.5-pro-tts → chunk if >5000 chars → stitch |
| **Output** | WAV audio file (44.1kHz) |
| **Failure** | API error → retry → alert if persistent |

#### Stage 6: VISUAL GENERATION (7:15 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Script with visual cues |
| **Process** | Match cues to Remotion templates → generate custom graphics |
| **Output** | Scene timeline JSON + generated assets |
| **Failure** | Missing template → use fallback "text on gradient" |

#### Stage 7: THUMBNAIL (7:30 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Topic title + key visual |
| **Process** | Gemini 3 Pro Image → generate 3 A/B variants |
| **Output** | 3x 1280x720 thumbnails |
| **Failure** | Generation fails → use template thumbnail |

#### Stage 8: RENDER (7:45 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Audio + Visual timeline + assets |
| **Process** | Remotion render on Cloud Run (4 CPU, 8GB RAM) |
| **Output** | MP4 1920x1080 @ 30fps |
| **Failure** | Render crash → retry with reduced quality → alert |

#### Stage 9: UPLOAD (8:30 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | MP4 + thumbnails + metadata (title, description, tags) |
| **Process** | YouTube Data API resumable upload → set thumbnails → schedule publish |
| **Output** | YouTube video ID, scheduled for 2 PM UTC |
| **Failure** | Upload fails → retry 3x → manual queue |

#### Stage 10: NOTIFY (8:45 AM UTC)
| Attribute | Value |
|-----------|-------|
| **Input** | Pipeline results |
| **Process** | Send daily digest (Discord webhook + email) |
| **Output** | Summary with video link, metrics, any flags |
| **Failure** | Always runs, even if earlier stages failed |

### Pipeline Timing Summary

| Metric | Value |
|--------|-------|
| **Start Time** | 6:00 AM UTC |
| **End Time** | ~8:45 AM UTC |
| **Processing Duration** | ~2.75 hours |
| **Buffer Before Publish** | 5.25 hours |
| **Scheduled Publish** | 2:00 PM UTC |

### Failure Recovery Hierarchy

1. **Retry** - Same stage, same parameters (transient errors)
2. **Fallback** - Same stage, degraded service (API outage)
3. **Skip** - Use buffer content, queue original for tomorrow
4. **Alert** - Human intervention required, pipeline halts

## Functional Requirements

### News Intelligence

- **FR1:** System can fetch trending content from GitHub Trending, HuggingFace Papers, Hacker News, r/MachineLearning, and arXiv RSS
- **FR2:** System can score news items by freshness formula `(virality × authority / hours_since_break)`
- **FR3:** System can rank and select top topic(s) for daily coverage
- **FR4:** System can detect when viable topics are insufficient (<3) and trigger fallback
- **FR5:** System can store topic selection with source URLs and metadata

### Content Generation

- **FR6:** System can generate research briefs from selected topics using AI models
- **FR7:** System can generate scripts following Writer → Critic → Optimizer pipeline
- **FR8:** System can validate script length is within 1,200-1,800 word range
- **FR9:** System can regenerate scripts that fail validation with adjusted parameters
- **FR10:** System can embed visual cues and pronunciation hints in scripts

### Pronunciation & Voice

- **FR11:** System can maintain a pronunciation dictionary with IPA phonemes
- **FR12:** System can extract technical terms from scripts and check against dictionary
- **FR13:** System can flag unknown terms for human review when threshold exceeded (>3)
- **FR14:** System can auto-add flagged terms to dictionary after resolution
- **FR15:** System can generate SSML-tagged scripts with pronunciation markup
- **FR16:** System can synthesize speech audio from SSML scripts via TTS
- **FR17:** System can chunk long scripts (>5000 chars) and stitch audio segments

### Visual Production

- **FR18:** System can match script visual cues to Remotion component templates
- **FR19:** System can generate scene timeline JSON and custom graphics assets
- **FR20:** System can render video from audio + visual timeline + assets (1080p @ 30fps)
- **FR21:** System can use fallback visuals ("text on gradient") when primary templates unavailable
- **FR22:** System can generate 3 A/B thumbnail variants per video via AI image generation
- **FR23:** System can use template thumbnails when AI generation fails

### YouTube Publishing

- **FR24:** System can upload videos via YouTube Data API with resumable upload
- **FR25:** System can set video metadata (title, description, tags, affiliate links)
- **FR26:** System can set thumbnails for uploaded videos
- **FR27:** System can schedule video publication for specified time (2 PM UTC)
- **FR28:** System can verify upload success via API confirmation
- **FR29:** System can post video links to Twitter/X on publish

### Monitoring & Alerting

- **FR30:** System can perform daily health check before pipeline execution (6 AM UTC)
- **FR31:** System can send critical alerts via Discord webhook
- **FR32:** System can send daily digest email with pipeline results, metrics, and flags
- **FR33:** System can track and report cost per video
- **FR34:** System can log incidents with timestamps, duration, root cause, and resolution
- **FR35:** Operator can view pipeline status and health metrics via dashboard

### Operator Management

- **FR36:** Operator can trigger manual override to publish buffer video
- **FR37:** System can maintain buffer video queue for emergency use
- **FR38:** Operator can view and manage pronunciation dictionary entries
- **FR39:** Operator can view cost tracking dashboard
- **FR40:** Operator can access human review queue for flagged items
- **FR41:** Operator can mark topics for skip or re-queue to next day

### Error Recovery

- **FR42:** System can retry failed operations with configurable retry count (default: 3)
- **FR43:** System can fallback to alternate AI models when primary fails
- **FR44:** System can skip day and alert operator when all fallbacks exhausted
- **FR45:** System can continue NOTIFY stage even when earlier stages have failures
- **FR46:** System can queue failed topics for next day processing

## Non-Functional Requirements

### Reliability

- **NFR1:** System must publish video daily with 100% success rate (30/30 days MVP target)
- **NFR2:** Pipeline must complete with 5+ hours buffer before scheduled publish
- **NFR3:** System must recover from single-stage failures via auto-fallback or skip
- **NFR4:** Notification stage must execute regardless of prior stage failures
- **NFR5:** System must maintain minimum 1 buffer video for emergency deployment

### Performance

- **NFR6:** Total pipeline duration must be <4 hours (6:00 AM → 10:00 AM UTC)
- **NFR7:** Video render time must be <45 minutes for 8-minute video
- **NFR8:** API retry latency must be <30 seconds between attempts
- **NFR9:** Alert delivery time must be <1 minute from trigger event

### Cost Efficiency

- **NFR10:** Cost per video must be <$0.50 during GCP credit period
- **NFR11:** Cost per video must be <$1.50 post-credit period
- **NFR12:** Monthly operating cost must be <$50 (Month 1-2)
- **NFR13:** Cost tracking must be real-time accurate within $0.01

### Integration Resilience

- **NFR14:** API timeout handling must be configurable per external service
- **NFR15:** System must attempt 3 retries before triggering fallback
- **NFR16:** YouTube API quota usage must stay below 80% of daily quota
- **NFR17:** External API availability must be verified via health check before pipeline run

### Quality Assurance

- **NFR18:** Pronunciation accuracy must exceed 98% correct terms per video
- **NFR19:** Visual content must be 100% programmatic (zero stock footage)
- **NFR20:** News freshness must be <24 hours (hard limit), <12 hours (target)
- **NFR21:** Script word count must be validated within 1,200-1,800 word range
- **NFR22:** Thumbnail generation must produce 3 A/B variants per video

### Security

- **NFR23:** API credentials must be encrypted at rest via GCP Secret Manager
- **NFR24:** Credential rotation must be supported without code changes
- **NFR25:** All API calls must be audit logged with timestamps

