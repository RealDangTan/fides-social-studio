# MotionDesign

A Claude Code skill and a Remotion studio. Together they turn product images into 15-second marketing videos: a 16:9 master and a 9:16 vertical cut, with a soundtrack locked to a 120 BPM beat grid. The music is either code-synthesized or a real track (ElevenLabs Music or your own) stretched and aligned to the grid, with an optional ElevenLabs voice-over. ElevenLabs needs the full ElevenLabs connector (`https://api.elevenlabs.io/v1/mcp`), not the voice-only one.

- `skill/`: the `product-motion-video` skill. Linked at `~/.claude/skills/product-motion-video` (junction).
- `studio/`: the Remotion 4 project. It holds the engine (`src/lib`, `src/components`), the starter video (`src/videos/_template`), the pipeline scripts, and each video's project folder.

## Use
In Claude Code, attach or point to product images and ask for a product video, e.g.
"Make a launch video for this bottle: C:\path\bottle.png".

## Install on another machine
```powershell
cd studio; npm install
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\product-motion-video" -Target "<repo>\skill"
```
Rendering uses the installed Brave. Set `REMOTION_BROWSER_EXECUTABLE` if it lives somewhere other than `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`. The skill's studio path in `skill/SKILL.md` is absolute, so update it if you move the repo.

Remotion's own agent skills were installed with `npx remotion skills add` into `studio/.agents/skills` (linked from `studio/.claude/skills`).
