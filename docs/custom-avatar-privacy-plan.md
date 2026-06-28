# Custom Avatar Privacy Plan

Custom avatars generated from a player's photo are personal data. This is a plan only; do not add upload endpoints yet.

## Required Consent

- The upload form must request explicit consent before a photo is sent.
- The UI must explain that the photo is used only to create the avatar.
- The player must confirm they own the photo rights and have permission from the person shown.

## Restrictions

- No photos of other people without permission.
- No celebrity photos.
- No photos of minors unless a lawful guardian workflow exists.
- No hateful, sexual, exploitative, or otherwise disallowed imagery.

## Storage And Deletion

- The original uploaded photo should be deleted after a short processing window.
- The generated avatar may be stored as a cosmetic account asset.
- Users must be able to request deletion of the generated avatar.
- Logs must not include raw image data, private URLs, or identity documents.

## Moderation

- Generated avatars require manual approval before public use.
- Rejected avatars should show a clear, non-sensitive reason.
- Moderation decisions and deletion requests need an audit trail that does not expose the original photo.

## Implementation Boundary

Do not implement upload, generation, or payment endpoints until the privacy, consent, moderation, and deletion flows are designed and reviewed.
