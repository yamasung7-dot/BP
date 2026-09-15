# PBR Material Generator

A Blockbench plugin that generates editable PBR maps from the currently selected texture.

## What it does

Use **Tools → Generate PBR Material** with a texture selected. The plugin opens a settings dialog where you can choose a material preset or tune:

- Metallic
- Shininess
- Normal strength
- Surface detail

It generates three maps:

- `*_normal` — tangent-space normal map
- `*_height` — grayscale height map
- `*_mer` — packed Metallic / Emissive / Roughness map

The generated maps are added as Blockbench textures, so you can continue editing them inside Blockbench.

## Status

This is the first working prototype. The generator is intentionally dependency-free and performs all image processing in the Blockbench environment.
