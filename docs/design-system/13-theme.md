# Theme recommendation

Use light as the default, and ship a complete dark palette for chrome only.

## Why not light-only

The current site is light. A light default keeps the agreement, the PDF, and the marketing page in one visual family. Navy and amber already read on white.

## Why not a decorative dark mode

A dark agreement sheet would not match the PDF the parties download. Signing on a dark surface and receiving a white PDF makes the record look like a different document. The words being agreed stay on `--sc-white` in both themes.

## What is themed

Header, page background, cards that are not the agreement, navigation, form chrome, and status banners may use the dark tokens in [03-color.md](03-color.md). The agreement preview, the signature image, and the public verify facts stay on white.

## How it switches

Milestone 4 may follow `prefers-color-scheme` and offer a later control in Account. The control is a preference in `localStorage`, not an account field. There is no server theme. If the control is absent, follow the system scheme for chrome and keep the agreement white.

Both palettes in the color document meet the contrast table for the pairs that are allowed. Bright amber is never small text on white in either theme.
