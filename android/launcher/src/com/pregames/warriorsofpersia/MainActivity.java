package com.pregames.warriorsofpersia;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * WebView shell for Warriors of Persia.
 *
 * The game is a bundled web app, but the 4K/8K PBR maps are far too big to ship
 * inside the APK: the base build carries a lossless 2K texture set and the HQ
 * pack is downloaded on demand from the release page. That needs two things the
 * old launcher did not have:
 *
 *  1. a real web origin, so fetch() of pack files is allowed (file:// cannot),
 *     implemented by serving both APK assets and the downloaded pack through
 *     shouldInterceptRequest() on a private https host;
 *  2. an internet permission plus a small download manager exposed to JS as
 *     `window.WoPPack`.
 */
public class MainActivity extends Activity {

    private static final String ORIGIN = "https://wop.local";
    private static final String TAG = "WoP";
    private static final String PACK_DIR = "pack";

    private WebView webView;
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private volatile HttpURLConnection activeConnection;
    private PackConfig config;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.BLACK);
        root.addView(webView);
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        config = PackConfig.load(getAssets());
        webView.addJavascriptInterface(new PackBridge(), "WoPPack");
        webView.setWebViewClient(new ProbeClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                // Forwarded to logcat so CI can assert that the page loaded without
                // JavaScript errors and that the pack installer mounted.
                Log.i(TAG, "console " + message.messageLevel() + ": " + message.message());
                return true;
            }
        });
        webView.loadUrl(ORIGIN + "/index.html");
        maybeAutostartPack(getIntent());
    }

    /**
     * Optional CI hook: `adb shell am start … --es wop_open_bag keep` opens the
     * equipment/bag screen so the emulator job can screenshot it. The page needs
     * a while to build the hero and the HUD, so retry until the hook exists.
     */
    /** Optional CI hook: `--es wop_gear hammer` puts a weapon + shield on Mia. */
    private void maybeShowGear(Intent intent) {
        if (intent == null || !intent.hasExtra("wop_gear")) return;
        final String kind = intent.getStringExtra("wop_gear");
        final int[] tries = {0};
        final Runnable[] attempt = new Runnable[1];
        attempt[0] = new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                tries[0]++;
                webView.evaluateJavascript(
                        "(window.__wopBag && window.__wopBag.showcase) ? JSON.stringify(window.__wopBag.showcase('" + kind + "')) : 'wait'",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                Log.i(TAG, "gear-show " + tries[0] + " -> " + value);
                                if (value != null && value.contains("weapon")) {
                                    Log.i(TAG, "gear-shown true");
                                } else if (tries[0] < 25) {
                                    new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 3000);
                                }
                            }
                        });
            }
        };
        new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 6000);
    }

    /**
     * Optional CI hook: `--es wop_walk 6` holds the stick forward for a few
     * seconds and logs how the hand and the worn sword move, so the emulator
     * job can prove the walk cycle advances and the sword stays in the fist.
     */
    private void maybeWalkTest(Intent intent) {
        if (intent == null || !intent.hasExtra("wop_walk")) return;
        final String seconds = intent.getStringExtra("wop_walk");
        final int[] tries = {0};
        final Runnable[] attempt = new Runnable[1];
        attempt[0] = new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                tries[0]++;
                webView.evaluateJavascript(
                        "window.__wopBag && window.__wopBag.walkStart ? (window.__wopBag.walkStart(" + (seconds == null ? 6 : seconds) + ") ? 'true' : 'false') : 'wait'",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                Log.i(TAG, "walk-start " + tries[0] + " -> " + value);
                                if (value != null && value.contains("true")) {
                                    pollWalkResult(0);
                                } else if (tries[0] < 25) {
                                    new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 3000);
                                }
                            }
                        });
            }
        };
        new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 7000);
    }

    private void pollWalkResult(final int round) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__wopBag && window.__wopBag.walkResult ? (window.__wopBag.walkResult() || '') : ''",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value != null && value.contains("relSpread")) {
                            Log.i(TAG, "walk-probe " + value);
                        } else if (round < 20) {
                            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                                @Override
                                public void run() { pollWalkResult(round + 1); }
                            }, 1000);
                        } else {
                            Log.i(TAG, "walk-probe missing");
                        }
                    }
                });
    }

    /** Optional CI hook: `--es wop_shopart 1` loads every shop image in the APK. */
    private void maybeShopArtTest(Intent intent) {
        if (intent == null || !intent.hasExtra("wop_shopart")) return;
        final int[] tries = {0};
        final Runnable[] attempt = new Runnable[1];
        attempt[0] = new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                tries[0]++;
                webView.evaluateJavascript(
                        "window.__wopBag && window.__wopBag.shopArtStart ? String(window.__wopBag.shopArtStart()) : 'wait'",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                Log.i(TAG, "shop-art-start " + tries[0] + " -> " + value);
                                if (value != null && !value.contains("wait")) {
                                    pollShopArt(0);
                                } else if (tries[0] < 25) {
                                    new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 3000);
                                }
                            }
                        });
            }
        };
        new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 6000);
    }

    private void pollShopArt(final int round) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.__wopBag && window.__wopBag.shopArtResult ? (window.__wopBag.shopArtResult() || '') : ''",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value != null && value.contains("failed")) {
                            Log.i(TAG, "shop-art " + value);
                        } else if (round < 20) {
                            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                                @Override
                                public void run() { pollShopArt(round + 1); }
                            }, 1000);
                        } else {
                            Log.i(TAG, "shop-art missing");
                        }
                    }
                });
    }

    private void maybeOpenBag(Intent intent) {
        if (intent == null || !intent.hasExtra("wop_open_bag")) return;
        final int[] tries = {0};
        final Runnable[] attempt = new Runnable[1];
        attempt[0] = new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                tries[0]++;
                webView.evaluateJavascript(
                        "window.__wopBag && window.__wopBag.open ? (window.__wopBag.open() ? 'true' : 'false') : 'wait'",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                Log.i(TAG, "bag-open " + tries[0] + " -> " + value);
                                if (value != null && value.contains("true")) {
                                    // Measure after the next frame: a panel that was
                                    // just switched from display:none can still report
                                    // 0x0 on the same tick.
                                    new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                                        @Override
                                        public void run() {
                                            if (webView == null) return;
                                            webView.evaluateJavascript(
                                                    "JSON.stringify(window.__wopBag.rects())",
                                                    new ValueCallback<String>() {
                                                        @Override
                                                        public void onReceiveValue(String rects) {
                                                            Log.i(TAG, "bag-rects " + rects);
                                                        }
                                                    });
                                        }
                                    }, 1500);
                                }
                                if (value != null && value.contains("true")) {
                                    Log.i(TAG, "bag-opened true");
                                } else if (tries[0] < 25) {
                                    new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 3000);
                                }
                            }
                        });
            }
        };
        new Handler(Looper.getMainLooper()).postDelayed(attempt[0], 6000);
    }

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 19) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        cancelDownload();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    // Load probe: CI (and `adb logcat`) can see whether the shell really booted
    // the game and whether the graphics pack is installed.
    // ------------------------------------------------------------------
    private final class ProbeClient extends LocalOriginClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            Log.i(TAG, "page finished " + url);
            probe(1500);
            probe(8000);
            probe(15000);
            probe(25000);
            maybeOpenBag(getIntent());
            maybeShowGear(getIntent());
            maybeWalkTest(getIntent());
            maybeShopArtTest(getIntent());
        }
    }

    private void probe(long delayMs) {
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                if (webView == null) return;
                webView.evaluateJavascript(
                        "(function(){try{var c=document.querySelector('canvas');var r={canvas:c?[c.width,c.height]:null,"
                        + "gl:!!(c&&(c.getContext('webgl2')||c.getContext('webgl'))),"
                        + "pack:!!(window.WoPPack&&window.WoPPack.status),ui:!!window.__wopPack,"
                        + "spells:!!window.__wopSpells,"
                        + "spellIcons:window.__wopSpells?window.__wopSpells.icons():-1,"
                        + "spellMotion:window.__wopSpells?window.__wopSpells.selftest():null,"
                        + "bag:!!window.__wopBag,"
                        + "bagTest:window.__wopBag?window.__wopBag.selftest():null,"
                        + "heroGear:window.__wopBag?window.__wopBag.heroGear():null,"
                        + "gearTest:window.__wopBag?window.__wopBag.gearSelftest():null,"
                        + "weaponFamilies:window.__wopBag?window.__wopBag.weaponFamilies():null,"
                        + "status:window.WoPPack?window.WoPPack.status():null,origin:location.origin};"
                        + "return JSON.stringify(r);}catch(e){return 'probe-error:'+e.message;}})()",
                        new ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                Log.i(TAG, "probe " + value);
                            }
                        });
            }
        }, delayMs);
    }

    private void maybeAutostartPack(Intent intent) {
        final String tier = intent == null ? null : intent.getStringExtra("wop_pack_autostart");
        if (tier == null) return;
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                Log.i(TAG, "autostart pack " + tier);
                download(tier);
            }
        }, 8000);
    }

    // ------------------------------------------------------------------
    // Local origin: APK assets at /, downloaded pack at /pack/
    // ------------------------------------------------------------------
    private class LocalOriginClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null || !"wop.local".equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            if (path.startsWith("/pack/")) {
                return servePack(path.substring("/pack/".length()));
            }
            return serveAsset(path.substring(1));
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (uri == null || !"wop.local".equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
            if (path.startsWith("/pack/")) return servePack(path.substring("/pack/".length()));
            return serveAsset(path.substring(1));
        }
    }

    private WebResourceResponse serveAsset(String name) {
        try {
            BufferedInputStream stream = new BufferedInputStream(getAssets().open(name));
            return response(mimeFor(name, stream), stream, name.endsWith(".html"));
        } catch (IOException missing) {
            return notFound(name);
        }
    }

    /**
     * The shop portraits and book covers are WebP data stored under `.png`
     * names (the container APK ships them that way, lossless, ~1.2 MB each).
     * Serving them as `image/png` makes the WebView drop the picture, which is
     * why those shop cards looked empty; the type has to match the bytes.
     */
    private static String mimeFor(String name, BufferedInputStream stream) {
        try {
            stream.mark(16);
            byte[] head = new byte[12];
            int count = stream.read(head, 0, head.length);
            stream.reset();
            if (count >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                    && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
                return "image/webp";
            }
            if (count >= 3 && (head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8) return "image/jpeg";
            if (count >= 4 && (head[0] & 0xff) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
                return "image/png";
            }
        } catch (IOException ignored) {
            // Fall back to the extension when the stream cannot be peeked.
        }
        return mimeOf(name);
    }

    private WebResourceResponse servePack(String name) {
        if (name.isEmpty() || name.contains("..")) return notFound(name);
        File file = new File(packDir(), name);
        if (!file.isFile()) return notFound(name);
        try {
            BufferedInputStream stream = new BufferedInputStream(new FileInputStream(file));
            return response(mimeFor(name, stream), stream, false);
        } catch (IOException error) {
            return notFound(name);
        }
    }

    private WebResourceResponse response(String mime, InputStream stream, boolean noStore) {
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", ORIGIN);
        headers.put("Cache-Control", noStore ? "no-store" : "public, max-age=31536000");
        return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, stream);
    }

    private WebResourceResponse notFound(String name) {
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", ORIGIN);
        headers.put("Cache-Control", "no-store");
        byte[] body = ("missing: " + name).getBytes();
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers,
                new java.io.ByteArrayInputStream(body));
    }

    private static String mimeOf(String name) {
        String lower = name.toLowerCase(Locale.US);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".glb")) return "model/gltf-binary";
        if (lower.endsWith(".gltf")) return "model/gltf+json";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------
    // Graphics pack storage
    // ------------------------------------------------------------------
    private File packDir() {
        return new File(getFilesDir(), PACK_DIR);
    }

    private File packMeta() {
        return new File(getFilesDir(), "pack.json");
    }

    private String installedTier() {
        try {
            File meta = packMeta();
            if (!meta.isFile() || !packDir().isDirectory()) return null;
            JSONObject json = new JSONObject(readText(new FileInputStream(meta)));
            String tier = json.optString("tier", "");
            return tier.isEmpty() ? null : tier;
        } catch (Exception error) {
            return null;
        }
    }

    private boolean packComplete() {
        String tier = installedTier();
        if (tier == null) return false;
        Entry entry = config.find(tier);
        File[] files = packDir().listFiles();
        if (entry == null || files == null) return files != null && files.length >= 15;
        return files.length >= entry.maps;
    }

    private static String readText(InputStream stream) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, "UTF-8"));
        StringBuilder text = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) text.append(line).append('\n');
        reader.close();
        return text.toString();
    }

    // ------------------------------------------------------------------
    // JS bridge
    // ------------------------------------------------------------------
    private final class PackBridge {
        @JavascriptInterface
        public String status() {
            try {
                JSONObject json = new JSONObject();
                json.put("installed", packComplete());
                json.put("tier", installedTier());
                json.put("downloading", downloading.get());
                json.put("packBytes", dirSize(packDir()));
                JSONArray packs = new JSONArray();
                for (Entry entry : config.list()) {
                    JSONObject item = new JSONObject();
                    item.put("tier", entry.tier);
                    item.put("label", entry.label);
                    item.put("detail", entry.detail);
                    item.put("bytes", entry.bytes);
                    item.put("url", entry.url);
                    item.put("maps", entry.maps);
                    packs.put(item);
                }
                json.put("packs", packs);
                return json.toString();
            } catch (Exception error) {
                return "{\"installed\":false,\"tier\":null,\"packs\":[]}";
            }
        }

        @JavascriptInterface
        public void start(String tier) {
            download(tier);
        }

        @JavascriptInterface
        public void cancel() {
            cancelDownload();
        }

        @JavascriptInterface
        public void remove() {
            if (downloading.get()) return;
            deleteTree(packDir());
            //noinspection ResultOfMethodCallIgnored
            packMeta().delete();
            notifyJs("{\"state\":\"removed\"}");
        }
    }

    private static long dirSize(File dir) {
        long total = 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;
        for (File file : files) total += file.length();
        return total;
    }

    private static void deleteTree(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) deleteTree(file);
                else {
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                }
            }
        }
        //noinspection ResultOfMethodCallIgnored
        dir.delete();
    }

    private void notifyJs(final String payload) {
        Log.i(TAG, "pack " + payload);
        if (webView == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                webView.evaluateJavascript(
                        "window.__wopPackProgress && window.__wopPackProgress(" + payload + ");", null);
            }
        });
    }

    private void cancelDownload() {
        HttpURLConnection connection = activeConnection;
        if (connection != null) connection.disconnect();
        downloading.set(false);
    }

    private void download(final String tier) {
        final Entry entry = config.find(tier);
        if (entry == null) {
            notifyJs("{\"state\":\"error\",\"message\":\"unknown pack\"}");
            return;
        }
        if (!downloading.compareAndSet(false, true)) return;
        notifyJs("{\"state\":\"start\",\"tier\":\"" + entry.tier + "\",\"total\":" + entry.bytes + "}");

        Thread worker = new Thread(new Runnable() {
            @Override
            public void run() {
                File temp = new File(getFilesDir(), "pack-download.zip");
                File stage = new File(getFilesDir(), "pack-stage");
                try {
                    long received = fetch(entry.url, temp, entry.bytes);
                    if (!downloading.get()) throw new IOException("cancelled");
                    String digest = sha256(temp);
                    if (!digest.equalsIgnoreCase(entry.sha256)) {
                        throw new IOException("checksum mismatch");
                    }
                    deleteTree(stage);
                    //noinspection ResultOfMethodCallIgnored
                    stage.mkdirs();
                    unzip(temp, stage);
                    if (stage.listFiles() == null || stage.listFiles().length < entry.maps) {
                        throw new IOException("incomplete pack");
                    }
                    deleteTree(packDir());
                    if (!stage.renameTo(packDir())) throw new IOException("could not install pack");
                    JSONObject meta = new JSONObject();
                    meta.put("tier", entry.tier);
                    meta.put("bytes", received);
                    meta.put("sha256", digest);
                    FileOutputStream out = new FileOutputStream(packMeta());
                    out.write(meta.toString().getBytes("UTF-8"));
                    out.close();
                    //noinspection ResultOfMethodCallIgnored
                    temp.delete();
                    downloading.set(false);
                    notifyJs("{\"state\":\"done\",\"tier\":\"" + entry.tier + "\",\"bytes\":" + received + "}");
                } catch (Exception error) {
                    boolean cancelled = !downloading.get();
                    downloading.set(false);
                    //noinspection ResultOfMethodCallIgnored
                    temp.delete();
                    deleteTree(stage);
                    notifyJs("{\"state\":\"" + (cancelled ? "cancelled" : "error") + "\",\"message\":\""
                            + String.valueOf(error.getMessage()).replace('"', ' ') + "\"}");
                }
            }
        }, "wop-pack-download");
        worker.setPriority(Thread.MIN_PRIORITY);
        worker.start();
    }

    private long fetch(String url, File target, long expected) throws IOException {
        HttpURLConnection connection = null;
        InputStream input = null;
        OutputStream output = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("Accept", "application/zip");
            activeConnection = connection;
            int status = connection.getResponseCode();
            if (status != 200) throw new IOException("HTTP " + status);
            long total = expected > 0 ? expected : connection.getContentLength();
            input = connection.getInputStream();
            output = new FileOutputStream(target);
            byte[] buffer = new byte[131072];
            long received = 0;
            long lastReport = 0;
            int read;
            while ((read = input.read(buffer)) > 0) {
                if (!downloading.get()) throw new IOException("cancelled");
                output.write(buffer, 0, read);
                received += read;
                long now = System.currentTimeMillis();
                if (now - lastReport > 250) {
                    lastReport = now;
                    int percent = total > 0 ? (int) (received * 100 / total) : 0;
                    notifyJs("{\"state\":\"progress\",\"received\":" + received + ",\"total\":" + total
                            + ",\"percent\":" + percent + "}");
                }
            }
            return received;
        } finally {
            activeConnection = null;
            if (output != null) output.close();
            if (input != null) input.close();
            if (connection != null) connection.disconnect();
        }
    }

    private static void unzip(File archive, File target) throws IOException {
        ZipInputStream zip = new ZipInputStream(new FileInputStream(archive));
        ZipEntry entry;
        byte[] buffer = new byte[131072];
        while ((entry = zip.getNextEntry()) != null) {
            if (entry.isDirectory()) continue;
            String name = entry.getName();
            if (name.contains("/")) name = name.substring(name.lastIndexOf('/') + 1);
            if (name.startsWith(".")) continue;
            File out = new File(target, name);
            FileOutputStream stream = new FileOutputStream(out);
            int read;
            while ((read = zip.read(buffer)) > 0) stream.write(buffer, 0, read);
            stream.close();
            zip.closeEntry();
        }
        zip.close();
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        FileInputStream stream = new FileInputStream(file);
        byte[] buffer = new byte[131072];
        int read;
        while ((read = stream.read(buffer)) > 0) digest.update(buffer, 0, read);
        stream.close();
        StringBuilder text = new StringBuilder();
        for (byte value : digest.digest()) text.append(String.format(Locale.US, "%02x", value));
        return text.toString();
    }

    // ------------------------------------------------------------------
    // assets/pack-config.json
    // ------------------------------------------------------------------
    static final class PackConfig {
        final JSONArray entries;

        private PackConfig(JSONArray entries) {
            this.entries = entries;
        }

        static PackConfig load(AssetManager assets) {
            try {
                JSONObject root = new JSONObject(readText(assets.open("pack-config.json")));
                JSONArray packs = root.optJSONArray("packs");
                return new PackConfig(packs == null ? new JSONArray() : packs);
            } catch (Exception error) {
                return new PackConfig(new JSONArray());
            }
        }

        java.util.List<Entry> list() {
            java.util.List<Entry> result = new java.util.ArrayList<Entry>();
            for (int index = 0; index < entries.length(); index++) {
                JSONObject item = entries.optJSONObject(index);
                if (item == null) continue;
                Entry entry = new Entry();
                entry.tier = item.optString("tier");
                entry.label = item.optString("label", entry.tier);
                entry.detail = item.optString("detail", "");
                entry.bytes = item.optLong("bytes", 0);
                entry.sha256 = item.optString("sha256", "");
                entry.url = item.optString("url", "");
                entry.maps = item.optInt("maps", 15);
                result.add(entry);
            }
            return result;
        }

        Entry find(String tier) {
            for (int index = 0; index < entries.length(); index++) {
                JSONObject item = entries.optJSONObject(index);
                if (item == null) continue;
                if (tier.equals(item.optString("tier"))) {
                    Entry entry = new Entry();
                    entry.tier = item.optString("tier");
                    entry.label = item.optString("label", entry.tier);
                    entry.detail = item.optString("detail", "");
                    entry.bytes = item.optLong("bytes", 0);
                    entry.sha256 = item.optString("sha256", "");
                    entry.url = item.optString("url", "");
                    entry.maps = item.optInt("maps", 15);
                    return entry;
                }
            }
            return null;
        }
    }

    static final class Entry {
        String tier = "";
        String label = "";
        String detail = "";
        long bytes = 0;
        String sha256 = "";
        String url = "";
        int maps = 15;
    }
}
