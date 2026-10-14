# Pixel-art research: from readable shapes to convincing characters

Research checked **2026-10-09**. This guide records artist principles, our interpretations, and the limits of the reading. The maintained [art skill](../../skills/aseprite-pixel-art/SKILL.md) contains operational instructions; this guide is not a claim that an AI agent produced good art.

The central finding: pixel art needs good drawing decisions as well as careful pixel placement. A working drawing tool, a small palette and a large frame count do not establish good character art. Anatomy, perspective, light and composition still matter. [Pedro Medeiros: beginner's guide](https://saint11.art/pixel_art_articles/article1/).

Read this guide for the conclusions and the [source map](pixel-art-source-map.md) for original tutorials and reading limits. The scientist examples below come from an earlier local trial and illustrate review questions; they are not a reusable benchmark result.

## 1. What should pixel art look like?

There is no single correct look. Pixel art emphasizes intentional control of pixels and their relationships, not merely a small resolution. Shape tools and fills can support that control; individually clicking every pixel is not required. [Cure: definition and technique](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=11299).

Style involves more than a label: palette, size of color patches, amount of detail, viewpoint and subject treatment all contribute. Slynyrd's discussion explicitly treats style as something artists develop and vary, rather than one recipe. [Developing style](https://www.slynyrd.com/blog/2018/7/14/pixelblog-7-developing-style).

Our practical interpretation: agree on a few visible examples before a complicated asset. Describe what to borrow from each: rounded proportions, angular shadows, readable eyes, quiet background, or energetic poses. Do not combine several conflicting references without deciding which controls what. References are evidence about the desired appearance, not permission to copy or redistribute somebody's finished artwork.

### Small glossary

| Term | Plain meaning |
| --- | --- |
| Native size | The actual drawing grid, such as 32 by 32 pixels, before enlargement. |
| Silhouette | The outer shape when the whole subject is filled with one color. |
| Cluster | A connected patch of pixels of the same color. |
| Value | How light or dark a color looks. |
| Color ramp | Related colors used from shadow to light. |
| Form shadow | The shaded part of an object's own shape. |
| Cast shadow | Shadow an object puts onto another surface. |
| Key pose | An important drawing that makes an action understandable. |

## 2. Choose the size and style before the details

Small sprites need abstraction: some features must be omitted or exaggerated. Larger sprites have room for features but require more work. Slynyrd compares stockier and more realistic character proportions and explains that neither small nor large automatically means easy. His six- and eight-head examples are study models, not mandatory character proportions. [Realistic human anatomy](https://www.slynyrd.com/blog/2024/3/25/pixelblog-49-realistic-human-anatomy).

Our proposed brief should state:

- Subject and purpose: inventory icon, playable character, scene illustration, or animated decoration.
- Actual pixel dimensions and intended on-screen size.
- View: side, front, three-quarter, top-down, or isometric.
- Proportions and level of simplification.
- Background/transparency, lighting, outline treatment and any exact palette limit.
- For animation: the action to communicate, not just a requested number of frames.

For the scientist, a 64 by 64 frame is only a container. We still need to decide how much of it the person occupies, how large the head is, and whether facial expression must remain visible behind goggles. Those are design decisions, not facts inferred from the frame dimensions.

## 3. Build the large shapes first

Medeiros demonstrates beginning with large color patches, then refining their relationships and finally cleaning up small edges. A shadow's border also defines the neighboring lit patch. Isolated pixels can still serve useful details such as eyes; this is not a command to erase every one-pixel feature. [Cluster sketching and painting](https://saint11.art/pixel_art_articles/article2/).

Derek Yu's character tutorial treats shading as describing a solid form: when detail is reduced or the image is squinted at, the large light/dark shapes should remain understandable. He also discusses edge smoothing and cautions against smoothing a sprite toward a background color that may later change. [Pixel-art basics](https://derekyu.com/makegames/pixelart.html).

Our suggested first review is deliberately simple: look at the silhouette and a version with only a few light/dark masses. Can you tell where the head, torso, arms and legs are? Is there space between the hand and torso? Does the coat have a clear shape? Add pockets, seams and sparkles only after these answers are convincing. This is a proposed review exercise, not a universal requirement to use exactly three colors.

## 4. Edges: crisp does not mean mechanically square

Manual anti-aliasing means placing selected intermediate colors to soften a boundary. It is optional; overdoing it can blur a small sprite. Banding is the distracting stepped effect when neighboring color boundaries track one another too closely. Changing the patches can be better than adding another stripe. [Medeiros: anti-alias and banding](https://saint11.art/pixel_art_articles/article5/).

Cure discusses irregular line steps, excessive dithering and isolated-pixel noise, while allowing tiny features and glints. Dithering mixes colors in a pattern; useful texture and unwanted noise are different outcomes. These are judgment calls, not automatic defect labels. [Cure: things to avoid](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=11299).

Our review questions: does a curve turn as intended, does a small highlight explain something, and does texture compete with the face? Black outlines, colored outlines, no outlines and deliberate flat shading are all choices. Do not make “no outlines,” “no dithering,” or “no single pixels” global rules.

## 5. Palette: give colors useful jobs

Medeiros separates hue, saturation and value, then shows how changing more than brightness can make a shadow/light relationship interesting. Warm light with cooler shadows is one approach; his guidance explicitly allows experiments and exceptions. A monochrome or fixed retro palette is not inherently wrong. [Basic color theory](https://saint11.art/pixel_art_articles/article6/).

Slynyrd builds ramps by varying hue, brightness and saturation, with shared colors helping unify a scene. He stresses evaluation by eye rather than a universally correct numerical formula. We should not turn his example hue increments or palette size into requirements. [Color palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes).

Our proposed checks: distinguish colors that need to separate; reuse colors when they serve the same role; inspect the result in context. “Exactly eight colors” can be a user requirement, but eight colors alone cannot certify good art. Recoloring purple liquid should preserve its dark, middle and bright relationships rather than flattening it to one purple.

## 6. Shadows describe shape, not just an outline

Medeiros distinguishes an object's own shadow, projected shadows and reflected highlights. Glossy surfaces can have focused highlights; rough surfaces may have none. Flat faces and rounded objects need different handling, and tiny sprites cannot carry every lighting effect. His exercises reinterpret references for readability rather than just shrinking them. [Basic shading](https://saint11.art/pixel_art_articles/article4/).

Light direction also controls mood and where highlights and shadows fall. Slynyrd often uses upper-corner light but explicitly allows multiple sources and other directions. [Light and shadow](https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow).

For the lab, our proposed material study is four small samples under the same chosen light: coat fabric, bottle glass, a metal instrument and wooden bench. Keep the form readable in each, then choose different surface cues. For example, a restrained bright glass accent should not become identical white stripes on skin, cloth and wood. This is an exercise we propose, not a complete physical simulation or a verified AI capability.

Pillow shading is shading inward from a shape's border without explaining its volume. A frontal light can be valid; the problem is not simply that the light is in front. [Cure: pillow shading](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=11299).

## 7. Characters: proportions and personality before costume

Slynyrd works through an anatomical guide, simple forms and final character treatment, using references to support the choices. Gesture can begin with a rough line capturing the body's movement before the forms are built. Stylization is allowed: the lesson is a useful construction method, not a ban on big heads or short legs. [Human anatomy and gestures](https://www.slynyrd.com/blog/2019/5/21/pixelblog-17-human-anatomy).

Derek Yu's critique points out that more color and shading cannot rescue a stiff underlying design. He demonstrates simplification, stronger separation and thinking in volumes instead of letting the pixel grid dictate every form. His preference for thicker protrusions is a style/workability guideline, not a universal minimum limb width. [Common mistakes](https://derekyu.com/makegames/pixelart2.html).

Our scientist study should first establish head, chest, pelvis and limbs as simple readable forms. Compare a few silhouette/proportion alternatives, then choose one. Make the coat fit that body instead of using a coat-shaped rectangle as the entire torso. Personality might come from an attentive lean, lifted eyebrow, hair shape or carefully held vial; it does not require adding dozens of facial pixels.

## 8. Faces and hair: small, but not incidental

Slynyrd's face lesson separates front and side views, then builds hair as a large shape before shadows and highlights. It demonstrates how features are selectively exaggerated or subdued in one anime-influenced style. It is not a rule that every scientist should have anime eyes. [Faces and hair](https://www.slynyrd.com/blog/2020/7/28/pixelblog-29-anime-faces-and-hair).

Our proposed face check asks whether you can tell where the person looks and what they feel. Design goggles as part of that expression: their shape can show separate lenses, a bridge or a visible eye if the chosen size allows it. If a broad visor is intended, keep it deliberately; if not, do not let one blue block accidentally decide the whole character's identity.

## 9. Poses: draw the action, not just a moved hand

Proko's gesture lesson focuses on the movement connecting body parts, rather than copying every contour. A main action line and simple curves help communicate body language; a stiff stick figure is not the finished goal. This is general drawing guidance that we can apply to pixel characters, not a pixel-specific recipe. [How to draw gesture](https://static.proko.com/static/course-lesson/how-to-draw-gesture).

Animation paths also depend on joints: an isolated limb rotating around a pivot follows an arc. Complex actions can combine joints and body motion; this does not mean every hand must trace a perfect circle. [Toon Boom: arcs](https://learn.toonboom.com/modules/animation-principles/topic/arcs-of-rotation-principle).

Our proposed pour pose should answer: which way does the chest face, where is the elbow, where is the weight, how is the bottle gripped, and what is the scientist looking at? Review the whole person with the prop and bench visible. A hand coordinate is useful for attaching a prop, but it cannot establish a convincing pose on its own.

Intentional elongation or smears can be valid animation choices. Slynyrd discusses exaggerating action poses and balancing timing with the desired game response. Therefore, changing limb lengths is a review flag, not an unconditional anatomy failure. [Melee animation](https://www.slynyrd.com/blog/2018/9/8/pixelblog-9-melee-attacks).

## 10. Animation: strong poses before lots of frames

Medeiros distinguishes drawing the important poses first from drawing sequentially, and introduces timing and volume consistency. These are complementary methods with different uses. [A basic Aseprite animation](https://saint11.art/pixel_art_articles/article3/).

Slynyrd shows that key poses should communicate an action even without the drawings between them. More frames can make movement smoother without making it more energetic or appealing. He also treats repeated poses and modest idle cycles as legitimate economical choices. [Introduction to animation](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation).

His larger walk-cycle study starts with a simple, color-coded body, chooses useful poses from motion reference and adds clothing afterward. It illustrates why costume detail and motion should not be designed independently. [Human walk cycle](https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle).

Useful animation concepts, in plain language:

- Preparation helps the viewer understand an upcoming action. For a careful pour, looking at the vessel and positioning it can do more than moving the hand abruptly. [Anticipation](https://learn.toonboom.com/modules/animation-principles/topic/anticipation-principle).
- Drawing important poses before the connecting drawings helps control structure; flowing effects can instead benefit from sequential drawing. [Pose-to-pose and straight-ahead](https://learn.toonboom.com/modules/animation-principles/topic/straight-ahead-and-pose-to-pose-principle).
- Timing includes duration and rhythm, and should suit the character and action. [Timing](https://learn.toonboom.com/modules/animation-principles/topic/timing-principle).
- Uneven spacing can show speeding up and slowing down. Adding drawings without specifying how long they are shown does not uniquely determine speed. [Slow-in and slow-out](https://learn.toonboom.com/modules/animation-principles/topic/slow-in-and-slow-out-principle).
- Hair and loose clothing can lag behind a movement and settle after the body stops. This should support the action, not make everything wobble continuously. [Follow-through](https://learn.toonboom.com/modules/animation-principles/topic/follow-through-principle).

Our suggested first animation trial is one short action with a few clearly different poses. Approve the still character, then the poses, then the motion. Repeated body drawings are valid for a cutout-style animation if that treatment matches the brief. “42 frames” is a file property, not an art-quality score.

## 11. Scene composition, perspective and backgrounds

Slynyrd demonstrates stylized projections that trade physical precision for visual consistency. His advice is to establish coherent viewing rules across scene elements. [Graphical projections](https://www.slynyrd.com/blog/2018/3/14/pixelblog-3-graphical-projections-1).

For isometric work, he uses common two-across/one-up pixel steps and consistent guides. This is a familiar pixel-grid approximation, not a requirement for all perspectives or a mathematically exact definition of every isometric image. [Isometric projection](https://www.slynyrd.com/blog/2018/4/12/pixelblog-4-graphical-projection-part-2).

Texture should describe a surface without exhausting the viewer. Slynyrd discusses repeated characteristic shapes, variation and quiet areas instead of outlining every piece with equal emphasis. [Texture](https://www.slynyrd.com/blog/2018/2/15/pixelblog-2-texture).

In backgrounds, depth can be suggested by reduced contrast and detail toward the distance. Slynyrd's landscape examples use atmospheric perspective; indoor scenes need their own interpretation rather than mechanically adding outdoor haze. [Landscape pixeling](https://www.slynyrd.com/blog/2018/11/16/pixelblog-11-landscape-pixeling).

Our lab composition test: before brickwork and shelf contents, show a simple scene with the scientist, vessel and bench. Is attention drawn to the experiment? Can the arm and bottle be seen against the background? Does the bench obscure the intended action? Detail should follow that hierarchy; a detailed wall is not compensation for an unreadable character.

## 12. Tiles, liquids and other effects

Tile art needs consistency at boundaries as well as good individual tiles. Slynyrd discusses balanced texture, wrapping edge shapes, variants and background readability. Mirroring is conditional: lighting may make a mirrored tile wrong. His tile-size examples are practical choices, not compulsory powers of two. [Side-view tiles](https://www.slynyrd.com/blog/2020/5/21/pixelblog-28-side-view-tiles).

Slynyrd breaks animated water into understandable components and connects direction, reflection, flow and loop timing. [Water in motion](https://www.slynyrd.com/blog/2018/10/12/pixelblog-10-water-in-motion).

For the potion scene, our proposed effect study is smaller: establish the pouring source, stream and receiving surface; then add just enough bubbles or vapor to explain the event. Effects should not cover the hand or make it impossible to tell whether the bottle is held. A seamless loop also needs narrative continuity: resetting the hands while leaving a permanently fuller vessel may or may not suit the intended scene. That choice needs review, not a blanket physics rule.

## 13. “Low poly” needs a visible interpretation

There are several distinct possibilities:

1. Draw a **2D pixel character** whose shadows look angular or faceted.
2. Build an **actual 3D character**, then render small images and refine them.
3. Use a rough **3D reference** to help draw difficult angles, while keeping the final artwork hand-refined and 2D.

Slynyrd demonstrates a sense of rotating 3D form created with hand-drawn frames. [3D pixel-art animation](https://www.slynyrd.com/blog/2022/9/25/pixelblog-40-3d-animation). Medeiros demonstrates rough 3D reference followed by redrawing rather than treating the reduced render as finished art. [Using 3D reference](https://saint11.art/blog/3d-ref/). Lospec documents a separate toolkit for pixel textures and pixelated renders in Blender. Its existence does not prove that route is better for our scientist or compatible with our MCP. [Toolkit overview](https://lospec.com/blender-toolkit/).

We have **not chosen one of these for the next trial**. The test project's plan chose the first interpretation, but the user's exact intended appearance has not been established. Research does not resolve that preference by itself.

## 14. Review the actual output, not just the drawing code

Enlargement should normally preserve the grid with whole-number scaling and no smoothing. Medeiros also discusses compromises for unusual display sizes, so this is not a claim that all non-integer display is forbidden. [Scaling pixel art](https://saint11.art/blog/scaling/).

Consistent world pixels matter, but UI, maps and artwork can be deliberately separate visual systems. Medeiros uses this distinction to explain mixed styles without making every screen element share one resolution. [Style consistency](https://saint11.art/blog/consistency/).

Our review should include native artwork, an integer-enlarged view, an assembled scene and moving output at the intended size. Look at the draft before animation, then watch the loop and stop on important poses. A screenshot of a loading screen is not a screenshot of the finished art. A unit test comparing output pixels against the generator proves faithful output, not good drawing.

## 15. Apply the research in an AI workflow

The following workflow is our interpretation of the research. It is not a claim made by these artists about AI models, and its effectiveness still needs matched art trials.

1. **Agree on the look.** Keep a short asset brief with a few relevant visual references and explicit assumptions.
2. **Review simple drafts.** For a character, inspect proportions, silhouette and face before costume polish; for a scene, review the large layout before texture.
3. **Review poses.** Check a few whole-body action poses with the prop before producing a long animation.
4. **Draw, inspect and revise.** Use fresh previews after bounded edits. Name the visible problem and change that problem, not everything at once. Stop for user feedback after a bounded number of revisions.
5. **Verify the delivered form.** Check the editable source, exports and actual animation/browser display separately. Preserve user edits and use explicit live or file mode.

The maintained skill routes to short topic references for characters, animation, scenes, and revisions. A required preview can show whether an artifact exists; it cannot certify artistic quality. Review the image itself.

### Keep useful knowledge local

Original resources may not always be available. The skill's local references contain the operational guidance, while this guide and source map retain explanation and provenance. An agent should be able to follow the skill without opening external websites during every drawing request.

Each useful lesson should retain:

- The principle, in our own words.
- When to use it and what visible problem it addresses.
- A concrete review or correction method.
- Exceptions and legitimate alternative styles.
- An original small visual example when one has actually been created and inspected, not a promised or copied illustration.
- Original source author/URL, checked date and reading scope for later rechecking.

For example, a local character lesson can explain how to review head/chest/pelvis alignment and the hand/prop pose directly. It should not merely say “visit this anatomy tutorial.” The external link remains valuable for attribution and verification, while the maintained explanation remains available if the page does not.

This is not approval to bundle third-party artwork or mirror whole tutorials. For later skill changes, update the canonical local references first, then separately synchronize and verify installed copies. Offline availability is not evidence of improved drawing quality.

No amount of tutorial text trains a new drawing model. Comparative trials are still needed to find which model and production method best fit a user's brief. Image generation, imported drafts and 3D references are optional alternatives to evaluate with permission, not silent replacements for editable live Aseprite work.

## 16. Proposed evaluation after research review

This is a **benchmark design, not a benchmark result**. Keep technical success separate from artistic judgment.

| Trial | What it tests | Review evidence |
| --- | --- | --- |
| Potion icon | Clear outline, volume, glass/liquid separation | Native/enlarged PNG; editable source; targeted recolor. |
| Scientist still | Proportions, face, coat, coherent view | Candidate silhouettes; chosen still at intended size. |
| Reach and pour | Whole-body gesture, grip, prop contact | Key-pose sheet plus short moving preview. |
| Small lab scene | Focal hierarchy, perspective, texture restraint | Assembled scene without and with details. |
| Revision | New request plus preservation of accepted work | Before/after images; protected-pixel and source checks. |

For each comparable run, record the exact prompt, model/version/settings that are actually exposed, skill/reference version, tools used, time, tool calls, revisions, failures and outputs. Do not guess unavailable model settings. Keep budgets and reference access comparable; vary one factor at a time. Repeat successful-looking cases to see whether the result is reliable rather than lucky.

For subjective review, use a small rubric: recognizability, shape/pose, light/material, style match and appeal, each with written reasons. Animation additionally needs action clarity and continuity. An unviewed item gets **not assessed**, not zero. Human preference is the final acceptance criterion; automated checks establish dimensions, palette requirements, preserved pixels and valid files, not beauty. A bad character should not be concealed by averaging its score with a good website or icon.

Choose the model from matched results, not from an unsupported claim that a named model is inherently best at pixel art. The existing trial lacks its model identity and exact prompt/skill trace; it is useful failure evidence, not a controlled model comparison.

## Research limits and next checkpoint

This pass covers the main drawing and production problems with original artist tutorials and animation lessons. It does **not** claim to have consumed every tutorial, read whole paid books, watched every linked video or inspected all animated diagrams. The source map records text, indexed lessons, catalogs and inaccessible material separately. Copyrighted tutorials and artwork were not mirrored into the repository.

The local deep-research helper failed before collecting sources because an offline dependency was unavailable; primary web research and manual vault/context review were used instead. The tutorial-image browser could not start here, and some GIFs were not supported by the web reader. Our own local trial PNGs were visually inspected; remote tutorial diagrams are linked, not claimed as visually analyzed.

Next: review these conclusions and choose a visual direction for the scientist. Then separately approve a narrow harness/skill change and a matched art trial. Until then, no code, skill, hook, configuration or artwork implementation is included in this research checkpoint.
