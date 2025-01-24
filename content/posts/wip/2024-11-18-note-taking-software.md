---  
layout: post  
title: Note-taking Software
---

I'm on the hunt for a good note-taking application. This is my usage history:

- A single, long MSFT Word document
- MSFT OneNote
- Notion
- Writing .md files in PyCharm
- Fabric
- Writing .md files in Obsidian (currently here)

The main use case is composing and organizing work notes. My main issue with using MSFT products — one of the larger issues, anyway — is the rubbish user interface. This will not do:

![Edit options in MSFT Word](https://belmead.github.io/blog/images/msft_word_editing.jpg "Edit options in MSFT Word")

This (Google Docs) is miles closer, but still not right (read: comfy):

![Edit options in Google Docs](https://belmead.github.io/blog/images/google_docs_editing.jpg "Edit options in Google Docs")

Too many options. I will expound on this point ere long.

## UNIX Philosophy

Thinking about finding the right editor reminded me of the Stack Overflow blog post, [Modern IDEs are magic. Why are so many coders still using Vim and Emacs?](https://stackoverflow.blog/2020/11/09/modern-ide-vs-vim-emacs/). I'm not one to retread on such well-worn ground as dunking on the baffling logic of the post, seeing as my betters have done such an impressive, thorough job — I have nothing new or interesting to add to the heap anyway — so this is more of an attempt to use the article as a example of how I've grown to appreciate constraints in software as well as understand and esteem [[UNIX philosophy]].

To speak on that, briefly, I'm not sure when I learned of the idea of the [[UNIX philosophy]], and I certainly didn't understand it well at that time (not do I completely understand it now). I'm beginning to grasp it in parts, but many aspects make sense only *intellectually*. One aspect that has gone from intellectual to internalized, gut-based understanding is the notion of "do one thing well."

My understanding of this principle encompasses both its positive aspect — 'do one thing well' —and its antithesis — "don't do many things poorly." It's been my experience, especially since becoming a full-time product designer, that many applications take the latter approach. Since our company is full-on entrenched with MSFT, I've had (and currently have) the experience of using at least half a dozen of their offerings regularly — mostly the Office 365 suite and Azure DevOps.

In this paragraph, before rewriting it, I accused MSFT products of not doing anything well. That's inaccurate: Each bit of Office 365 software does what it is advertised to do. But the amount of things Word (for example) does poorly dwarfs what it does well (namely, creating and saving .docx files). Creating/saving is an easy enough task to accomplish, but the user experience — what happens in between "get in" and "get out" — makes for a crummy time.

To return focus to the UI momentarily:

![Edit options in MSFT Word](https://belmead.github.io/blog/images/msft_word_editing.jpg "Edit options in MSFT Word")

It's understandable why the ~40% of the text and type options on the left side exist. They could be presented in a more elegant fashion, certainly, but my gripe centers around the middle and right-side bits. The middle part (which are *styles*, but that piece of info is only available on hover) and the right side (Styles Pane, Dictate, Sensitivity, Add-ins, Editor) is the antithesis of [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).  To misquote [Mark Corrigan](https://www.youtube.com/watch?v=Dh15fetq8MM):

> That's the way things are these days: Let's just put an icon here, a button there. Why not? Who knows what these things are used for? Who even cares?

Google Docs does a more elegant job with with their edit panel:

![Edit options in Google Docs](https://belmead.github.io/blog/images/google_docs_editing.jpg "Edit options in Google Docs")

This is as close as I've seen to a proper editing panel. If it could relocate about one-third of its icons behind context menus, we'd be in business. I'd like to think Google spends an appropriate amount of resources on product development and that the icons and options available in the edit panel are a reflection of an enormous amount of ongoing user testing — that what you see are indeed the most-used tools and formatting options 

## Markdown

I heard about Obsidian a couple of months ago on YouTube and was quite taken by the graphing feature. Since I have a low attention span and occasional inattention to detail, I assumed the graphing feature happened automatically, somehow. I did not know until I was a few days into using Obsidian that it's a function of backlinks, which was demotivating, but I set myself up on that one by fabricating unrealistic expectations based on YouTube thumbnails. The upshot, though, was I immediately took to markdown as syntax once I began using Obsidian. It's highly readable and has a bare minimum of formatting elements.

To be clear, I wrote notes in markdown in PyCharm for a few months prior to using Obsidian, but it never really clicked until recently. I know I've written readme files on GitHub before, but I really don't remember having any concrete opinion on markdown at that time.

## Constraints are good

This is one of those counterintuitive things about product design. This idea is in the same vein as, "burdens are a blessing" in the sense that challenges and/or limitations can lead to positive outcomes. They don't always have lead to positive results, but oftentimes they do. Prerequisite to understanding this maxim is a reframing of mindset: Limitations — markdown's relatively small pool of formatting elements — encourage a reevaluation of what is required to complete a task. For note taking, as it turns out, markdown is more than sufficient in most cases. As a bonus, it just feels neat to use, and on fiddling with the mouse, as the [syntax for formatting elements is character-based](https://www.markdownguide.org/basic-syntax/). 

This also means the lack of an editing panel. Obsidian is fairly clean...

![Obsidian](https://belmead.github.io/blog/images/obsidian.jpg)

...which is appreciated, as it's the single minimalist experience in my otherwise messy (thanks, Microsoft) work-tech stack. It does what it set out to do with nearly nonexistent "but wait, there's more!" action. I haven't fully explored backlinks, so commenting on how I feel about them would be premature.

I like the approach Obsidian takes w/r/t no edit panel, but I quickly threw this together to show what one might look like:

![Obsidian with edit panel](https://belmead.github.io/blog/images/markdown_edit_panel.jpg "Obsidian with edit panel")
## What's next?

I think at this point any change from Obsidian would be akin to distro hopping — just using something else because it looks neat or if I get bored of Obsidian. It works perfectly well right now (I need to set git up so I can push directly to the blog, but that's a skill issue on my end). I've heard neat things about Joplin, but it looks too busy and I don't need anything like cloud sharing, collab, or multimedia notes. It would be an IDE to Obsidian's text editor for my use case, so I reckon I'll stay put for now.