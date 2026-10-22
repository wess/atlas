# @wess/atlas/social

Small, storage-independent rules for public profiles, content visibility, photo
validation, and moderated comments. Applications own their tables, routes, and
review queues. A private profile or item is visible to its owner; blocked viewers
cannot see public items. `imageType` accepts JPEG, PNG, or WebP signatures.

Use `canView`, `canModerate`, `imageType`, and `commentText` from `@wess/atlas/social`.
Do not treat `imageType` as image transcoding or metadata removal.
