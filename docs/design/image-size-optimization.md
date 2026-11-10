# Approved merchant-image packaging optimization

The user authorized size reduction with minimal quality damage on this change. Source portraits and item PNGs remain untouched. Neither dimensions, scene textures, renderer settings nor the native launcher icon are reduced.

## Measured results

`artifacts/quality/merchant-image-optimization.json` records source/output SHA256, dimensions, quality, PSNR and 8×8 block SSIM for all 45 merchant PNGs.

- Original image payload: 117,636,030 bytes.
- Optimized image payload: 51,801,190 bytes (55.96% smaller).
- 38 images use lossless WebP (pixel-identical).
- 5 images use WebP quality 98; 2 use quality 95. All pass PSNR ≥40 dB and mean block SSIM ≥0.99. Lowest measured values: 41.4025 dB and 0.990155.
- All 45 retain their exact original dimensions and alpha. Source hashes verified unchanged.
- Estimated APK size with equivalent contents: 80,762,254 bytes, compared with the audited 146,622,778-byte v1.0.11. This estimate replaces ZIP-deflated image payload sizes; it is NOT a newly built or device-tested APK. Signing/container overhead can alter the final size slightly.

## Build integration

Install Python dependencies `Pillow numpy` alongside the existing signing dependencies. `Tools/build_latest_preview_apk.py` now uses the approved policy for merchant PNGs only by default; `--original-merchant-images` restores original-byte packaging.

`Tools/optimize_merchant_images.py` can run independently to measure images without building, signing or publishing an app. Encoding cache is under ignored `build/optimized-images`. A checksum validates cached payloads. If a lossy candidate fails thresholds, lossless is tried; if compression is larger, original bytes are retained. ICC-profiled and animated images are left untouched.

WebP payloads intentionally retain the existing asset URLs, including `.png` suffixes, inside the offline WebView APK: image decoders sniff the file signature. This preserves all dynamic item paths and existing inventory URLs without fragile text rewrites. Original web-preview resources are still original PNGs. On-device rendering of the optimized package still needs checking when a new APK is explicitly requested.

Validation: optimizer tests cover no resizing, unchanged alpha and originals, structural/pixel thresholds, cache integrity and color-profile preservation. No new APK was built for this optimization task.
