+++
title = "Installing Git CLI on Arch"
date = "2025-02-02T08:12:21-06:00"
draft = false
#dateFormat = "2006-01-02" # This value can be configured for per-post date formatting
author = ""
authorTwitter = "" #do not include @
cover = ""
keywords = ["", ""]
description = ""
showFullContent = false
readingTime = false
hideComments = false
summary = "Getting the blog set up locally on Arch Linux."
+++
Prior to looking at the [Packages page](https://archlinux.org/packages/) on the official Arch Linux site, let's make sure the system is UTD:

`sudo pacman -Syu'

It wasn't (is an Arch machine every truly UTD?) so I installed the updated packages. With that out of the way, we find The GitHub CLI repo on the Packages page  [here](https://archlinux.org/packages/extra/x86_64/github-cli/) and run

`sudo pacman -S github-cli`

From there, I create a dir in for repos with

`mkdir -~/repos`

The `-p` option prevents the `No such file or directory` error because we are making a directory requiring a parent directory which doesn't exist, either. That is, `-p` is for making nested dirs.

With the dirs created, I `cd` in and 

`git clone https://github.com/belmead/hugo-blog.git`

Which put the repo files in the `hugo-blog` dir I made. This was a backwards way of doing things - I didn't know that cloning the repo creates a dir with the repo name, so the `mkdir -p` command was unecessary. In hindsight, this should have been obvious.

`git status` shows I am on the UTD `origin-main` branch with nothing to commit.

## h2
