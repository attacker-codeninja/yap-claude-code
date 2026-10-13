# Replay prompts (verbatim)

The person's messages from baseline session `a4621b78-f275-489e-bb3c-b5a5deacde5d`,
in order. The replay sends them unchanged except where a deviation is noted.

## Turn 1

The original message, sent as written:

```
I want you to use this recording with this ID with the Yap CLI: d0e524d3-fa76-4556-aab3-04aeed386a48

Okay I'm making you your own launch video. That app recording is a screen recording of your own launch video. If you check the downloads folder, you also see some other recordings from other camera angles. The first recording is actually the exact same take as this screen recording here, but just from a farther-away camera. Then there are two other recordings from the same camera, but just a different take 

Can you create a nice 2- to 3-minute launch video? You should make the first minute exciting but it could be like 2 minutes. Just crop out whatever you think you can crop out but it should showcase the product and have my spiel.

You could jump between different camera angles: my Mac recording, my Mac camera recording, the screen share, and the farther camera recording. You could even add some screenshots of your own from your own codebase because we're actually not showing the UI of the products. You could add those to the video as well.

Make your own launch video 

Makes this high production quality and surprise me
```

**Deviation.** In the baseline, the following message arrived mid-turn, while
the agent was transcribing. Headless `claude -p` can't inject a message
mid-turn, so the replay appends it to turn 1 after a blank line. All five DJI
files are in Downloads from the start.

```
Okay I added two more clips in the downloads folder. Those don't have any speech. They're just kind of random shots. Feel free to use them if you think they're useful
```

## Turn 2

```
I think the first 30s is a bit too long, I like where you're going with that. It's actually an interesting story but I almost feel like that should be at the end as part of the outtake. I think you need to just get started and introduce the product right away because you only have like 10 seconds to capture someone's attention
```

## Turn 3

```
You should try to move the shot where you show all four videos into the one-shot. The fact that we could take in all these different sources, from screen recording to MacBook cam to all this other camera, I think that's actually a key point and that's the wow moment. Have that be part of the first 10 seconds of the video because that gets people's attention 
 
For the parts about how everything works (the install with the CLI and all that stuff), you could probably reduce that by half. We should still talk about it a little bit. Definitely talk about install with a prompt, and your agent could figure out the rest but you don't need to go into that much more detail. If there's a way to cut it down by half, figure out what's the best way to cut it down by half 

The part where I monologue into the MacBook camera at around the timestamp 1:06, I think it's a cool monologue but you should try to add some other visual flair to it so it's not just me talking to the camera. Yeah maybe even for that, you could have a multi-view around the corner as well, right? You could also add a separate shot that kind of appears somewhere there, like a farther shot, just to further drive home the point that you don't need to be overly prepared. I'm just kind of filming this off the cuff and I just have a bunch of random cameras filming me.
```

## Not replayed

Each of these is a deviation from the baseline:
- **"…just open the finder so I can review it…"** Review logistics with no
  editing content; headless runs can't use it.
- **"Can you generate some other music options and play it for me?…"** This
  depends on Duet/ElevenLabs credits, not on Yap. Replay it optionally, and
  only if the replay should also cover the music workbench.
- **"…keep a feedback.md file…"** A meta request about the session, not the
  edit.
