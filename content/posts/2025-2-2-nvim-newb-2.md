+++
title = "Following along: typecraft's Neovim for newbs part 2"
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
summary = "In which I spend ages following a YouTube guide on nvim."
+++
If you missed the previous post, see [Following along: typecraft's Neovim for newbs part 1](2025-2-2-nvim-newb-1.md). This post refers to typecraft's [second videp](https://www.youtube.com/watch?v=4zyZ3sw_ulc&list=PLsz00TDipIffreIaUNk64KxTIkQaGguqn&index=2) in a six-part series.

## Neo-tree

This plugin acts as a file explorer for nvim. See repo [here](https://github.com/nvim-neo-tree/neo-tree.nvim).

The Minimal Example for Lazy code goes into our `init.lua` in the plugins table (below `nvim-treesitter`):

```lua
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    },
  }
}
```

Save, run `:source` and we get:

![nvim with neo-tree installed](/img/2025-02-02_with-neo-tree.png)
*nvim with neo-tree installed*

Now we need to setup some keymaps to use neo-tree. In the `local builtin` area, we add:

`vim.keymap.set('n', '<C-n>', ':Neotree filesystem reveal left<CR>', {})`

This allows me to open Neotree with ctrl+n:

![Neo-tree open on the left side of the screen](/img/2025-02-02_neo-tree-working.png)
*Neo-tree open on the left side of the screen*

Useful on its own, surely, but the point of this was to give us an explorer so we can better visualize the modularization we'll perform on `init.lua`. typecraft refers to a GitHub page that has since been moved to the official documentation website; find it [here](https://lazy.folke.io/usage/structuring).

## Plugins Modularization

In `init.lua`, we remove the entire `lua plugins` table and put it into a new file called `/lua/plugins.lua'. We also update the first line so it's a return statement:

```lua
return {
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 },
  {
    'nvim-telescope/telescope.nvim', tag = '0.1.8',
    dependencies = { 'nvim-lua/plenary.nvim' }
  },
  {"nvim-treesitter/nvim-treesitter", build = ":TSUpdate"},
  {
    "nvim-neo-tree/neo-tree.nvim",
    branch = "v3.x",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "nvim-tree/nvim-web-devicons",
      "MunifTanjim/nui.nvim",
    },
  }
}
```

and we change `init.lua` to read

`require("lazy").setup("plugins")`

to point to this file. That's how I understand it, anyway. This returns a table with the plugin configs. Per the Lazy doc:

> Some users may want to split their plugin specs in multiple files. Instead of passing a spec table to setup(), you can use a Lua module. The specs from the module and any top-level sub-modules will be merged together in the final spec, so it is not needed to add require calls in your main plugin file to the other files.

This means Lazy will concatenate found Lua tables found in `~/.config/nvim/lua` into a single setup, which is what

`require("lazy").setup("plugins")`

does. This also allows on-change loading, which is neat. To see this in action, we create a new dir called `plugins` inside the `/lua` dir and cut the catppuccin info into a new file in that dir. Additionally, we update `catppuccin.lua` to include the `vim.cmd.colorscheme` line from `init.lua` since that is no longer needed there. In fact, the entire `require("catppuccin").setup()` line is removed entirely, since the `config` property automatically calls `require(MAIN).setup(opts)`. 

```lua
return {
  "catppuccin/nvim",
  name = "catppuccin",
  priority = 1000,
  config = function()
    vim.cmd.colorscheme "catppuccin"
  end
}
```

With this pattern - using the plugins method of calling in Lua tables in the `plugins` dir - we can easily manage plugins without making a mess of the `init.lua` file. With that in mind, there are some more plugins in `init.lua` that can be placed in their own files. The resulting `init.lua` looks like:

```lua
vim.cmd("set expandtab")
vim.cmd("set tabstop=2")
vim.cmd("set softtabstop=2")
vim.cmd("set shiftwidth=2")
vim.g.mapleader = " "

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

local opts = {}

require("lazy").setup("plugins")
```

and we now have three files inside our `lua/plugins/' dir: `catppuccin.lua`, `neo-tree.lua`, `telescope.lua`, and `treesitter.lua`.

Now that the plugins are modularized, it's time to copy over the nvim settings to a new file in order to maintain consistency with how we separated the plugins. So in the `init.lua` file, we target these lines at the top:

```lua
vim.cmd("set expandtab")
vim.cmd("set tabstop=2")
vim.cmd("set softtabstop=2")
vim.cmd("set shiftwidth=2")
vim.g.mapleader = " "
```

These ought to live in a different Lua module, so before we move them, we add the following to `init.lua` to point to where they will reside after being moved:

```lua
require("vim-options")
require("lazy").setup("plugins")
```

The `require("lazy")` line is included in the code block above to indicate where the new line should go. With that line adeed, create a new file in the `lua` dir called `vim-options.lua` and paste what we took from the `init.lua` file.

Not only does modularizing the plugins and nvim configs make it easier to navigate and change settings, it also lays a framework by which we can extend it. That is, adding new plugins, for example, is trivialized: All one needs to do is add a new Lua file in the `plugins/` dir, add the appropriate configs, and return it as a Lua table. To test that out, we install [lualine](https://github.com/nvim-lualine/lualine.nvim). Here's where we are now:

![Plugins running in nvim](/img/2025-02-12_nvim_with_pt2_plugins.png)

Installation is simply given as

```lua
{
    'nvim-lualine/lualine.nvim',
    dependencies = { 'nvim-tree/nvim-web-devicons' }
}
```

so we just add a new file, `lualine.lua`, to the `/plugins/` dir and paste that in with a return (this make it a Lua table, apparently) *(I also added the additional lines typecraft indicated here)*:

```lua
return {
  'nvim-lualine/lualine.nvim',
  config = function()
    require('lualine').setup({
      options = {
          theme = 'dracula'
      }
    })
  end
}
```

which pops up a cool statusline at the bottom of nvim:

![statusline via lualine](/img/2025-02-12_nvim_statusline.png)

Next up: Completions and LSPs.
