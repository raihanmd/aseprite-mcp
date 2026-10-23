# Pixel craft: lighting, color, and edges

This is a compact, authored synthesis, not a copied tutorial. The recommendations are flexible; the user's reference and intended display take priority. Sources were read on 2026-10-08.

## Shapes before details

A pixel cluster is a connected patch of the same color. Plan important patches together: changing a shadow's border also changes the adjacent lit shape. Check that the subject is recognizable before fine texture. Curves should have intentional step lengths; fix a misplaced step without making every organic contour mechanically uniform. A lone pixel can be a useful eye or glint, not automatically a defect. [Saint11: cluster sketching](https://saint11.art/pixel_art_articles/article2/).

Primitive drawing calls are useful for blocking masses, but low tool-call count is not an artistic goal. When ellipses, polygons, or rectangles leave an identity-bearing head, joint, paw, tail root, opening, or contour generic, revise those boundaries with intentional pixel clusters. Do not ban primitives universally; audit the places where their default geometry decides the design.

## Light describes a form

Choose the light direction and think of the object's simple volumes. A form shadow is the object's own side turning away from light; a cast shadow is one object blocking light on another. Place highlights according to material, not uniformly on every edge. Glossy surfaces can use tight highlights; matte surfaces may need none. Very small artwork cannot carry every lighting effect. [Saint11: shading](https://saint11.art/pixel_art_articles/article4/).

Pillow shading surrounds a center with darker bands without considering the represented form. It is not defined by having a frontal light: frontal lighting can be valid. Ask whether the shading explains the object, rather than merely repeating its outline. [Cure: pixel-art tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299).

For a bottle, distinguish cork, glass boundary, and liquid; for a shield, distinguish metal rim, wooden center, and fabric straps. Establish each important volume before adding bright accents. Do not copy the same highlight onto every material. These are illustrative applications, not fixed formulas supplied by an artist.

## A palette has jobs

Use perceptually distinct light/dark values and give each color a reason to exist. Almost-identical colors can weaken readability; a larger palette does not repair weak forms. Palette choices can be tried and revised while preserving the intended mood. [Derek Yu: common mistakes](https://derekyu.com/makegames/pixelart2.html).

A color ramp is a related sequence from shadow to light. Hue shifting changes its color family as well as brightness; warm light/cool shadow is one option, not the only valid direction. Monochrome and fixed game palettes remain valid. Adjust saturation and contrast for the desired mood, and evaluate the actual colors rather than assuming an HSV brightness number equals perceived lightness. [Saint11: color theory](https://saint11.art/pixel_art_articles/article6/).

For “make the liquid purple,” our proposed method is to replace its shadow, body, and highlight colors as a coherent ramp, rather than turning every liquid pixel into one flat purple.

## Contours, smoothing, and texture

Manual anti-aliasing uses chosen intermediate colors at selected boundaries. It is optional and can make a small image blurry if overused. Banding occurs when adjacent color steps track one another in ways that make the grid distracting; consider changing cluster shapes instead of adding another stripe. Inspect the result at its intended size. [Saint11: anti-alias and banding](https://saint11.art/pixel_art_articles/article5/).

For a sprite with an unknown background, background-colored edge smoothing can produce halos on another background. Keep the intended transparency and test the edge on more than one background. Outline treatment should fit the asset: no outline, selected colored edges, and full black or colored outlines are all legitimate choices. Without an outline, separate important forms through silhouette, value, color, or background contrast where needed. [Derek Yu: basics](https://derekyu.com/makegames/pixelart.html).

Dithering mixes existing colors through a pattern and can suggest texture. Decide whether that texture serves the asset; tiny glossy icons and grainy retro scenes may call for different choices. Do not classify every checkerboard or isolated pixel as an error. [Cure: pixel-art tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299).

## Review questions

- Does the asset read at its intended size, not just when enlarged?
- Do the light/shadow patches explain its form and materials?
- Does it match the supplied reference's perspective, density of detail, palette, and edges?
- Are small details useful, or do they distract from the subject?

These questions are our art-review checklist. Software can measure colors and dimensions, but those measurements alone cannot answer them.
