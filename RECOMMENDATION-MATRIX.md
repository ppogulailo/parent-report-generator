# The Recommendation Matrix — Monitoring & Intervention

**For Dave's review and approval. Nothing else in Milestone 1 proceeds until this
is approved.**

Prepared 2026-08-23 · methodology version `MI-V1.0-DRAFT` · matrix `1.0.0` (draft)

---

## What this is

Your Monitoring & Intervention methodology, written out as a set of rules a
computer applies rather than instructions an AI is asked to follow.

Today the methodology lives inside the AI's instructions: roughly forty hard
rules and a twelve-row routing table, written in a 307-line English prompt with a
278-line Spanish counterpart. The AI is *told* to follow them, and mostly does.
Version 1.0 moves those decisions into the platform: the routing is decided
before the AI is called, and the AI's output is then checked against that
decision. A report that drops a required workshop or invents one fails and is
regenerated.

**Nothing in this document is new methodology.** Everything is transcribed from
what the live system already does. Where the transcription needed a judgement, it
is listed in §6 for you to confirm or correct — those are the only places where
your answer changes behaviour.

**How to read it.** §2–§5 are the methodology as transcribed: read them and tell
us if anything is wrong. §6 is the list of questions that need you. §7–§10 cover
what Version 1.0 adds and what changes in how rules are enforced. §11 explains
how we will prove nothing moved.

---

## 1. What is preserved exactly

- All 24 questions, their wording, and every answer label, in both languages.
- The five concern domains and which questions feed each one.
- The severity logic: how a plan becomes Mild, Moderate, Serious, or the urgent
  form of Serious.
- The tie-break order for ranking domains.
- The twelve-row problem-to-resource routing table, plus the communication
  routing stated in the hard rules but absent from that table (§6.8).
- The resource library: 4 Essential workshops, 21 Auxiliary workshops, 3
  discussion groups, and the banned titles.
- The report's nine sections and their order.
- The required wording: the professional-help sequence, the private-search line,
  the standardized closing.

Verified rather than asserted: a test suite runs 30,000 different submissions
through both the old severity logic and the new one and requires the answer to be
identical every time. It passes. See §11.

---

## 2. The four severity levels

The first level whose condition is met wins, in this order.

### Critical — the parent wrote something in the urgent field

Any text at all in the optional urgent-concern field. Whitespace does not count.

A parent who fills in a field labelled "urgent" is not in Mild territory whatever
the 24 answers say, so this overrides everything. The live system handles this by
promoting the plan to Serious and adding two extra sections; we have named that
state Critical so it can be told apart in an audit, but the writing guidance is
identical to Serious, so no report reads differently than it does today.

### Serious — any one of three pathways

1. The three child-safety questions average 3 or higher. Those are **Q1**
   (certainty of use), **Q2** (suspected frequency) and **Q10** (safety concern).
2. The average of the five domain scores reaches **2.75**.
3. **Three or more answers are 4, AND at least one of those 4s is a
   child-safety question.**

The second half of pathway 3 is load-bearing. Without it, a household under real
strain — high conflict, an exhausted parent, adults who disagree — with no
evidence of use at all gets promoted to Serious and handed an intervention plan
it does not need.

Note that **Q23** (worry about long-term consequences) and **Q24** (readiness to
act) count toward the safety *domain* for scoring, but are excluded from the
child-safety subset above, per your direction of 2026-05-19: they measure the
parent's state of mind, not evidence about the child. That is preserved, and
there is a test that fails if anyone ever puts them back.

### Mild — all four conditions

No answer is a 4; no more than two answers are 3; the average of the domain
scores is at or below **2.0**; and the child-safety average is below **2.0**.

### Moderate — everything else

---

## 3. The priority areas

Fourteen rules. When a rule's condition is met, the family receives that priority
area and the resources beside it. Multiple rules firing means multiple areas —
nothing is dropped (see §6.6).

Row 14 was added after the baseline showed the current system citing it in every
plan while our matrix routed it in none. Its condition is our reading, not the
methodology's — see §6.8.

| # | Priority area | Fires when | Resources it requires |
|---|---|---|---|
| 1 | Parent Emotional Regulation | Always, every plan | Monitoring and Intervention discussion group |
| 2 | Get the adults aligned | Q11 ≥ 3 | M&I discussion group + Essential "Building a Support Network" |
| 3 | Act on what you are seeing | Q1 ≥ 3, **or** Serious/Critical | Auxiliary "Intervening When Substance Use is Present" |
| 4 | When you are not getting straight answers | Q3 ≥ 3 | Auxiliary "How and When to Search a Room" |
| 5 | The people around your child | Q12 ≥ 3 | Auxiliary "Understanding and Navigating Peer Pressure" |
| 6 | The phone and what is on it | Q14 ≥ 3 **and** Q12 ≥ 2 | Auxiliary "Understanding the Impact of Social Media…" |
| 7 | Bring the school in | Q15 ≥ 3 | Auxiliary "Partnering with Schools…" + Essential "Building a Support Network" |
| 8 | What is underneath the behaviour | Q9 ≥ 3 **or** Q13 ≥ 3 | Auxiliary "Managing Stress and Pressure…" |
| 9 | Make the rules mean something | Q7 ≥ 3 **or** Q19 ≥ 3 | Auxiliary "Behavioral Contracts…" + "Setting Boundaries with Respect…" |
| 10 | You cannot do this on empty | Q17 ≥ 3 | Monitoring and Intervention discussion group |
| 11 | Know what you are dealing with | Q1 ≥ 3 **and** Serious/Critical | Auxiliary "Drug Testing" |
| 12 | If the law is now involved | **Disabled** — see §6.3 | Auxiliary "Legal Issues and Substance Use…" |
| 13 | Risks specific to your child | **Disabled** — see §6.3 | Auxiliary "Supporting LGBTQ+ Teens…" |
| 14 | When every conversation turns into a fight | Q5 ≥ 3, Q6 ≥ 3 **or** Q13 ≥ 3 — *our threshold* | Essential "Effective Communication…" |

Rows 2 and 7 each name **two** resources, and the live methodology says citing
only one is a violation. Under the new architecture both are guaranteed: they are
listed together, so the platform hands the AI both and rejects a report that
omits either. Today that depends on the AI reading the word "AND".

Row 1 is why the Monitoring and Intervention discussion group appears in every
report at every severity: it is attached to a priority area that always fires. It
is also the fallback if a family somehow matches no other rule, so no plan can
ever come out without a lead priority.

Row 11 also requires a referral to an ASAP-endorsed therapist. That is not a
workshop, so it is handled by the wording rule in §9 instead.

**Ordering.** Where several areas fire, they are ordered by an importance weight
we assigned — safety and active use highest, preventative topics lowest. The live
system has no explicit ordering, so this is our judgement, and it affects only
the order in which areas are presented, never which ones appear. If you want a
different order, it is a one-line change per area.

---

## 4. Severity gating

Three resources are right at one severity and wrong at another. Today these are
instructions to the AI; now the resource is removed before the AI is told it
exists, so it cannot be cited.

| Resource | Forbidden at | Why |
|---|---|---|
| "Early Warning Signs — Identifying Substance Use Before It Becomes a Problem" | Serious, Critical | The parent is past the awareness stage. Telling someone whose child is actively using to watch for first signs is useless and dismissive of what they have already seen. |
| "Drug Testing" and "Behavioral Contracts" | Mild | Both belong to the Moderate/Serious register. In a Mild plan they escalate a household that has shown no use signal. |
| "Protecting Recovery" | Mild | Cited only inside the standardized closing, which is excluded from Mild entirely. |

One consequence worth naming: in a Mild plan where the consequences rule fires
(row 9), Behavioral Contracts is removed and the area cites "Setting Boundaries
with Respect" alone. That matches the live Mild rules, which exclude contracts —
but it means that area is thinner in Mild than elsewhere. If you would rather it
cited a third workshop in Mild, say which.

---

## 5. Domain mappings needing confirmation

Every workshop carries the concern domains it applies to. For 14 of the 25, the
routing table states the mapping outright. For the remaining 11 we inferred it
from the workshop's topic, and those are flagged in the content and logged at
every startup:

Monitoring and Intervention (Essential) · Sustaining Recovery (Essential) ·
Reflection and Assessment · Early Warning Signs · Family Dynamics and Substance
Use · When Is It Time for Professional Help · The Power of Positive Reinforcement
· Building Self-Esteem · Creating a Healthy Home Environment · Handling Setbacks
· Long-Term Strategies for Prevention

These mappings do not currently drive routing — the routing table does — so a
wrong guess here changes nothing a parent sees today. They matter if you later
want routing to work by domain rather than by question. Worth a glance, not a
long meeting.

---

## 6. Decisions we need from you

These are the only places where your answer changes what the system does. Each
is preserved as-is until you say otherwise, so nothing is blocked on them except
the ones marked BLOCKING.

### 6.1 Q4 counts toward nothing

**Q4 — "How often does your child spend time in environments where substances may
be present?" — belongs to no domain.** It is asked, it is stored, and it
contributes to no domain average, so it cannot affect severity or which domains
rank highest. The other 23 questions all feed at least one domain.

This is how the live system behaves today; we have preserved it exactly and the
platform logs it at every startup so it stays a known decision.

**Is that intended?** If Q4 should count toward Immediate Safety & Urgency — which
is where its topic sits — that is a one-line change, but it will shift some
families' domain scores and a few across a tier boundary. Your call, not ours.

### 6.2 Two questions overlap two domains

**Q18** (clarity of your plan for next steps) and **Q22** (preparedness to set firm
boundaries) each count toward *two* domains — Household Structure and Boundary
Consistency. So the five domains draw on 25 question-slots across 23 distinct
questions.

Preserved exactly. Flagging it only because it is unusual, and because it means
those two questions carry more weight overall than the others. No action needed
unless it was accidental.

### 6.3 BLOCKING — two routing rows cannot fire

Rows 12 and 13 fire on a concern "named in inputs" — legal exposure, and
LGBTQ+-specific risk. **There is no question in the approved 24 that asks about
either**, so the only place either could be "named" is the free-text urgent field.
The platform cannot read free text to make a routing decision.

Under today's prompt-only system these rows fire only if the AI happens to notice
the topic in what the parent wrote — which is a hope rather than a routing rule,
and means two families in identical situations can get different plans.

They are kept in the matrix, disabled, so the methodology stays complete and the
gap is visible rather than forgotten. Three ways forward:

1. **Add a non-scored question for each.** Cleanest, and the rules start working.
   For the legal one this is uncontroversial. For the LGBTQ+ one it means asking a
   parent to disclose something about their child in a questionnaire, which has
   its own weight — that decision is yours, not ours, and we would rather raise it
   than quietly implement it.
2. **Accept that they never fire**, and drop both workshops from the routing table.
3. **Fire them whenever there is urgent text**, and let the AI's prose decide
   whether the topic is relevant. Closest to today's behaviour; also the least
   predictable.

### 6.4 The social-media row's second condition

Row 6 reads "Q14 ≥ 3 with Q12 ≥ 2, **or social media concerns named**". The first
half is transcribed exactly. The second half reads free text, same problem as
§6.3. Currently only the first half is active. Tell us if that is acceptable or
if it needs a question.

### 6.5 Two counts in the prompts are stale

The English prompt says there are "5 Essential" workshops in one place; there are
4 — the prevention-planning workshop was removed by your direction and both of
its titles are banned. Both prompts say "20 Auxiliary"; there are 21, because
"Protecting Recovery" was added in the Beta Finalization milestone and the count
was never updated.

No behavioural effect — the lists themselves are correct. Mentioned because it is
a small, concrete example of why we are moving the library out of prose: once it
is data, a count cannot disagree with the list.

### 6.6 Nothing is capped

The live methodology says: "when multiple patterns apply, cite multiple resources
— do not collapse them into one." There is no limit. We have kept it that way by
setting the cap above the number of rules that can fire at once, with a test that
fails if anything is ever silently dropped.

The consequence is that a family in a difficult situation can receive eight or
nine priority areas, which is a long document. If you would prefer a shorter plan
that leads with the most important areas, lowering the cap is a content edit — but
it is a methodology change, so we will not make it without you asking.

### 6.7 One prompt rule becomes unnecessary

The rule banning "Early Warning Signs" from Serious plans exists because today
the AI is handed the whole resource directory and could reach for anything in it.
Under the new architecture the AI can only cite what the matrix selected, and no
rule routes to that workshop — so no plan at any severity can cite it, by
construction rather than by instruction.

We have kept the ban as a backstop in case a future rule ever routes there. No
action needed; noted so you can see what the architecture actually buys.

### 6.8 BLOCKING-ish — what the baseline showed the old system citing

We captured eight real plans from the current system and compared them against
what the matrix routes. **No severity moved on any of the eight** — the tiers are
identical. The resources differ, in both directions, and both directions matter.

**One genuine gap in our transcription, already fixed.** The current system cited
the Essential Workshop *"Effective Communication: Building Trust and Engagement
with Your Teen"* in **8 of 8** plans, and our matrix routed it in none. The
methodology does require it — *"when communication has broken down… route to the
Essential Workshop Effective Communication"* — but that instruction lives in a
hard rule rather than in the twelve-row routing table, so the first transcription
missed it entirely. It is now a routing rule.

**The condition is ours, not yours.** The prompts say "communication has broken
down" without naming a threshold, so it fires when conflict is intense (Q5 ≥ 3),
when the parent lacks confidence to raise it (Q6 ≥ 3), or when the child cannot
talk about stress (Q13 ≥ 3). **Please confirm or correct that.**

**Five resources the old system cited that no rule requires.** These come from a
second, softer list in the prompt — a "common matches" section suggesting
workshops by topic, separate from the hard routing table. We transcribed the hard
table; this is what the soft list produced:

| Resource | Appeared in | Our reading |
|---|---|---|
| Creating a Healthy Home Environment | 3 of 8 | Household structure has no hard rule. Plausibly should. |
| Monitoring and Intervention (Essential) | 1 of 8 | The workshop the parent has already completed to reach here. |
| How and When to Search a Room | 8 of 8 | Our rule fires on secrecy (Q3 ≥ 3). The old system cited it even in Mild with no secrecy signal, which the Mild rules do not permit. |
| Reflection and Assessment | 1 of 8 | Model discretion. |
| The Power of Positive Reinforcement | 1 of 8 | Model discretion. |

Each is a decision: make it a rule, or accept that it was the model choosing.

**And the other direction, which is the point of this milestone.** The old system
**omitted required workshops**. "Building a Support Network" is required by two
routing rows and was missing from every Moderate and Serious plan we captured.
In the Spanish Serious plan it also omitted Partnering with Schools, Social
Media, Peer Pressure and Managing Stress — four required citations, silently
absent, with nothing anywhere reporting a problem. That is the failure the new
architecture makes impossible.

### 6.9 What the real model actually did

The pipeline has been run against the live model, not just a mock. Two things
came out of it, and both are worth you knowing:

**A false alarm in our own checker, now fixed.** The Article of Action
*"Partnering with Schools"* is a substring of the approved workshop *"Partnering
with Schools for Your Child's Success"*. So when the model correctly cited the
workshop, our ban on recommending Articles of Action fired on it — three attempts
burned, and the plan shipped flagged for a rule it had not broken. The check is
now positional: a banned title only counts where it is not part of a longer
approved title.

**A real drift by the model, caught and corrected automatically.** On the next
run it quoted a questionnaire option back at the parent verbatim — *"Rarely know
where they are"* — which is exactly the tell that a plan was assembled from a
form. The check caught it, the error was fed back, and the second attempt was
clean. Under the current system nothing would have noticed.

That is the mechanism working in both directions on its first contact with a real
model: one of our rules was wrong and one of the model's outputs was, and both
were visible within minutes rather than in a report someone reads next month.

### 6.10 Inverted-answer annotations are incomplete

Eleven questions are annotated in the source as having answer scales that run
opposite to the question ("more is better"). Two more — **Q7** (consistency of
consequences) and **Q16** (have you sought professional guidance) — plainly are,
judging by their own answer labels, but carry no annotation. We have marked all
thirteen.

This is display metadata only and affects no score. Mentioned for completeness.

---

## 7. The transition to Sustaining Recovery

You asked for this to be assessment-driven, firing when abstinence or meaningful
stability indicates the family is ready. **The current 24 questions cannot support
that**, and this is the most important thing in this document.

Every one of the 24 measures suspected or active use, or the parent's own capacity
to respond: certainty of use, frequency, secrecy, conflict, consistency of
consequences, and so on. **None asks whether the child has stopped using, been
through treatment, or held any period of stability.**

Low scores therefore do not mean recovery. A family scoring low is a family in
the early-signals range — quite possibly nothing has happened yet. If the
transition fired on low scores, we would be pointing families with no treatment
history at a workshop written for post-treatment households. That is the opposite
of the disciplined routing you asked us to protect.

**What we built.** One extra question, outside the scored 24:

> *Where is your child with treatment or counselling right now?*
> · No treatment or counselling
> · Looking for help, not started yet
> · Currently in therapy, counselling or treatment
> · Has been through treatment; use has continued or returned
> · **Has been through treatment and has held a meaningful period without use**

Optional, and **not scored**. It belongs to no domain, contributes to no average,
and cannot move a family between severity levels — the platform enforces all of
that, and there is a test proving that answering it changes nothing else about
the plan. It decides one thing: whether the transition section appears. Only the
last option triggers it.

So the 24-question assessment, the scoring and the severity logic are all exactly
as they were. If you would rather this judgement sat with a facilitator at the end
of the Essential Workshop rather than in the questionnaire, say so and we will
remove the question — the transition then lives in Circle and needs nothing from
us.

**One-directional, deliberately.** This points forward into Sustaining Recovery.
The reverse link was removed from Sustaining Recovery on your instruction in
August, on the grounds that a parent arriving there had already followed the right
pathway and a second assessment only created doubt. We have not added a return
link and have left a note in the code saying why, so nobody adds one later for
symmetry.

**We still need your final wording.** The section ships verbatim, so the text must
be yours. There is placeholder copy in place meanwhile, clearly marked.

---

## 8. What Version 1.0 adds to the report

Your nine sections are unchanged in wording, purpose and order. Five things are
added — all five are here for you to accept or drop:

1. **A workshops section.** Today workshops are named inside the prose, which
   means there is nowhere to attach a link. This collects the recommended
   workshops with a sentence each on why this family in particular should attend.
   It is what makes "direct links to the appropriate ASAP resources" possible at
   all, and it is where the platform checks that the AI cited exactly what the
   matrix chose. Workshops still appear in the prose as well — this does not
   replace that.

2. **Universal Guiding Principle** — a fixed passage on matching the response to
   what the parent is actually seeing.

3. **Parent self-care** — a fixed passage on the parent's own steadiness being
   part of the mechanism, not an aside.

   Both 2 and 3 are carried over from Sustaining Recovery and adapted. **Both are
   placeholder wording.** They render exactly as written, with no AI involvement,
   so please replace them with the wording you want a parent to read.

4. **The standardized closing becomes exact.** Today the AI is asked to reproduce
   your three approved paragraphs "essentially verbatim", with permission to
   adjust connective wording. Now the platform renders your text and the AI never
   sees it. Still excluded from Mild. **This is a change in enforcement, not in
   methodology — but it is a change, so we are flagging it.** If the AI's small
   adjustments were wanted, tell us and we will hand it back.

5. **The transition section** from §7.

---

## 9. Wording that is now checked, not just requested

Three passages the methodology states as literal output. Today they are prompt
instructions. Now they are verified against the finished report, and a violation
regenerates it.

| Rule | When it applies | If it fails |
|---|---|---|
| The professional-help sequence — both sentences, verbatim, in order, in the same paragraph | Any mention of a therapist, treatment provider, professional help, clinician or treatment programme | Report regenerated; if it fails every attempt it ships with a loud internal warning rather than costing the parent their plan |
| The private-search line — "privately and without your child present", plus leaving the room as found | Anywhere the plan describes searching a room, backpack or phone | Same |
| The standardized closing | Moderate, Serious, Critical | Now a fixed section, so this is a backstop only |

The professional-help sequence is the one that matters most. In Sustaining
Recovery testing we found it being honoured **intermittently**: one live report
discussed therapists across six paragraphs and contained the sequence zero times,
while one generated two days earlier had it correctly. The rule lived only in the
prompt and nothing checked it. That is the specific failure this architecture
exists to prevent — a parent quietly not receiving the route to your vetted
providers, with nothing anywhere reporting a problem.

**One judgement inside it.** The methodology says the sequence must appear in
*every* paragraph mentioning professional help. Enforced to the letter, that
pushes two long boilerplate sentences into every bullet of the priorities list.
We check for it **at least once**, which guarantees the parent gets the route
without wrecking the lists. If you want the letter of the rule, it is a one-word
change in the content file.

The Spanish reports carry these two sentences **in English**, per your existing
direction — they name a resource and a Circle location rather than describing
anything.

---

## 10. What we are not doing

- Not changing any question, answer label, or domain.
- Not changing the severity thresholds.
- Not changing which resources a situation routes to.
- Not adding, removing or renaming a workshop or discussion group.
- Not touching the Sustaining Recovery product.

---

## 11. How we will prove nothing moved

Two things, both already in place:

**A parity test.** 30,000 different submissions are run through the old severity
logic and the new one, and the severity must match every time. Plus every uniform
submission, every single-4 variation across all 24 questions, and the specific
edge case where three 4s land entirely outside the child-safety questions. All
passing. It compares against the live code directly, not against recorded
expectations, so it cannot quietly drift.

**A behavioural baseline — captured.** Eight complete plans from the current
system: Mild, Moderate, Serious and the urgent form, in both languages, recording
which resources each cited and whether the required wording appeared. They are
committed under `baseline/`, and `npm run baseline:compare` re-runs the
comparison offline in seconds. **Result: no severity moved on any of the eight.**
The resource differences are catalogued in §6.8.

We compare which resources a family is pointed at, not the sentences. Two runs of
an AI never produce identical prose, so comparing text would fail every time and
prove nothing. What must not change is the routing and the severity register.

**And the new engine has been run against the real model**, not only a mock. A
Serious plan generated end to end satisfied every rule: the professional-help
sequence verbatim, the private-search line verbatim, the peer-support group cited,
your standardized closing and both guiding principles rendered exactly as
written, and no banned vocabulary. Two defects surfaced in that run and are fixed
— one a false alarm in our own checker, one a real drift by the model, described
in §6.10.

Eight rather than six, incidentally: your scope statement asked for baselines
across Mild, Moderate and Serious, but the urgent path is a fourth report shape
with two extra sections and its own rules, and it is the report where a
regression would matter most. Included at no change in price.

---

## 12. What we need

**To proceed past Milestone 1:**

1. **Your approval of §2, §3 and §4** — the methodology as transcribed. If
   anything is wrong, this is the moment it is cheap to fix.
2. **An answer on §6.3** — the two routing rows that cannot currently fire.
3. **A decision on §7** — the extra question, or move the transition to Circle.

**Needed before launch, not before we start:**

4. The Circle URLs for the workshops and discussion groups.
5. Final wording for the Universal Guiding Principles (§8.2, §8.3) and the
   transition (§7).
6. Native-speaker sign-off on the Spanish strings.
7. One DNS record for `monitoring.asapcommunity.org`.

**Worth a glance whenever:** §6.1, §6.2, §6.4, §6.5, §6.6, §6.8, and §5.

---

*Once approved, mark `content/assessment.json` and
`content/recommendation-matrix.json` as `"status": "approved"` and the platform
stops flagging every report as provisional.*
