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

```
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

In `init.lua`, we remove the entire `lua plugins` table and put it into a new file called `/lua/plugins.lua'. We also update the first line so it's a return statement:

```
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

This means Lazy will concatenate found Lua tables into a single setup, which is what

`require("lazy").setup("plugins")`

does. This also allows on-change loading, which is neat. 
