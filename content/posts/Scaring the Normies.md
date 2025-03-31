---  
layout: post
title: title
draft: true
---

This last weekend, I installed Arch Linux (btw). I was previously running Linux Mint since late June, and while it worked fine — wonderfully, in fact — I wanted to understand what the big deal was and goof around with a tiling window manager on a new-to-me distro.

Hyprland and HyprPanel are neat and are forcing me to get better editing dotfiles, which in turn is forcing me to use nano, as I don't grok Vim at all. I intend on learning it, but I want to feel comfortable with nano first.

As a side note, because I ran `yay -S librewolf` instead of `yay -S librewolf-bin` , I now understand what `.bin` files are for. Additionally, I habitually run LibreWolf without `--nohup` and `& disown` so there's always a Kitty terminal just hanging out, taking up screen space. Bit annoying. I'll figure it out.

My YouTube and Odysee recs are now half Linux-centric creators, and it appears the Year of the Linux Desktop conversation has never died down since I first encountered it 20 years ago, and the points of that conversation have changed little:

1) Some of the applications in your stack won't work 1) at all, or 2) without some finagling (Wine bottles, VMs, etc) — absolutely true
2) CLI fear — partially true, yes mostly overblown
3) Ease of borking the system — " "
4) Installing can be a chore (creating a live install medium, UEFI settings) — 100% true

### 0. You can't make people care

This is a life lesson applicable to so many things, and it doesn't fail here: If someone truly doesn't care about something, you can't make them care. The best you can do is make a compelling argument, but that's often insufficient. Microsoft Recall (even if it got recalled, so-to-speak) ought to be more than enough of a reason to stop using Windows, but that ought-ness is based on my sentiments toward privacy and security, and I don't expect anyone else to share in those thoughts and feelings (but it'd be a lot cooler if you did).

Passwords are a perennially perfect example: Computer users have been told for decades about the importance of cybersecurity, yet weak passwords still abound. Password requirements have gotten better across time (mandatory use of upper and lowercase letters, numbers, special characters, minimum lengths) but the rate at which Facebook accounts are "hacked" implies this is still insufficient (not a Facebook user — unclear if the example password requirements apply in this case; use as a general example). Passphrases are a decent idea, biometrics are neat but have their own set of issues, Yubikeys are yet another thing entirely... 

It's a scenario where many or most people won't budge unless forced, and there's no force at work in the apparently opaque, esoteric world of operating systems: You use whatever OS is on the computer your work furnished for you, or you care only enough to get be on the OS that runs your stack. If your stack is Gmail and Facebook, then it's whatever is at (or more likely, in) hand. 
### 1: Applications Won't Work

This is the most common issue, and affects some users more than others. If you  married your stack (see below), then this one is especially challenging. Software is but a means to an end, and unless you have a niche job that requires a single piece of software (that is, using anything but that application is dangerous, impossible, or otherwise forbidden) that is unavailable on Linux — or any other OS than the one you use — <em>and</em> you can't run it in a VM — there isn't a reason, outside of complacency or laziness, not to at least try another way.

A personal example of this is PowerPoint. Decks are one of the primary methods by which we disseminate information at work, and since we are thoroughly entrenched with Microsoft, PowerPoint is the presentation software we use. To be clear, you can use whatever software you want to make the presentation, but it must use the company's template and exist as a .pptx, so the implication is clear. I've made a handful of decks using Canva for intra-departmental presentations only to find out after the fact the deck was informational enough to send elsewhere at HQ, so it needs to adhere to standards everyone else is used to. Bummer. It would've saved time just to start in PowerPoint.

On the other hand, standards exist for a reason, assuredly, and I can be creative on my own time. That's a fair rebuttal. Periodic testing of standards is a healthy measure for a company of any size in order to stay up to date (read: competitive) and entrenchment is often a deleterious and near-intractable situation to be in, but that's a separate discussion.

> Don't marry your software/code/design

For that matter,

> Don't make your stack a part of your personality

![His humor runs in Emacs](https://belmead.github.io/blog/images/emacs.png "Emacs")
<sup>Emerald McS. et al., PhD | [Programmers are also human: Interview with an Emacs Enthusiast in 2023 [Colorized]](https://youtu.be/urcL86UpqZc?si=w2C2YlbI8axQUW_7)</sup>

The stack -> personality pipeline is what leads to caring about text bubble color. 

The more enterprisey/larger the org, the more pushback there is in switching software. Or hardware. Or anything. Maintenance of legacy systems makes it doubly or triply hard, and being in bed with a company's suite (Office 365, Azure) seems like fine way to acquiring legacy systems. Again, separate topic.

Apps are but a tool use to accomplish a goal (unless the software itself is the goal, e.g., video games) the lack of Office 365 in Linux isn't a problem: LibreOffice exists and works well, and if you don't mind using non-FOSS solutions, Google Docs is more than capable of getting the job done. "Software X isn't available on Linux" may be true, but there's likely an alternative, unless you are one of the people above who rely on niche software.

### 2) CLI Fear

The necessity of interacting with the command line interface is largely a thing of the past. I don't recall needing to use the CLI at all when installing or using Linux Mint, for example, and although Arch is very much a different story, Mint isn't alone in reducing or eliminating the sight of a command line.

### 3) Ease of borking the system

While there are certainly more ways to break the distro than there are in macOS or Windows, at this point, one has to go out of their way to do so. Updates are no more or less likely to goof things up than on any other desktop OS, so unless you are `sudo`ing around or copying and pasting commands from ChatGPT without understanding what they do, this is becoming a non-issue. Backup creation is not a just Linux thing, it's good practice for everyone.

### 4) Laborious installation

I spent an afternoon trying to get my UEFI to play ball when I was trying to get on Linux Mint. This was entirely my fault, since I grew up with and am comfy configuring a BIOS. Having mouse support and a snazzy GUI is still weird to me, in fact. Why it took hours to disable SecureBoot and tell the firmware interface to ignore my Windows SSD baffles me to this day. Skill issue, certainly.

That's half the issue here: I doubt many normal desktop users have interacted at all with their UEFIs, much less know what they are doing inside one. Each mobo manufacturer (and each mobo) has/may have their own UEFI flavors, so a one-size-fits-all solution is impossible. In my decades of assisting people use technology, I've found that most are fearful of breaking things that are impossible to break, so how much more would they fear erring in an environment where things can definitely break?

Then there's creating a bootable installing medium. Easier, sure, but dealing ISO files are not everyday filetypes for most users. 