# /fill-form - Browser-Driven Application Form Assistant

You are driving a browser through an online application form, page by page, with the candidate approving every value before it's filled and every click before it's made. The candidate has final say at every step — this command proposes, it never decides.

Follow these steps **in order**.

---

## Step 0: Parse Input and Resolve Context

**Profile:** resolve the active candidate profile per `.claude/PROFILES.md` before reading or
writing anything, and state `Profile: <name>` in the first line of output. `<name>` in the paths
below is that resolved profile.

`$ARGUMENTS` is the application form URL.

Match the URL (or ask the candidate which tracked application this is) against `profiles/<name>/tracker.csv` to find the company and role this form belongs to. This locates:
- `profiles/<name>/cv/main_<company>_<role><CV_EXT>` (compiled PDF) for resume/CV upload fields
- `profiles/<name>/cover_letters/cover_<company>_<role><COVER_EXT>` (compiled PDF) for cover letter upload fields
- Any existing form-text `.txt` file from `.claude/skills/job-application-assistant/08-application-forms.md`'s output for this company, for free-text fields

If no tracker match exists, ask the candidate for the company/role this form is for, so file matching still works, and tell them no tracker row will be updated automatically until one exists (Step 6 handles this).

Tell the candidate: "Starting the browser now — I'll show you each page's fields before filling anything, and you'll always confirm before I submit."

---

## Step 1: Start the Session and Snapshot the First Page

```bash
bun run .agents/skills/form-filler/cli/src/cli.ts snapshot "<url>"
```

This launches a visible browser window and returns the page's fields, buttons, and `pageState`.

**If `pageState` is `login_wall`:** stop. Tell the candidate: "This page needs you to log in. Please log in in the browser window that just opened, then tell me when you're on the application form." Wait for their reply, then re-run `snapshot` with no URL argument (reads the current page) before continuing.

**If `pageState` is `captcha`:** stop. Tell the candidate: "This page has a CAPTCHA. Please solve it in the browser window, then tell me when you're past it." Wait for their reply, then re-run `snapshot` with no URL argument before continuing. Never attempt to solve, guess, or script around a CAPTCHA.

**If `pageState` is `form`:** continue to Step 2.

**If `pageState` is `unknown`** (no fields detected, not a login wall or CAPTCHA): show the candidate the screenshot path and ask how to proceed — this is likely an intermediate informational page in a multi-step portal, not an error.

---

## Step 2: Propose Values for This Page's Fields

For each field in the snapshot's `fields` array, propose a value using this sourcing order:

| Field looks like | Source |
|---|---|
| Name, email, phone, address | `profiles/<name>/skills/01-candidate-profile.md` Identity section |
| Education | `01-candidate-profile.md` Education section |
| Work experience | `01-candidate-profile.md` Professional Experience section |
| Self-intro / motivation / "tell us about yourself" / project description | The company's existing `.txt` file from `08-application-forms.md`, if one exists for this posting. If none exists, draft it live following `08-application-forms.md`'s rules — same grounding requirement: every claim traceable to `01-candidate-profile.md` + the master CV + `profiles/<name>/PROFILE.md` |
| A field that doesn't clearly match any of the above | Do not propose a value — flag it to the candidate as unrecognized and ask what it's for |

For any field in `fields` with `type: "file"`: match against `profiles/<name>/cv/main_<company>_<role><CV_EXT>` (resume/CV fields) or `profiles/<name>/cover_letters/cover_<company>_<role><COVER_EXT>` (cover letter fields) by filename convention. If no matching file is found, tell the candidate and ask them to point at a file or run `/apply` first for this posting.

Present the full page as a table: field label → proposed value (or "UNRECOGNIZED — please advise" / "FILE: <path> — confirm?"). Ask the candidate to approve, edit, or flag any field before continuing.

---

## Step 3: Fill the Approved Values

Once the candidate approves (with any edits applied):

For text/select/textarea fields, write a JSON file mapping each field's `selector` (from the snapshot) to its approved value, then:
```bash
bun run .agents/skills/form-filler/cli/src/cli.ts fill <path-to-field-map.json>
```

For file-upload fields, once the candidate confirms the matched file:
```bash
bun run .agents/skills/form-filler/cli/src/cli.ts upload "<selector>" "<file-path>"
```

---

## Step 4: Advance or Stop at Submit

Look at the page's `buttons` list from the snapshot. `snapshot-extract.ts` has no `isLastPage` or page-count field — finality is never inferred from a button's label or from a subjective read of "does this look like the last page." This step is fail-closed: auto-advance requires an affirmative, checkable signal that more pages follow; anything less routes to the Submit Gate.

**Step 4a — Look for a not-final signal.** Before considering any click, check for one of these two concrete, checkable signals:
- A step/progress indicator is visible in the snapshot (e.g. "Step 1 of 3", a numbered progress bar) **and** it shows the current step is before the last one.
- The candidate has explicitly told you this posting's form has more pages ahead of the current one (e.g. confirmed earlier in this session, or stated in the tracked posting notes).

If **neither** signal is present, skip straight to Step 4c — do not evaluate button text at all.

**Step 4b — Auto-advance (only if a not-final signal was found in 4a):**
If a not-final signal is present AND a button's text matches Next/Continue/Proceed (case-insensitive):
```bash
bun run .agents/skills/form-filler/cli/src/cli.ts click "<selector>"
```
Then run `snapshot` again (no URL argument) to read the new page, and return to Step 2.

**Step 4c — Default to the Submit Gate.** In every other case — a button matching Submit/Apply/Send Application, a step indicator showing the last step, **or no not-final signal found in 4a regardless of what the button is labeled (including "Continue" or "Next")** — treat this as the Submit Gate. Do not click anything as part of this step. Continue to Step 5.

---

## Step 5: Submit Gate

Show the candidate a summary of every value that was filled across every page of this session (re-read the field maps written in Step 3, or reconstruct from conversation history). Ask explicitly:

> "This will submit the application to <company> for <role>. Everything above is what will be sent. Submit now?"

**Only on an explicit "yes"** (not silence, not a related-but-different confirmation):
```bash
bun run .agents/skills/form-filler/cli/src/cli.ts click "<submit-selector>"
bun run .agents/skills/form-filler/cli/src/cli.ts close
```

**On "no" or any hesitation:** stop. Do not click. Tell the candidate the browser session is still open at that page if they want to review it themselves, and that they can ask to resume submission later (do not run `close` in this case — the candidate may still want to finish manually or ask again).

---

## Step 6: Record the Application

Only after a confirmed submission in Step 5:

1. Read `profiles/<name>/tracker.csv`. If it does not exist, create it with the standard header (identical to `/apply` Step 6b and `/outcome` Step 1.1):
   ```
   date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source
   ```
2. Match existing rows case-insensitively on company and role (using the match found or confirmed in Step 0).
3. **If a matching row exists with status `drafted`:** update it — set `status` to `applied` and overwrite `date` with today (the actual submission date; the `drafted` row's date was the drafting date, not the send date).
4. **If no matching row exists:** append a new row with `status` `applied`, `date` today, `channel` `online`, `source` the form URL, and `cv_file`/`cover_letter_file` set to the matched files from Step 0 if any were used.
5. Never restructure the CSV, reorder rows, or touch any other row.

Tell the candidate: "Submitted and recorded in your tracker as applied to <company> — <role>."

---

## Important Rules

1. **Every user-gated step is flagged and left to the candidate.** Login walls, CAPTCHAs, unrecognized fields, and the Submit click are never resolved or clicked by this command on its own judgment — always stop and ask.
2. **Never click Submit without the explicit gate in Step 5**, even if a page's flow otherwise looks fully auto-advanceable.
3. **File uploads are always confirmed before uploading**, even when the filename match looks obviously correct.
4. **The browser stays open until an explicit `close`** (Step 5's success path, or the candidate asking to stop). A "no" at the Submit Gate leaves it open, not closed, since the candidate may want to inspect or finish manually.
5. **Every field's proposed value must trace to a source** in Step 2's table. A field the command can't source is flagged, never guessed.
