// The one copy source for the website. The page and llms.txt both render from here.
// Install procedure lives in the repo (README agent setup, skills/yap/references);
// this file links to it rather than restating it.

export const repo = "https://github.com/dzhng/yap";
const raw = "https://raw.githubusercontent.com/dzhng/yap/main";

/** Must match the prompt in the README's "Get started" section; the build checks. */
export const agentPrompt =
  "Install the yap skill, the Yap app and the yap CLI by following https://github.com/dzhng/yap#agent-setup";

export const requirements = "Apple Silicon · macOS 26 or newer";

export const links = {
  repo,
  releases: `${repo}/releases/latest`,
  agentSetup: `${repo}#agent-setup`,
  installation: `${raw}/skills/yap/references/installation.md`,
  skillLifecycle: `${raw}/skills/yap/references/skill-lifecycle.md`,
  skill: `${raw}/skills/yap/SKILL.md`,
  positioning: `${repo}/blob/main/positioning.md`,
  latestReleaseApi: "https://api.github.com/repos/dzhng/yap/releases/latest",
};

export const meta = {
  title: "Yap — just yap; your agent makes it a great video",
  description:
    "Yap gives Claude Code, Codex and any agent the eyes, ears and hands to record, understand and edit video on your Mac. Free, local, and your originals are never touched.",
};

export const asks = [
  "Watch this recording of the checkout bug and fix it.",
  "Tighten this into a 60-second product demo. Cut the dead air and false starts.",
  "Make a vertical version for X with big, punchy captions.",
  "Here's a launch video I love. Match its pacing and caption style.",
  "I said 'version three' at 0:42 but meant 'version two'. Fix it in my voice.",
  "Zoom in when I open the settings panel, fade out at the end, export 1080p.",
  "Clean up the background hum and give me an M4A of just the narration.",
  "I practised my pitch on camera. How's my pacing, and where did I ramble?",
  "Turn yesterday's podcast episode into three captioned clips and show notes.",
];

export const promises = [
  { title: "Runs on your Mac", body: "Recordings, transcripts and voice models stay local." },
  {
    title: "Originals untouched",
    body: "Every edit is a revision you can undo. Source media stays byte-for-byte.",
  },
  {
    title: "Your agent decides",
    body: "Yap has no built-in agent and makes zero editorial calls. It hands yours evidence and precise tools.",
  },
  { title: "Free", body: "No account, no subscription. Free for now while it grows up." },
];

export const howItWorks = [
  {
    image: "01-you-ask-agent-edits.png",
    alt: "1. record, 2. ask in your own words, 3. the agent edits",
    title: "Yap, ask, done",
    body: "Record from the menu bar, or hand over a video you already have. Ask in plain words. Your agent reads the transcript, looks at the frames, listens to the audio, then cuts, captions and exports.",
  },
  {
    image: "02-evidence-not-opinions.png",
    alt: "The toolkit supplies transcript, waveform and frames; the agent decides",
    title: "Evidence, not opinions",
    body: "Word-timed transcripts, frames, waveforms, scene and cursor events, loudness. Yap supplies the facts; your agent makes the calls, so the result follows your intent, not a house style.",
  },
  {
    image: "03-originals-untouched.png",
    alt: "The original stays put while the agent edits revisions it can undo",
    title: "Nothing to lose",
    body: "The agent works on revisions. Preview, compare, undo or restore any of them. Letting an agent edit carries no risk.",
  },
];

/** Steps for a person doing it by hand. Step 3 hands off to the agent prompt. */
export const humanSteps = [
  {
    title: "Download Yap for Mac",
    body: "Grab the ZIP from the button above and unzip it. Inside are Yap.app and a small `yap` command-line launcher.",
  },
  {
    title: "Move Yap.app to Applications in your home folder, then open it",
    body: "Put it at ~/Applications/Yap.app, where the yap command looks for it. Releases aren't notarized yet: if macOS blocks it, open System Settings → Privacy & Security → Open Anyway. Opening the app installs the yap skill for your agents (this needs Node.js).",
  },
  {
    title: "Let your agent finish the setup",
    body: "Paste the prompt into Claude Code or Codex. Your agent adds the yap command to your PATH, checks the skill, and verifies it all works. The app alone doesn't add the command line.",
  },
  {
    title: "Just yap",
    body: "Record from the menu bar and ask for the video you want. Not happy? Say so in one more sentence.",
  },
];

/** Plain-text instructions for agents, served as /llms.txt and shown in the page's agent view. */
export function llmsText() {
  return `# Yap

> Yap is a free macOS toolkit (a menu-bar app, the \`yap\` CLI and an agent skill) that gives Claude Code, Codex and other agent harnesses the eyes, ears and hands to record, understand and edit video locally. It has no built-in agent and makes zero editorial decisions: the agent decides, Yap supplies evidence and precise, non-destructive operations.

Requirements: ${requirements.replace(" · ", ", ")}. Linux and Docker cannot run the native app or capture media.

## Install

If your user asked you to install Yap, the request is:

    ${agentPrompt}

Follow the canonical steps in the repository. They are written for agents and kept current with each release:

- [Agent setup](${links.agentSetup}): the order of operations (skill, then app and CLI, then verification).
- [Installation procedure](${links.installation}): download, checksum-verify and install Yap.app at ~/Applications/Yap.app and the \`yap\` launcher at ~/.local/bin/yap.
- [Skill lifecycle](${links.skillLifecycle}): pinned skill install, scope (whole computer vs project) and verification.

Facts that change what you do:

- Yap.app and the \`yap\` launcher are separate files in the release ZIP. Installing or opening the app does not put \`yap\` on PATH.
- Opening the app installs the yap skill for the whole computer when Node/npx is available (Settings → Install skill, on by default). Check before installing it again.
- The user may already have installed Yap.app by hand. Keep it; install only what's missing, and back up anything you replace. If the app is not at ~/Applications/Yap.app, set YAP_APP to its absolute path.
- Releases are not notarized. If macOS blocks the app, the user approves System Settings → Privacy & Security → Open Anyway. Never remove quarantine attributes or disable Gatekeeper.
- Verify with \`yap capture.status --help\` (no app launch), then \`yap service.health\`. Installation does not grant capture permissions.

## Use

- [yap skill](${links.skill}): how to record, understand and edit video for the user with the toolkit. Start a fresh agent session after installing it so it is discovered (\`/yap\` in Claude Code, \`$yap\` in Codex).

## Optional

- [README](${links.repo}): what Yap is and what people make with it.
- [Positioning](${links.positioning}): what is possible today and what isn't yet.
- [Latest release](${links.releases}): app ZIP, release.json receipt and SHA256SUMS.
`;
}
