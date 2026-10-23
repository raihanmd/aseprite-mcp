---
name: aseprite-pixel-art
description: Create, critique, and revise editable pixel-art icons, characters, scenes, and animations in Aseprite. Use for asset-making requests, not MCP server development.
metadata:
  harness_revision: "2026-10-23.2"
---

# Aseprite pixel art

Create artwork that reads at its intended display size and remains useful for the user's next revision. Respect the supplied style or reference; do not impose one artist's preferences on every asset.

For critique-only requests, inspect and explain; do not change the document. A request to discuss a possible asset is not a request to draw it yet.

This is drawing guidance, not a newly trained image model. Use the connected Aseprite MCP when available. Do not claim an edit happened without a successful operation and a fresh inspection. Installation and editor connection must be checked in the current client, not inferred from this file's presence.

## Establish the asset brief

Before creating an asset, check the prompt, earlier answers, and relevant existing artwork for the intended subject, use/display size, view, and visual direction. Read [art-direction.md](references/art-direction.md) when establishing a new direction or interpreting vague feedback.

When the request supplies a subject but little visual direction (for example, "make a potion bottle"), actively ask one to three short, plain-language questions before drawing. Offer concrete options and a recommendation; explain unfamiliar terms through visible differences. Prioritize the look and intended use; for animation also establish what moves and whether it loops. Wait for the answers before choosing among these different directions or changing artwork. Read-only editor checks may continue while waiting. A question sent without a reply does not establish agreement.

Use already supplied answers and references. Do not repeat questions answered in this conversation, impose a long questionnaire, or require a reference image. If the user says "choose for me", "surprise me", or requests automatic completion, choose the remaining defaults, state them briefly, and proceed. A sufficiently detailed brief can proceed directly. A narrow revision can inherit the existing style and dimensions; ask when the requested change itself has materially different meanings.

After clarification, state a compact working brief: subject/action, visual direction and view, pixel dimensions or intended use, and important constraints. Distinguish the user's choices from remaining defaults. Offer a pixel size suitable for the requested use if the user does not know the number. Confirmed answers establish the direction; do not add a redundant approval question for the brief. Define transparency/background and palette restrictions where relevant, and record lighting and outline treatment chosen.

Separate requirements from preferences: “exactly four colors” is a constraint; “cozy” needs visual interpretation. Treat detail density, lighting/rendering, shape language, and outlines as separate choices. Minimal art can be polished; dense detail can be unreadable. No outline, selective colored edges, and full outlines are all valid. For an existing asset, inspect and preserve its established treatment unless the user asks to change it.

Treat production effort, detail density, rendering richness, and pixel dimensions as independent axes. “High effort” does not by itself authorize more shades, texture, highlights, or a larger canvas. At a small delivery footprint, spend the additional effort first on observation, construction, contour rhythm, cluster junctions, and focused correction. Add richer rendering only when its clusters describe a specific form, material, overlap, or focal cue and improve the native-size result over the simpler accepted state. Read the small-footprint guidance in [art-direction.md](references/art-direction.md).

Use the user's agreed shorthand in pixel-art requests: “high poly” means higher detail density, richer shading and material cues; “low poly” means lower detail density, broader color clusters and simpler shading. Briefly state this translation when the label sets the direction. Neither label selects outlines, forces a larger canvas, or dictates rectangular anatomy; simpler art still needs careful construction and review. Read the mappings in [art-direction.md](references/art-direction.md).

Explicit 3D context takes priority over this shorthand: “rendered 3D”, mesh, polygons, or a 3D asset request retains its literal meaning. Aseprite pixel drawing is not a 3D renderer; explain the production gap and resolve the route before substituting 2D. Explicit angular/faceted pixel art should describe meaningful planes without requiring a square body, absent expression, or inconsistent perspective.

## Route the art work

Read the relevant local guidance before making drawing decisions. These authored references contain practical explanations; their external links are attribution and further reading, not required downloads:

- [pixel-craft.md](references/pixel-craft.md): silhouettes, shading, palettes, contours, and texture.
- [subject-study.md](references/subject-study.md): visual-reference and form study for a recognizable creature, person, object, or mechanism before complex drawing.
- [visual-review.md](references/visual-review.md): visual checkpoints and worked corrections for objects, characters, environments, and effects.
- [characters-and-poses.md](references/characters-and-poses.md): people, faces, proportions, working poses, and hand/prop contact.
- [focal-subject-design.md](references/focal-subject-design.md): delivery-footprint exploration and separate acceptance gates for an important character or creature.
- [animation.md](references/animation.md): component-first scene production, key poses, timing, continuity, and moving-output review.
- [scenes-and-materials.md](references/scenes-and-materials.md): backgrounds, composition, perspective, faceted shapes, and material separation.
- [revisions.md](references/revisions.md): changes to existing artwork, especially after a user edit or when parts must remain unchanged.
- [file-workflow.md](references/file-workflow.md): explicitly requested saved-file work.

Read only the references relevant to the request. A simple icon does not need character or animation guidance.

Before the first drawing call for a new complex scene's focal subjects or a distinctive unfamiliar object, read [subject-study.md](references/subject-study.md). Study the user's references first; otherwise find and actually inspect suitable visual references when tools permit. Distill the subject's identifying silhouette, proportions, joints or part connections, target-view landmarks, and relevant material or motion into a compact reference card. Separate observed features from stylization and uncertain guesses. A search-result caption or text description is not proof that an image was viewed. Keep the card with a multi-asset project's brief and pass it to delegated artists, or require them to create it before drawing. For a familiar small icon or an already specified visual reference, keep this step lightweight; do not turn every request into a research project.

Work from large readable shapes toward shading and details. Inspect a native-size preview for readability and an integer-enlarged preview with nearest-neighbor scaling for pixel placement. Nearest-neighbor scaling enlarges each pixel without blending it with its neighbors. Both views matter; enlarged polish can hide poor native-size readability.

Call the MCP directly for ordinary drafts and revisions. When available, `draw_shapes` can compactly paint new transparent areas; use `draw_pixels` for inspected revisions over existing paint or for contours that simple shapes cannot express. Do not make anatomy or foliage boxy merely because rectangles are convenient. Neither tool chooses an appealing design for you. Do not generate request-file scripts by default: use one only when the available tools cannot express a needed pattern efficiently or reproducible procedural output is itself part of the request, and still inspect the rendered draft.

Use the lighting, material, and palette decisions to explain visible choices briefly. Do not turn the art guidance into an automatic ban on single pixels, dithering, black outlines, monochrome palettes, or deliberate flat shading.

For a complex focal character or creature, also read [focal-subject-design.md](references/focal-subject-design.md). Record the exact pixel footprint the subject occupies in the delivered scene, not only the document size, and choose a visible style target separately from anatomical reference. Explore several materially different silhouettes when the design is unfamiliar or uncertain; do not commit to the first recognizable construction. Recognition is only the identity gate. It does not prove sound construction, deliberate pixel craft, appealing style, or readable acting.

For an unfamiliar focal subject in an invented or strongly stylized action, establish the same design first in a neutral or canonical pose supported by a pose-matched observed reference, a user model sheet, or an explicitly invented construction informed by constituent references. Label invented evidence. Then translate that approved construction into the requested action. Use a flat silhouette to judge broad structural class, balance, and appendage rhythm; use a minimal identity block-in with only the values or colors needed for defining internal landmarks—often two or three—for a caption-free semantic read at the specificity required by the brief. Do not require every exact species or character identity to survive a flat silhouette alone.

When the user asks for "low effort", treat it as an economy-finish production budget unless they explicitly request an intentionally rough or unfinished aesthetic: retain full observation, construction, and review, but limit rendering passes, palette complexity, texture, and ornament. Read the mapping in [art-direction.md](references/art-direction.md).

## Draw, inspect, and expand

Read [visual-review.md](references/visual-review.md) for new artwork or a visual redesign. Build and inspect a representative draft before multiplying assets, detail, variants, or frames. Choose the proof appropriate to the request: an object, whole character, environment crop, effect key shapes, or one assembled scene frame. A script may construct artwork, but its success is not a substitute for seeing that draft. Correct a weak silhouette, unintended stiff construction, or unclear action before increasing shading or frame count. Respect deliberately geometric or rigid styles.

For a character or object that must be recognizable, inspect its isolated, mostly unadorned form at the delivery size before costume, texture, scenery, or animation can hide construction errors. Ask whether its silhouette and part relationships match the form study without relying on a caption. For an interacting prop, establish its attachment, pivot, origin, and path in the relevant key poses. If these fail, change the underlying drawing or staging before adding detail. A named layer, reference link, or written anatomy note alone is not a passed visual check.

For a new complex scene or character animation, show an early preview and ask for feedback on the look before expanding it, unless the user explicitly requests automatic completion or has already approved that design. The preview should show the focal subject in context with enough shape, color, and shading to judge the proposed look, rather than construction boxes alone; for character action, include the relevant prop and a readable action pose. Wait for the response at this checkpoint. For a simple asset, inspect and refine internally, then return the draft for review. Honor any additional review stages the user requested.

For an animation meant to communicate a specific action or story, also inspect a short, assembled rough sequence at delivery size with captions and stage labels hidden before multiplying frames or polish. If a necessary beat is understandable only from the brief, change the poses, prop trajectory, contact, or scene reaction first. A decorative idle loop does not need a story. Follow the conditional test in [animation.md](references/animation.md); an agent's self-check is not evidence that a human understood it.

For a complex scene with independently moving subjects, work asset-first: plan the parts and their interactions, create and review each important subject or prop as an editable component, animate its decisive poses, then assemble the finished pieces with the background and effects in an editable master scene. Use a rough assembled blocking preview early to check scale, contact, depth, and story; “assemble last” does not mean discovering composition problems only after polishing every part. Keep meaningful scene and component layers separate so a human can revise them. Read the component workflow in [animation.md](references/animation.md). A simple icon or intentionally flat animation does not need multiple source files.

When the connected extension supports component assembly, copy approved open components into the master with `import_component` and inspect the resulting hierarchy. Keep source documents as independent editables and do not mistake an import for a live link. Use `compare_frames` and `render_onion_skin` for motion diagnostics, then still judge the assembled playback at delivery size.

With automatic completion, perform the same visual checks internally. Name an observed mismatch and make a targeted correction. Usually one or two focused correction passes are enough before seeking feedback; if the remaining issue needs a new design choice or exceeds the request, show it and ask. Do not invent a defect to fill a checklist or run an unbounded polishing loop.

For a focal subject's failed identity gate, follow the narrower correction and bounded-restart rule in [focal-subject-design.md](references/focal-subject-design.md) rather than the general one-or-two-pass guidance. Rough assembled staging may test scale and action before approval, but detailed production and frame multiplication wait for the required subject gates.

## Use actual editor capabilities

Discover the available tools and their argument definitions. Choose explicit document, layer, and frame targets; do not invent tools from this guide. Read a current preview and relevant state before editing an existing asset. For precise preservation, use pixel data as well as the rendered image when tools provide it.

Batch bounded pixel edits or shapes when supported, rather than making one tool call per pixel. Use meaningful editable layers where they help the requested revisions; neither flatten everything nor make a layer for every shade. Prefer one named undoable change per logical revision when supported. For the current MCP, supply each edited pixel's inspected RGBA as `expected` when the target cel already exists. A cel holds one layer's image in one frame. Supply an agreed `allowedMask` for precise boundaries and `allowedColors` for a fixed RGBA palette; these checks constrain this patch, not every pixel in the document.

For animation, prefer independent frame or cel copies when only part of a pose changes. Inspect cel positions and linked status before editing; moving a whole cel is not the same as redrawing its limbs or expression. Check the new pose at native size after each meaningful movement. For a targeted rectangular revision, inspect the editor selection and its pixel freshness key before a transform, then verify preserved pixels and undo. A selection is editor state shared by the sprite, not a permanent semantic label such as “boot.” Palette entry changes require old colors and may alter how indexed artwork renders; inspect the mode and output before treating them as a local recolor. The available tool names and schemas, not this prose, decide what can be called.

If a required operation is unavailable, explain the gap. Do not silently use a saved-file copy instead of the unsaved editor document. If the AI cannot view returned images, disclose that visual review is unavailable; do not present an unseen image as visually verified.

File tools write new copies and have no access to unsaved editor changes. Creating a saved file requires an agreed filename; choosing file mode does not authorize replacing the user's original.

## Review and hand off

After creation or revision, inspect a fresh result. Separate tool-verified facts from visual judgments. Address an obvious mismatch within the current request, then show the draft for user review. Compare with the working brief and the user's approved preview, not a newly invented style target.

For a scene, inspect the assembled composition, not just separate atlases. For animation, inspect playback at intended speed and important paused poses. For a requested web delivery, verify that assets loaded and the actual scene rendered before taking acceptance screenshots; a loading screen or passing timing test does not verify the artwork. If playback or image inspection is unavailable, report that limit rather than claiming the art was reviewed.

If exporting a live animation as a sprite sheet, check both the PNG pixels and JSON frame order, durations, tag range, and transparency against the unsaved editor document. A contact sheet is for inspection; it is not the web playback asset. Report a partial export rather than claiming success if only one of the two files exists.

Describe a specific visible issue and a targeted correction when revising your draft. Prefer correcting the character, pose, or material over regenerating an accepted scene. Neither a small palette nor a high frame count establishes artistic quality. The user's review decides acceptance.

Report the preview, meaningful changes, assumptions, and remaining uncertainty. Keep source artwork editable. Save or export only within the user's request and to an agreed destination; preserve source layers rather than treating an exported PNG as the editable master.
