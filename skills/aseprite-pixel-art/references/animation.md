# Pixel animation: action before frame count

Authored guidance based on primary lessons checked on 2026-10-09. The planning and delivery checks are our practical application. Links preserve provenance; these instructions do not require downloading tutorial animations. No fixed frame count, unique-frame quota, or universal animation style is implied.

## Establish what the viewer should understand

Describe the action as visible events: for example, notice a vessel, reach, grasp, lift, tilt, pour, inspect, and settle. Choose only the events needed for the requested motion; a tiny idle loop need not tell a long story. Set approximate durations and whether it loops. Keep scope small enough to inspect before multiplying frames.

For character action, first establish a readable still character. Draw important poses that communicate the action with the relevant prop present. In a careful pour, the grip, bottle angle, head attention, and receiving vessel matter together. For an effect, establish key shape stages such as growth, peak, and decay; for machinery, establish pivots and important states. Key drawings should explain the event without depending on many connecting drawings. Extra frames can improve smoothness but cannot repair unclear keys. Repeated drawings and held poses are legitimate. [Slynyrd: animation introduction](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation).

## Build complex scenes from revisable parts

For a scene with multiple important subjects or independently moving parts, list the components, their intended motion, and which overlaps or contacts matter. Make a rough assembled frame or short blocking sequence to test composition, scale, timing, and the action path before full rendering. This is a temporary proof, not permission to leave the deliverable as construction boxes.

Create each important subject or prop as its own editable Aseprite source when the deliverable includes saved artwork. Review its still silhouette and material treatment first; then animate its decisive poses and inspect the motion on its own. Build the environment and effects as separate revisable parts. Add intermediate drawings only where the assembled action needs them. A component may have several semantic layers, but avoid a layer that mixes unrelated actors, props, and effects merely to save calls. Preserve useful per-component sources alongside the final scene when saving is requested.

Assemble the approved parts into a master scene with named layers or groups for the major components, background, and effects. Check alignment, overlap, hand/prop or foot/ground contact, depth, and native-size readability in the assembled playback. Revisions to a bird, rider, bottle, or other part should remain local rather than forcing a redraw of the whole scene. Do not claim the master is human-editable if the deliverable is only a flattened export or duplicated full-scene cels.

When the connected editor advertises `create_group` and `import_component`, make the master sprite first with its intended canvas and timeline. Use `create_group` for meaningful scene sections, then `import_component` to copy each finished open sprite into a named group. Inspect `get_document_info` afterward: `parentLayerId` and `stackIndex` show the hierarchy, and the cels should remain separate and unlinked. Import copies all ordinary image layers and their nested groups, not a flattened preview. It rejects source/target identity, occupied group names, unsupported source layers, unsafe positions, and frame-timing mismatches before changing the master.

Map each source frame to a target frame with `frameMap`; repeating a static source frame across multiple target frames is allowed. By default, a multi-frame component's durations must match the mapped master frames. Set `timingPolicy: "keep_target"` only after deciding that the master timeline is authoritative. The operation does not change target frame durations or tags; any source tags returned are information for a later explicit target-tag decision. It copies raw pixel bytes without color-profile conversion, so inspect the master when profiles differ. It does not keep the target synced when the source changes later. A later component revision must be planned as a new import or a targeted edit of the existing master group, not assumed to propagate automatically.

Use `compare_frames` to locate exact rendered-pixel changes and `render_onion_skin` to see a previous pose as a ghost behind the current pose. Both are read-only diagnostics, not proof that the motion is appealing or the story legible. Review the actual playback as well. If the connected extension lacks these tools, explain the capability gap; do not silently flatten sources or replace an unsaved live document with saved-file processing. A simple icon, a single moving object, or a deliberately flat animation can use a lighter workflow.

Pose-to-pose construction helps plan structured character action; sequential drawing can suit flowing effects or experimentation. Neither is universally superior. Keep volume and identity consistent enough for the chosen style. [Pedro Medeiros / Saint11: a basic Aseprite animation](https://saint11.art/pixel_art_articles/article3/), [Toon Boom: pose-to-pose and straight-ahead](https://learn.toonboom.com/modules/animation-principles/topic/straight-ahead-and-pose-to-pose-principle).

## Prove the action without captions

For a requested story or multi-step action, assemble a short rough sequence of the decisive poses with the intended background, focal prop, approximate timing, and loop or ending. View it at delivery size with captions, stage names, and written plot hidden. Check what the viewer can actually see: who is acting, what the actor interacts with, what changes, and which visible cause leads to the consequence. A prop that appears at its destination without a readable source or path, or a claimed scene-wide reaction visible only as a small glow, needs clearer staging before more frames or detail. Use silhouette, gaze, weight shift, hand/prop contact, and environmental response as appropriate to the scene; do not prescribe a fixed pose count or dramatic acting for a subtle effect.

If a key beat still requires the written brief to make sense, revise that beat and recheck the assembled sequence. When human feedback is part of the workflow, show this rough proof and ask what action the viewer reads before polishing. For automatic completion, make the same internal check but report that it was self-reviewed rather than claiming independent comprehension. A decorative idle loop only needs a clear motion and coherent loop, not invented narrative stakes.

## Add motion with a purpose

Our application of animation principles:

- **Preparation:** a glance or repositioned grip can make the upcoming action understandable. Do not add a theatrical wind-up to every quiet action. [Anticipation](https://learn.toonboom.com/modules/animation-principles/topic/anticipation-principle).
- **Timing and spacing:** choose how long each drawing is shown and how far positions change. More drawings do not by themselves define speed. Deliberate holds can emphasize observation; closer positions near a stop can suggest slowing. [Timing](https://learn.toonboom.com/modules/animation-principles/topic/timing-principle), [slow-in and slow-out](https://learn.toonboom.com/modules/animation-principles/topic/slow-in-and-slow-out-principle).
- **Joint paths:** a limb rotating around a joint follows an arc; multiple joints and body movement can produce a more complex path. Do not force every hand onto a perfect circle. [Arcs](https://learn.toonboom.com/modules/animation-principles/topic/arcs-of-rotation-principle).
- **Settling:** hair or a loose sleeve may lag behind the main movement. Use it when it reinforces the material and action, not as constant wobble on everything. [Follow-through](https://learn.toonboom.com/modules/animation-principles/topic/follow-through-principle).

Inspect a short rough sequence before coloring every frame. A deliberate moving arm over a held body can suit cutout animation; otherwise review the chest, head, weight, and feet where the action calls for them. The test is the visible performance, not a requirement that every body image differ.

When the MCP exposes them, `duplicate_frame` appends an independent pose copy, `copy_cel` copies one layer's drawing into an empty frame, and `move_cel` translates that whole drawing. These save repeated pixel requests, but neither duplication nor translation creates acting by itself. Change the silhouette, face, contact, and prop timing where the beat needs them. Inspect cel bounds first: a full-canvas cel cannot move within the canvas without cropping; `allowOffCanvas` is an explicit clipping choice, not a routine workaround.

## Keep the prop and loop continuous

Our practical checks:

- Give an attached object one visible owner at a time: table, hand, or another actor. Verify the transfer visually as well as in anchor data.
- Place grips and pivots from the drawings, then inspect them in the assembled scene. Numerically matching anchors do not prove convincing contact.
- Check foreground/background ordering where hands and props cross surfaces.
- For a pour, make the bottle opening, stream, and receiving liquid agree with the intended event. Vapor or bubbles should not conceal the grip.
- Review the last-to-first transition and the scene's state. An accumulating liquid level can work in a one-shot; a repeating scene needs an intentional reset or another coherent loop treatment.

## Verify the moving delivery

Inspect playback at intended speed, important paused poses, and the loop boundary. Also inspect native-size and integer-enlarged frames for pixel placement. Record which review was actually possible; a contact sheet alone is not a motion review.

When delivering to a browser, check the actual loaded scene and a complete cycle, not just atlas files, passing logic tests, or a loading-state screenshot. Check display scaling, transparency, crop boundaries, frame order, timing, and prop visibility. If Aseprite and web timing differ deliberately, identify the authoritative delivery timing instead of presenting the two as identical.

For the MCP's live sprite-sheet export, use the JSON's 1-based `frame` and rectangle plus `durationMs` rather than assuming uniform timing. Verify the PNG and JSON were both published and that the browser consumed those exact files. If frames changed while exporting, stop and export again after inspection; do not splice together mismatched captures.

Correct a specific observed problem within the request, then return the result for user feedback. Do not regenerate an accepted character merely to add frames or run indefinite polishing. Technical checks establish valid output and continuity; artistic appeal still needs human review.
