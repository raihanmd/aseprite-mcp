# Visual checkpoints and worked corrections

Authored applications of the local [pixel-craft](pixel-craft.md), [character](characters-and-poses.md), [scene](scenes-and-materials.md), and [animation](animation.md) guidance, prepared on 2026-10-09. These examples describe decisions and corrections; they are not benchmark results, approved reference artwork, or guaranteed recipes. External tutorials are not needed to follow them.

## Use a proof that fits the task

Before producing a large output, draw enough to test its important visual decisions:

| Request | Useful first proof | Review before expanding |
| --- | --- | --- |
| Item, icon, or UI ornament | One complete asset at its actual target size | Silhouette, meaningful detail, edges against the intended background. |
| Character or creature | Whole subject, face direction, and an important pose | Identity, proportions, expression, gesture, and contact with a relevant prop. |
| Environment or tileset | One assembled crop with representative neighboring tiles | Projection, focal hierarchy, joins, repetition, and consistent pixel scale. |
| Effect animation | Important shape stages against a plausible background | Origin, direction, growth/decay, contrast, and the intended sequence. |
| Multi-asset scene | One composed frame with the focal subject and key objects | Scale, depth, overlap, style consistency, and what attracts attention. |
| Character action | Established character plus key action poses with the prop | Whether the viewer can understand the action and hand/prop interaction. |

A whole scene should not first appear only after every atlas and browser control is finished. A simple item does not need the full scene workflow. For complex scenes or character animations, show the early proof for user feedback as specified in `SKILL.md`; automatic completion still requires internal inspection.

## Inspect the image, not the drawing program

View an actual fresh preview at native size and an integer enlargement without smoothing. Include the intended background or plausible contrasting backgrounds for transparent sprites. For scenes, inspect assembled art as well as individual assets. For animations, watch playback at intended speed as well as selected frames.

Assess against the agreed direction:

- **Readability:** Can the intended subject, important feature, or action be identified at display size?
- **Forms and pose:** Do silhouettes and internal shapes describe the intended volumes, expression, gesture, and perspective?
- **Light and materials:** Do shading and reflections follow the chosen forms and distinguish relevant surfaces?
- **Style and hierarchy:** Do edges, detail density, palette, and shape language agree, with attention where the brief calls for it?
- **Motion:** Does timing, contact, continuity, and the loop or ending communicate the intended event?

Apply relevant criteria only. Flat graphic icons need no glossy material rendering. Environment-only scenes need no actor. Deliberately stiff robots and geometric designs need no organic pose correction. Dimensions and file checks support delivery but do not establish visual appeal.

## Keep acceptance gates separate

For a refined small-footprint variant, also ask whether each added light, shadow, texture, or edge cluster explains form, material, overlap, or focus at native size. Compare it with the simpler accepted checkpoint without changing accepted construction. More colors and internal edges are production facts, not evidence that the refined result is stronger.

Long contour-parallel bands, isolated highlights with no plane relationship, and shadows that merge unrelated limbs are reasons to regroup or remove rendering. A high-effort result can legitimately contain fewer, better clusters than an earlier draft.

For focal character or creature, use its actual occupied delivery footprint rather than shrinking large proof by intuition. Record each applicable result separately:

- **Structural silhouette:** Does the flat shape communicate orientation, broad body class, balance, support, and appendage rhythm without an accidental lookalike dominating?
- **Semantic identity:** After a minimal block-in adds only the values or colors needed for defining internal landmarks—often two or three—can the intended subject and facing direction be identified at the specificity required by the brief, without caption or costume explanation?
- **Construction and contact:** Do major masses connect coherently, with readable support, balance, near/far parts, joints, grip, expression, gesture, and perspective?
- **Pixel craft and style:** Do contour steps, clusters, value grouping, edges, detail density, palette, and shape language look deliberate and agree with chosen style target?
- **Action and story:** Do decisive pose, timing, contact, continuity, and loop or ending communicate intended event?

Passing identity does not pass construction or craft. Clean clusters do not prove identity. Frame continuity does not prove action makes sense. Record whether evidence came from an uninformed viewer, an informed reviewer, or provisional author self-review, and mark each gate pass, fail, or unassessed. After failed blind identity read, the one-correction-then-restart rule in [focal-subject-design.md](focal-subject-design.md) takes precedence over general correction guidance.

For an unfamiliar focal subject, split identity review into two stages. First inspect the flat silhouette for structural class, orientation, balance, support, and appendage rhythm. Then add only the values or colors needed for defining internal landmarks—often two or three—before requesting a caption-free identity read at the semantic specificity required by the brief. A silhouette may pass structure without yielding an exact species name; a colored block-in may pass identity while still failing craft.

When an action lacks a pose-matched reference, compare a neutral identity anchor with the action pose. If the construction changes identity between them, revise the translation before reviewing story or polish.

## Worked corrections

### Object: a curved metal lantern reads as a flat badge

Observed issue: its dark bands repeat the outside contour, and every edge receives the same highlight. The image does not show the curved housing or separate metal from glass.

Correction: keep the accepted silhouette and palette, place a broad light/shadow division across the housing for the chosen light, and separate the glass window with its own restrained cue. Inspect the small preview before adding rivets or scratches. For a deliberately flat badge, the same observation may be acceptable; follow the brief.

### Character: an attentive worker reads as a standing rectangle

Observed issue: a uniform torso with symmetrical straight limbs and an unchanged head makes the worker's task unclear, even though the costume is recognizable.

Correction: sketch the intended weight and reach using head, chest, pelvis, and limb directions. Adjust shoulder slope, waist/hem contour, head attention, and near/far limbs where the chosen style permits. Put the tool in the hand and inspect the entire pose before adding costume details. Revisit the figure at native size: anatomy added only in the enlarged view may disappear in use. A reserved pose can be correct; require a readable action rather than movement in every body part.

### Environment: a forest looks like repeated rectangular stamps

Observed issue: equal-width trunks and equally contrasted square foliage make every region compete, with weak depth and no clear path.

Correction: preserve any established tile grid, but vary visible silhouettes and grouping where permitted. Establish foreground/background masses and a readable path using value separation, overlap, and quieter regions. Test a crop containing neighboring tiles before extending the map. Retain deliberate geometric foliage if the brief asks for it; do not confuse a grid used for assembly with mandatory rectangular shapes in every drawing.

### Effect: more particle dots obscure a magical burst

Observed issue: all frames have similar scattered noise, so the burst has no clear origin, peak, or decay.

Correction: establish distinct key shapes for buildup, expansion, and fading; control the largest clusters and contrast first. Add secondary sparks only where they clarify motion. Watch the rough sequence before decorating every frame. Frame count alone does not fix indistinct stages.

## Revise with a reason and a stopping point

Name a visible mismatch, the proposed change, and what should stay. Inspect the updated result after that change. Do not write a confident self-review without seeing the image, or invent praise and numerical quality scores from metadata.

Usually one or two focused correction passes can address clear mismatches before handing back a draft. If the issue needs a new direction, the tool cannot perform the correction, or improvement remains uncertain, show the result and ask for feedback. Preserve accepted designs and user edits. If preview inspection or playback is unavailable, describe that gap and request review instead of presenting the output as visually verified.
