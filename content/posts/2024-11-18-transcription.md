---
title: "Transcription with OpenAI's Whisper"
description: "Findings and notes from using python and AI to transcribe a lengthy video."
date: 2024-11-18
---
Shortly before leaving work last Friday, I received an email with a request to use AI to transcribe some video. Note the request — to use AI to accomplish the task. The video was around two and a half hours long, so I would have chosen that route anyway, but a colleague and I had led the (semi-) monthly AI meeting two days prior to the request, so the idea of using AI where possible was fresh in everyone's head.

## The Planned Workflow

I had a rough plan of the order of operations:
1) Demux the audio from the video
2) Chunk the audio into sections based on who was speaking
4) Run a test on a comparatively small audio file to a model capable of transcribing to a text file
5) If the test is a success, run the chunked files through the transcriber
6) Recombine the output files into a single text file

I intended to only use FOSS tools to accomplish this task, but since the video file was on my company-provided MacBook, I just used Quicktime to extract the audio to a .m4a file. This didn't take more than 30 seconds or so, despite the file size of ~15GB. The result was a ~279MB AAC audio file — 256 kbps, Low Complexity profile, stereo.

## The Actual Workflow

Immediate hurdle: The only method I had (read: felt like using) for moving the file to my home computer (which would do the actual work) was a USB stick, which had lived most of its life as a Linux installer drive. OS X detected the it and I reformatted using Ex-FAT with a GUID partition. I had to look up both of these options to confirm they would work. Not much of an issue there.

The next challenge, however, seemed a bit much considering how small it seemed at the time: Getting Arch to recognize the drive. `lsblk` only showed my SSDs, but `lsusb` showed the drive just fine. In hindsight I suppose this meant that Arch saw the device, but did not recognize it as a block-level device. Turns out this was an easy fix — running `sudo pacman -S exfat-utils` and rebooting was all it took. I would have saved five minutes or so if I had rebooted after installing that package, but I assumed it would start working immediately. It did not.

As a side note, I did run `sudo pacman -Syu` prior to this whole endeavor, and a Hyprland update borked my dotfile slightly, so that was fun. Is this the meme of updates being a chore on rolling-release Linux distros? I got that sorted later on, but it was a minor annoyance.

To resume: Following a reboot, Arch began to see the USB drive:

```
sda      8:0     1 57.3G     0 disk
├─sda1   8:1     1 200M      0 part
└─sda2   8:2     1 57.1G     0 part
```

I'd decided that I wanted to use a Python script to handle the whole thing, which is thankfully [well supported](https://github.com/openai/whisper/?tab=readme-ov-file#python-usage). It's simple enough:

```
import whisper

model = whisper.load_model("turbo")
result = model.transcribe("audio.mp3")
print(result["text"])
```

I was concerned that, given the code snippet, only mp3 files were supported, but this turned out to be a non-issue.

What did turn out to be a mild issue was setting up a virtual environment. I'm still a beginner with Python, so I'm used to just writing scripts and running them in the terminal (or PyCharm — I know, I know...) so the concept was new to me. I'd heard of venvs, but eschewed learning how they work since my Python education hadn't called for one yet.

I leaned on Perplexity quite a lot to guide me through the process, and I was satisfied with the results. The longer context windows in modern LLMs are wonderful. However, as of this writing, Perplexity decided to remove one of our conversations about virtual environments, so I'll have to write some of this from memory. So it goes.

One of the things it took me a while to wrap my head around (WIP) was that venvs are tied to a single terminal instance. I had two terminals open (one for editing Python scripts, another for running tests), but only one would run the Python script. The other threw this back at me:

```
python transcribe_test_hero.py Traceback (most recent call last): File "/home/belmead/py_projects/transcribe/transcribe_test_hero.py", line 1, in <module> import whisper ModuleNotFoundError: No module named 'whisper'
```

I imported the repo via `pip install git+https://github.com/openai/whisper.git` per the readme, so I was perplexed as to why the same command resulted in two different outcomes in two different terminals. As it turns out, 

> The issue you're experiencing, where the script runs successfully in one terminal but raises a `ModuleNotFoundError` in another, is likely related to differences in the Python environment or configuration between the two terminal sessions. Here are some common reasons for this behavior:
> 
> 1. Different Python Environments
>-  **Virtual Environments**: If you are using a virtual environment (e.g., created with `venv` or `conda`), it’s possible that one terminal is activated in a virtual environment where the `whisper` module is installed, while the other terminal is not.

Also something about isolation and single activation. I was confused because I knew the git repo had successfully downloaded to the correct dir, so why did one terminal act like it didn't know what the `whisper` module was...? The module is *there on the SSD*, so why isn't it findable/usable by all terminals? I'll need to continue learning in that area.

The next concern was having some manner of system status indicator. I wanted this because I assumed the main task would take a while, and I didn't want it to fail and not tell me, since I had no idea how long it would take. I wanted to do something else with my Saturday than stare at a terminal and wonder if a process was working or was hanging, as I suspected those two outcomes would look identical.

I ran the test file (a short mp3, about two or three minutes in length) using the `base` model and it took about two seconds to complete. This was fast enough to make me think it failed, but checking the output file confirmed it had, in fact, worked. It did get someone's name wrong, and switching to `turbo` got the name right, but that transcription took a bit longer, maybe 10 seconds or so.

(On reexamination of the repo's readme, I can't help but wonder if I using `base.en` would have been even faster. There's no English-only `turbo` model, so it wouldn't have mattered in the long run, but still.)

I started with `print("\nWorks!")` thinking it would only output that string if it had successfully completed the transcription, but I started to doubt that idea, as I imagined the process failing silently and the string printing regardless. This was also a poor solution in that I required ongoing, visual feedback to reassure me, and this was a string that would only print at the end. 

This is what Perplexity suggested:

```
# Event to signal when transcription is done  
done_event = threading.Event()  
  
# Function to display a spinner while processing  
def spinner():
	while not done_event.is_set(): # Check if done_event is set  
		for cursor in '|/-\\':  
			print(f"\rTranscribing... {cursor}", end='', flush=True)  
			time.sleep(0.1) # Adjust speed of spinner if necessary  
  
# Start the spinner thread  
spinner_thread = threading.Thread(target=spinner)  
spinner_thread.start()  
  
try:  
	# Perform transcription (this is a blocking call)  
	result = model.transcribe(audio_file) # This will take time based on audio length  
finally:  
	done_event.set() # Signal that we are done with transcription  
	spinner_thread.join() # Wait for spinner thread to finish
```

It's simple enough — a spinner animation runs in a separate thread using a `while` loop until the transcription is complete. Once the transcription is done, the event is set, and the spinner thread stops.

This was *wild* to me because I'd never dealt with threading before, and hadn't thought of a situation where it'd be necessary. This makes sense, however, and was an instructive moment about how cores and threading work. From what I gathered, a single core can handle multiple threads, and multiple cores can handle threads in parallel. That's about the extent of my knowledge base there. Again, something to look into at a later time.

I reran the test file and the spinner animation worked, so I moved on to the main task — the 2.5-hour audio file (I ended up not chunking the audio file, as the value proposition there seemed a bit flimsy. It's mostly one speaker, anyway).

Back to cores for a moment:

![Core Usage](https://belmead.github.io/blog/images/core_usage.jpg "Core Usage")

Nine cores at or near 100% usage! Now that's exciting — I rarely do any work that really puts the 12600k through its paces. On the topic of `htop` — I only realized after I started the transcription job that watching the core activity was sufficient for monitoring system status. I didn't need a spinner after all. Oh well. What would have been useful was a timer, since I got up to play Ys X while it ran. That's an improvement for another day.

I returned right around 19 minutes after the script started to find it had completed its job. Who knows how long it actually took? Again, a timer would have been helpful. Still, under 20 mins for transcribing a 2.5-hour audio file locally seemed impressive enough to me, so I sent off the transcript to the one who requested it.

## Python Script

Here's the script. It could be improved with a timer placed inside the spinner function.

```
import whisper
import sys
import threading
import time

# Load the Whisper model
model = whisper.load_model("turbo")  # Use a valid model name

# Specify the path to your audio file
audio_file = "th2024_audio.m4a"  # Replace with your actual file name

# Event to signal when transcription is done
done_event = threading.Event()

# Function to display a spinner while processing
def spinner():
    while not done_event.is_set():  # Check if done_event is set
        for cursor in "|/-\\":
            print(f"\rTranscribing... {cursor}", end="", flush=True)
            time.sleep(0.1)  # Adjust speed of spinner if necessary

# Start the spinner thread
spinner_thread = threading.Thread(target=spinner)
spinner_thread.start()

try:
    # Perform transcription (this is a blocking call)
    result = model.transcribe(audio_file)  # This will take time based on audio length
finally:
    done_event.set()  # Signal that we are done with transcription
    spinner_thread.join()  # Wait for spinner thread to finish

# Print the transcribed text to a file
with open("th_transcript.txt", "w", encoding="utf-8") as file:
    file.write(result["text"])

print("\nTranscription complete!")

```

## Lessons and Takeaways

I incorrectly assumed without consulting the data table in the repo that the `turbo` model had more parameters than the `large` model. It does not: In fact, the large model has nearly twice as many (809 M vs. 1550 M) parameters. On the other hand, the `turbo` model is listed as being ~8x faster than the baseline `large` model (that's how I read the table, anyway). It also uses ~4 GB more VRAM — this would have been fine, since I run a 6750XT.  If I have any more transcription jobs in the future, I will run some tests for speed and accuracy.

Virtual environments are great, probably, but annoying in that they are married to a single terminal instance. I'm sure I greatly misunderstand how that part works, exactly, and perhaps a terminal multiplexer would be of aid in venv scenarios, but I'm not going to look into that right now. I'll just have to remember not to close the terminal the venv is attached to.

A timer would be nifty to tell me exactly how long it took to transcribe. This would be excellent for testing the same audio file against the different models.

Altogether, it was pleasing to get the task completed in a relatively short amount of time (the bulk of the job was me learning how things worked; the actual transcription was quick) using FOSS on Arch. I know there's some debate on exactly what "open source" means when it comes to models, as the training data itself usually isn't open-source, but I'm calling this a win for my skills in Linux/CLI, Python, and more advanced AI usage. 
