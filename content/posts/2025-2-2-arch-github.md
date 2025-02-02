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

## Pause for nvim

I mistakenly assumed I have nvim installed on this system - turns out I'd been using nano previously. Shameful. I'd been meaning to use [typecraft's nvim guide](https://www.youtube.com/watch?v=zHTeCSVAFNY&list=PLsz00TDipIffreIaUNk64KxTIkQaGguqn) for a while now, so this seemed like the perfect time to do so. This is now an nvim post.

typecraft said,

> Now, who is this series for? It's for those of you who are least somewhat familiar with vim and newvim and you just want to take configuration to that next level and take your understanding of that configuration to the next level.

I can barely use nvim on my own (open files, read files, write new data, save files, exit) and I certainly have never made a config file, so. Might not be the best starting point, but installing and writing config files for nvim seems like a good use of a Sunday, so:

## Install nvim

Easy enough:

`sudo pacman -S neovim`

A quick dip inside with `nvim` shows the package is UTD, so good to go. `:q` to exit.

### init.lua

The scripting language Lua has a runtime built into to nvim, per typecraft, so that's neat. Looking forward to learning some Lua here. I do best with scripting languages, after all. Dotfiles live in the home directory - I know that much - and per [Max Shen](https://m4xshen.dev/posts/build-your-modern-neovim-config-in-lua), it needs to be in `~/.config/nvim/', a dir that doesn't exist, so

`mkdir ~/.config/nvim`

Followed by

`touch init.lua`

Which creates the file. I love the `touch` command, so useful. So now we begin writing to the file in nvim with

`nvim init.lua`

typecraft writes the file on opening with `:w`, which I don't understand the point of, but I ran with it. 

```
set expandtab
set tabstop=2
set softtabstop=2
set shiftwidth=2
```

The above control spacing and tab behavior. I write out with `:w` and then run `:source %` which results in

```
Error detected while processing /home/.../.config/nvim/init.lua: E5112: Error while creating lua chunk: /home/.../.config/nvim/lua.init:1 '=' expected near 'expandtab'
```

Which was expected. typecraft explains:

> Wait a minute, we have an error - why did that happen? Because this isn't a vimscript file, this is Lua. We do not write Vim script code in a Lua file. That's ridiculous.

I'll take his word on that, since I am not familiar with either. I'm going to assume this means that `:source %` expects a vimscript file and sees lua instead and so errors out. typecraft goes on to say:

> So how do we set Vim variables and configurations from within a Lua file? Well, it's done using things called meta accessors (or functions) that expose Vim's lower-level APIs to the Lua runtime within neovim, but for us, what we're going to want to use is the vim.cmd function, and what that does is it allows us to run any kind of Vim command within the string that comes after this function declaration, so let's call that.

He refers to [nanotee's nvim Lua guide](https://github.com/nanotee/nvim-lua-guide/blob/master/README.md#using-meta-accessors) for this bit. I don't quite grok what is happening here, so I asked 'Plex:

> To set Vim variables and configurations from a Lua file in Neovim, you can use the vim.cmd function. This function allows you to run Vim commands from within Lua code.

That's what we end up doing, and since multiple lines of Lua are involved, we write a macro and get:

```
vim.cmd("set expandtab")
vim.cmd("set tabstop=2")
vim.cmd("set softtabstop=2")
vim.cmd("set shiftwidth=2")
```

I've never written a macro, and it took far longer to figure it out than it would have been to just manually write the changes out, but now I know how to write a macro. Very powerful, and if I can remember how to do it later, it'll be a powerufl tool. Save with `:w` and source with `:source %` which no longer returns an error. Neat.

### Package manager: lazy.nvim

This is less esoteric than the above, as I work with package managers often enough (pacman on my Arch machine, brew at work). That is to say, at least I understand the "what" and "why" behind the thing. The concept of a package manager for a specific program is interesting. Getting lazynvim requires copy and pasting into the init.lua file. The repo with the code typecraft refers to is [folke's lazy.nvim](https://github.com/folke/lazy.nvim) but the maintainer moved the install instructions [here](https://lazy.folke.io/installation). The outcome using the Single File Setup is:

```
vim.cmd("set expandtab")
vim.cmd("set tabstop=2")
vim.cmd("set softtabstop=2")
vim.cmd("set shiftwidth=2")

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out, "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
end
vim.opt.rtp:prepend(lazypath)
```

A bit opaque (I'm not used to Lua's if-then statements). Per typecraft,

> So essentially this little snippet just says, "Hey, does this thing exist on the system yet? If not, we'll clone the repository, and then we're good to go."

We add a few more lines below (this is where the official Lazy install doc diverges from typecraft's guide. The install document has some different code, but I'm following typecraft. If it breaks, I'll refer to the doc. The lines:

```
local plugins = {}
local opts = {}

require ("lazy").setup(plugins, opts)
```

After saving, running `:Lazy` gets us:

![First post success](/img/2025-01-22-hugo-first-post.png)

![Lazy running in nvim](/img/snapshot_2025-02-02_09-49-06.png)
*Lazy running in nvim with `:Lazy`*

### Color scheme (catpucchin)

### telescope

### treesitter
