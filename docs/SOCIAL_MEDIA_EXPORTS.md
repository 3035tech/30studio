# Social media export presets

`CONTENT_MEDIA_EXPORTS` defines the canvas used by generated text cards and carousel pages. It is a design preset, not a promise that every platform's publishing API accepts that media type.

| Platform | Preset | Evidence and handling |
|---|---:|---|
| Instagram | 1080 × 1350 | 4:5, within the publisher's 4:5–1.91:1 ratio guard and 1440 px width ceiling. Before publication, the private asset is converted to JPEG, rotated, color-normalized, resized to the API width limit, and bounded to 8 MiB. |
| TikTok | 1080 × 1080 | Conservative square canvas within the official photo-post maximum of 1080p. The source image is WebP; TikTok's photo API accepts WebP or JPEG and allows up to 20 MB per image. The product worker's 10 MiB cap is stricter. |
| LinkedIn | 1080 × 1080 | This preset is under the Images API's 36,152,320-pixel limit. The current LinkedIn publisher supports text only, so this does not represent an enabled image-publishing path. |
| Facebook | 1080 × 1080 | Design preset only. The current Facebook publisher supports text only; this preset has not been certified against a photo-publishing flow. |
| X | 1600 × 900 | Design preset only; no image-publishing adapter is currently enabled. |
| YouTube | 1280 × 720 | Design preset only; no image-publishing adapter is currently enabled. |
| Threads | 1080 × 1350 | Design preset only; the current Threads publisher supports text only. |
| Pinterest | 1000 × 1500 | Design preset only; no image-publishing adapter is currently enabled. |

Text-card composition scales against the shorter canvas dimension and lays out text inside the actual canvas, so horizontal formats no longer clip copy below the image. When adding a publishing adapter, confirm its current format, ratio, dimensions, file-size, and account-specific restrictions before declaring that it supports generated media.

## Official references

- [Meta Instagram media publishing reference](https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user/media/)
- [TikTok photo-post reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post)
- [TikTok media transfer guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide)
- [LinkedIn Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
