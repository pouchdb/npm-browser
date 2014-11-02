#!/usr/bin/env bash
# assumes you have imagemagick installed
# and a normal-sized icon.png in the current dir
# creates Apple- and FXOS-ready icons
#
sizes='57 76 120 152 180 128 512'

for size in $sizes; do
  convert -resize ${size}x${size} icon.png icon-${size}x${size}.png
done
