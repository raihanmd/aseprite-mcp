# Agree on the intended look

This is authored interaction guidance for general pixel-art work, approved on 2026-10-09. Examples illustrate possible questions and decisions, not mandatory styles or prompts. It works without external resources.

## Ask enough to share expectations

A subject alone leaves many different valid results. For a sparse creation request, ask about the decisions that most change what the user will see, then wait for their answers before drawing. Usually one to three questions together are enough. Use the client's question tool when available, or an ordinary conversational question. Keep the skill portable: no particular tool, slash command, or client interface is required.

Start with the missing visual direction and intended use. For example:

> What look do you want: a simple chunky game icon, a rounded bottle with rich glass highlights, or an angular bottle with flat shaded faces? I recommend the rounded version for a collectible item. Is it for a small inventory icon or a larger illustration?

The recommendation is an option, not a selected answer. Do not draw while the question is unanswered. If the user delegates the choice, state the chosen direction and proceed. A fully specified brief needs no new interview. Do not ask about drawing internals such as color ramps or joint coordinates when a visible preference is enough.

For a scene, prioritize mood, viewing angle, focal subject, and display context. For motion, clarify the action and whether it repeats. Ask only about missing choices. Do not ask an uninformed user to invent a frame count; suggest timing and pixel dimensions from the agreed use.

If there is an existing reference or artwork, use what it establishes. "Like this, but blue" is a revision, not an invitation to redesign the proportions and outlines. "Make it better" needs a question about the desired change, such as clearer shape, richer lighting, or a more expressive pose.

## Separate the visible decisions

| Choice | Plain-language options | Meaning |
| --- | --- | --- |
| Detail density | Minimal, moderate, dense | How much distinct information the image contains: features, texture, folds, reflections. |
| Lighting/rendering | Flat color, distinct light/shadow patches, rich material shading | How light and surfaces are described. It does not determine the outline or pixel dimensions. |
| Shape language | Chunky, rounded, angular, organic | The character of silhouettes and internal forms. Angular forms can still have gesture and expression. |
| Edges | No outline, selective colored edges, full outline | How forms separate from their surroundings. Do not silently equate pixel art with a black border. |
| Pixel grid and display | Small game sprite, larger illustration, exact dimensions | Available space for shapes and the size the viewer actually sees. Enlarging 32x32 pixels does not create new detail. |
| View | Front, side, three-quarter, top-down, isometric | How the subject and related objects are seen. Show or explain an unfamiliar view before requiring a choice. |

These are independent decisions, not a required form to fill out. Do not ask every row on every request. A reference can establish several at once. A game palette or explicit dimensions are constraints and take priority over a suggested default.

## Translate the user's high/low shorthand

For pixel-art requests in this harness, apply this user-approved convention. It is a practical translation of the user's vocabulary, not an official community definition of polygon counts:

| User wording | Default pixel-art interpretation | Visible drawing choices |
| --- | --- | --- |
| High poly | High detail density and rich rendering | More purposeful small features, developed light/shadow clusters, distinct material cues and selective reflections or texture. |
| Low poly | Low detail density and simple rendering | Fewer small features, larger readable color clusters, restrained light/shadow steps and simplified surfaces. |
| High effort | Carefully refined finish; establish the desired density if missing | Inspect and revise the silhouette, forms, edges, and relevant lighting/material cues. A minimal design can receive this finish. |
| Low detail / minimal | Sparse visual information | Preserve essential identifying features and clarity; follow any independently specified lighting or outline treatment. |

For example, say "I'll interpret high poly here as detailed pixel art with rich shading" or "I'll interpret low poly here as simpler pixel art with broad color shapes and fewer details." Then clarify other missing choices under the normal brief rules. Do not ask the 2D-versus-3D question solely because of these labels in an otherwise pixel-art request.

Both high and low treatments need deliberate design and review. Low density does not authorize unfinished work or a box-shaped character. High density does not require shadows, texture, or maximum contrast everywhere. Neither label determines outline treatment, pixel dimensions, viewing angle, or angular geometry. "High/low resolution" concerns the grid size. If the user explicitly requests angular or faceted shapes, apply that separate choice with meaningful planes.

An explicit 3D request, mesh workflow, or polygon constraint overrides this pixel-art shorthand. For "rendered low-poly 3D character", keep the actual 3D meaning and explain that Aseprite cannot render that model by itself. Respect a user's explicit definition or reference when it differs from the convention.

## Make the agreement concrete

After the answers, state a short working brief. For example:

> I'll make a rounded blue collectible bottle with rich glass reflections and selective colored edges, on a transparent background. I'll use 48x48 pixels for the inventory icon; that size is my suggested default. I'll show the finished draft for review.

For a more complex task:

> I'll make a three-quarter workshop scene with an expressive mechanic, moderate detail, and no outer outlines. I'll show one composed frame with the mechanic reaching for a tool before expanding the scene and animating the action.

Do not claim the user chose values they did not choose. State remaining defaults, important limits, and the next preview. Answers to the questions establish agreement; another "approve this plan?" turn is unnecessary unless a new material choice appears.

## Handle later feedback

Translate feedback into a visible target and preserve the approved parts. "Too boxy" could mean a rectangular silhouette, rigid pose, or unwanted angular shading; inspect the image and ask which interpretation fits if it remains unclear. "Less detailed" could mean fewer small features while keeping the established lighting. "No outline" means revise the edge treatment, not automatically flatten the shading.

Return the proposed correction briefly, execute the agreed revision, and obtain a fresh preview. Do not turn one person's disliked scientist into a universal ban on rectangular robots, chunky icons, flat shading, or outlines.
