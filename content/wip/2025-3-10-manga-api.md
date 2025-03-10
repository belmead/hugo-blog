---
title: "Lovable.dev and the pain of finding a good API"
description: "AIs and APIs."
date: 2025-03-10
---
## Rolodex

My dad's always been a prolific reader, and we were no strangers to the used bookstores back in Odessa. I disinctly remember going into one on the corner of N. Dixie Blvd. and E. 42nd St. (near Big Daddy's) (it's an empty storefont now — who knows how long's it's been empty? A decade, maybe two? Bookstores do not fare well in West Texas) and seeing him pull out a Rolodex-esque collection of lined rotary cards with a list of books he owned. The point of these cards was so that he wouldn't accidentally buy a book he already owned — a problem I aspire to have one day. I think he ended up purchasing a Larry McMurtry novel.

I have a kid on the way, so I've been trying to find new hobbies that are more amenable to having limited time/constant interruptions. The AYN Odin 2 Pro was a great purchase, and will serve well, but I needed something else, so I started to get into manga. I've always loved anime, ever since being introduced via [Saturday Anime](https://www.youtube.com/watch?v=bMwMkYZvW5Q) on the Sci-Fi channel sometime in the mid 90s. Everyone thinks the era at which they discovered something is the golden era, and I am no different: Record of Lodoss War, Project A-Ko, Bubblegum Crisis, Demon City Shinjuku... peak cinema, really. Since watching is out, manga seems to be the way to go. I ignored manga forever, so I have at least 30, maybe 40 years worth of titles to get through, so why not now — and why not do what my dad did, and keep a record of what I have read, and what I need to buy? Furthermore, why not do this in an app?

## Use Case

Here's a list of quasi-JTBDs for the app:

- As a manga reader, I want to create a list of titles I have read so I don't buy the same thing twice.
- " ", I want to create a list of titles I intend to read so I can remember what to buy at the store.
- " ", I want to be able to add titles I already own by taking a picture of covers.

A month or so ago, my manager hipped me to [Bolt.new](https://bolt.new), which was interesting, but a bit lacking in features. I then went on to find out about [Lovable.dev](https://lovable.dev) somewhere, probably HN, and really took to it. It does a fine job of executing more or less what I want, despite a few hiccoughs (it claims it made design updates based on a Figma screenshot I gave it, but I see through the deception). The five prompts per day limit is a bit frustrating, but I learned to bundle a dozen or so prompts together, which it doesn't mind. Eventually I just started to pay for the Starter plan, which is where I am now.

## Manga APIs

It's been more of a chore than I had anticipated to find an API that will play ball with my use case requirements and scale appropriately. It seems simple enough, but I can't seem to find an API that will just return:

- Title
- Volume no. (can be part of Title, but not preferred)
- Author(s)
- Publication date
- Page count (not strictly a requirement, but a nice-to-have)

I did about half an hour's worth of competitor research, and found none in this specific space. This is because I do not at all intend to use this as a manga reader, which seems to be the most popular function of manga-centric apps. I just want a Rolodex. (Ths is one of the rare times "You are not the user" doesn't apply — L'Utilisateur, c'est moi, and probably the only one, and that's fine).

### 1: OpenLibrary

This is the one I started with, and it'd be appropriate for a more general, book-centric app, but it returns non-manga titles on search. From what I can discern, OpenLibrary does not use any sort of tagging system, so I can't pre-filter for non-manga titles. At least I don't think I can. Might be worth a revisit. It does display volume numbers, but they are part of the `title`, which is... fine. Better than nothing.

### 2: AniList

This was great! At first. Lovable integrated this one the quickest, and with the fewest number of errors. The problem is AniList is series-level, so it doesn't keep track of volume numbers (best I can tell). That is, if you search for 'sakamoto days,' it just returns that as a single result, whereas I want results for each volume. If AniList kept track of volumes (or if it does, if I could just use it correctly), this would be the way to go. Alack alas.

### 3: MangaDex

This was the most finicky one by far, and the one I burned through a good deal of my monthly prompts with. Aside from endless CORS-based errors, returning an actual cover image was a chore.

![Placeholder cover images](2025-3-10-mangadex-placeholder.png)
*Placeholder cover images from MangaDex*

Apparently this is because of MangaDex's policy on serving cover images via their API. To access actual cover images, I need to proxy the image requests through my server, which I let Lovable handle, because I don't know what that means, really.
Edit: Yeah, this was insurmountable, at least for my tech intellect.

### 4. Jikan

This one had superior API documentation, and I used ChatGPT 4.5 to build a small React component to test it out. I appreciated how clean the code was. Unsure how *good* it is, but it was readable. The same issue as before came up, though: No specific key for volume number. That is, it's more series-based, like AniList. The JSON, however, does contain a volume key-value pair for the number of volumes (AniList might have this too, didn't check), so I decided to change how the user adds an item to the 'Owned' or 'Wishlist' group: Return the result in a card as normal, but on tap, it expands to show a checkbox stack. Users can select which volumes they have / want, and then tap to add them to whichever list.

This is fine for a title like *Akira,* which was collected into 6 単行本, but what about a series like *One Piece*, which has more than 100 volumes? For that matter, what about titles that appear in individual volumes as well as tankobon, such as *FLCL*? I have the omnibus, but it also came out in two volumes. Jikan returns two different results for `FLCL`, which is even more confusing.

![FLCL results](2025-3-10-flcl-manga.png)

It's a mess, but the job here is to make sense of the mess, or at least try.
