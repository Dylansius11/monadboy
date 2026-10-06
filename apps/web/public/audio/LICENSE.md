# Audio licenses

## `starlight-city-loop.mp3` — background music loop

| Field | Value |
| --- | --- |
| Title | Starlight City (Loop included), the `Loop/Starlight City LOOP` file |
| Author | Zane Little Music |
| Source page | https://opengameart.org/content/starlight-city-loop-included (OpenGameArt node 143960, published 2022-10-24) |
| Author profile | https://opengameart.org/users/zane-little-music |
| Original download | https://opengameart.org/sites/default/files/starlight_city.zip (87.6 MB; contains `Loop/` and `Starlight City/` folders as WAV, MP3 and OGG) |
| License | CC0 1.0 Universal (Public Domain Dedication), the only license listed on the source page |
| License URL | https://creativecommons.org/publicdomain/zero/1.0/ |
| License checked | 2026-10-06, read directly from the source page's "License(s)" field, which links the URL above |
| Attribution | Not required by CC0. Credited here anyway. |

The track is the author's chiptune "great night in the city" piece from the
free album *Another Bag of Chips* (https://zanelittle.bandcamp.com/album/another-bag-of-chips).
The download contains no separate license file; the OpenGameArt page is the
license record.

### Conversion

The file in this directory is not the original download. It was made with
FFmpeg 8.1 from the lossless loop render, with nothing else changed (no trim,
no loudness change, no fade):

```
ffmpeg -i "Loop/Starlight City LOOP.wav" -map_metadata -1 \
  -c:a libmp3lame -b:a 96k -joint_stereo 1 starlight-city-loop.mp3
```

| File | SHA-256 |
| --- | --- |
| `starlight_city.zip` (as downloaded) | `73a5f1b73513452888f456ebe3cc5232f94a04dc90e047f96737d779928b6c57` |
| `Loop/Starlight City LOOP.wav` (source of the encode) | `26d45ef63dd93af3c56813ddf921836d4155c02ed2ee79f3821f6f858cd4f99a` |
| `starlight-city-loop.mp3` (shipped) | `2f07588eab21c79788b6010fc459c160ef796ea34581c26dfc2e17751cd8a83f` |

Result: 48 kHz stereo, 100.17 s (about 115 BPM), 96 kb/s, 1.2 MB. The encoder
writes its start delay into the file so that decoders which honour it loop
without a gap; the loop plays through Web Audio with `loop = true`.

## Sound effects

There is no sound-effect file. The effects (move, confirm, back, boot, coin,
alert, withdraw) are synthesized at runtime from pulse-wave oscillators in
`apps/web/src/sound/chip.ts`, so there is nothing to license.
