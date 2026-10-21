package com.cntrd.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Hosts the CNTRD web app in a full-screen WebView.
 *
 * Everything the user interacts with (auth, feed, plays, messages, push)
 * is served from the site. This Activity's job is to make that not feel
 * like a browser: a branded launch screen, a branded failure screen
 * instead of Chrome's error page, and cached content when the network
 * drops.
 */
public class MainActivity extends Activity {

    private static final String HOST      = "cntrd-618y.onrender.com";
    private static final String START_URL = "https://" + HOST + "/v2/feed";

    private static final int REQ_FILE_CHOOSER = 100;
    private static final int REQ_CAMERA_PERM  = 101;

    // Mirrors design-system/src/tokens.js so the native chrome and the
    // web app read as one product.
    private static final int PAPER   = 0xFFF4EDE0;
    private static final int SURFACE = 0xFFEBE3D2;
    private static final int INK     = 0xFF1A1612;
    private static final int INK_DIM = 0xFF8A837B;
    private static final int ACCENT  = 0xFFC84C1E;

    private WebView web;
    private View errorView;
    private TextView errorDetail;
    private FrameLayout root;

    private ValueCallback<Uri[]> pendingFileCallback;
    private PermissionRequest pendingWebPermRequest;

    /** True once the main frame has failed; cleared on a successful load. */
    private boolean showingError = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Drop the splash drawable so it isn't retained behind the WebView.
        setTheme(R.style.Theme_CNTRD);
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(PAPER);
        getWindow().setNavigationBarColor(PAPER);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        root.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        web = new WebView(this);
        web.setBackgroundColor(PAPER);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        applyCacheMode(s);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri url = req.getUrl();
                String host = url.getHost();
                if (host != null && host.equalsIgnoreCase(HOST)) {
                    return false; // stay in the app
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) { /* no handler for this scheme */ }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // A load that completes clears any error state. Guard on
                // showingError so we don't thrash the view hierarchy on
                // every in-app navigation.
                if (showingError) hideError();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                // Fires for every failed subresource too — only a failed
                // main frame means the app itself couldn't load.
                if (req == null || !req.isForMainFrame()) return;
                showError(isOnline()
                        ? "CNTRD isn't responding right now. It may be waking up — give it a moment."
                        : "You're offline. Reconnect and we'll pick up where you left off.");
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse resp) {
                if (req == null || !req.isForMainFrame()) return;
                int code = resp != null ? resp.getStatusCode() : 0;
                // 5xx means the server is up but unhappy; 4xx on the main
                // frame usually means a bad deep link.
                if (code >= 500) {
                    showError("CNTRD hit a server error (HTTP " + code + "). Try again in a moment.");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                String[] resources = request.getResources();
                boolean needsCapture = false;
                for (String r : resources) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)
                            || PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                        needsCapture = true;
                        break;
                    }
                }
                if (needsCapture && checkSelfPermission(Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED) {
                    pendingWebPermRequest = request;
                    requestPermissions(new String[]{
                            Manifest.permission.CAMERA,
                            Manifest.permission.RECORD_AUDIO
                    }, REQ_CAMERA_PERM);
                    return;
                }
                request.grant(resources);
            }

            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = filePathCallback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), REQ_FILE_CHOOSER);
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState == null) {
            web.loadUrl(START_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    // ── Offline / failure screen ────────────────────────────────────────

    /**
     * Branded stand-in for Chrome's error page. Built in code rather than
     * XML so the app keeps zero androidx dependencies and the APK stays
     * under 2 MB.
     */
    private View buildErrorView() {
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        col.setBackgroundColor(PAPER);
        int pad = dp(32);
        col.setPadding(pad, pad, pad, pad);

        // "cntrd." with the terracotta period, same as the web wordmark.
        TextView mark = new TextView(this);
        SpannableString wordmark = new SpannableString("cntrd.");
        wordmark.setSpan(new ForegroundColorSpan(ACCENT), 5, 6, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        mark.setText(wordmark);
        mark.setTextColor(INK);
        mark.setTypeface(Typeface.SERIF, Typeface.BOLD);
        mark.setTextSize(TypedValue.COMPLEX_UNIT_SP, 38);
        mark.setGravity(Gravity.CENTER);
        col.addView(mark);

        TextView kicker = new TextView(this);
        kicker.setText("CAN’T REACH CNTRD");
        kicker.setTextColor(ACCENT);
        kicker.setTypeface(Typeface.MONOSPACE);
        kicker.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        kicker.setLetterSpacing(0.2f);
        kicker.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams kp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        kp.topMargin = dp(24);
        col.addView(kicker, kp);

        errorDetail = new TextView(this);
        errorDetail.setTextColor(INK_DIM);
        errorDetail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        errorDetail.setGravity(Gravity.CENTER);
        errorDetail.setLineSpacing(dp(4), 1f);
        LinearLayout.LayoutParams dpLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dpLp.topMargin = dp(10);
        col.addView(errorDetail, dpLp);

        Button retry = new Button(this);
        retry.setText("RETRY");
        retry.setAllCaps(true);
        retry.setTextColor(PAPER);
        retry.setBackgroundColor(ACCENT);
        retry.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        retry.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        retry.setLetterSpacing(0.2f);
        retry.setPadding(dp(28), dp(14), dp(28), dp(14));
        retry.setStateListAnimator(null);
        retry.setOnClickListener(v -> {
            hideError();
            applyCacheMode(web.getSettings());
            // reload() on a failed page can replay the error; go straight
            // back to the start URL instead.
            web.loadUrl(START_URL);
        });
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rp.topMargin = dp(28);
        col.addView(retry, rp);

        return col;
    }

    private void showError(String detail) {
        showingError = true;
        if (errorDetail != null) errorDetail.setText(detail);
        if (errorView != null) errorView.setVisibility(View.VISIBLE);
        if (web != null) web.setVisibility(View.INVISIBLE);
    }

    private void hideError() {
        showingError = false;
        if (errorView != null) errorView.setVisibility(View.GONE);
        if (web != null) web.setVisibility(View.VISIBLE);
    }

    // ── Connectivity ────────────────────────────────────────────────────

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;             // can't tell — assume yes
        Network active = cm.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(active);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    /**
     * Online we want fresh content; offline we'd rather render the last
     * feed the user saw than show nothing at all.
     */
    private void applyCacheMode(WebSettings s) {
        s.setCacheMode(isOnline()
                ? WebSettings.LOAD_DEFAULT
                : WebSettings.LOAD_CACHE_ELSE_NETWORK);
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    // ── Lifecycle plumbing ──────────────────────────────────────────────

    @Override
    protected void onResume() {
        super.onResume();
        // Coming back from Settings/airplane mode should re-evaluate how
        // aggressively we lean on the cache.
        if (web != null) applyCacheMode(web.getSettings());
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && !showingError && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER && pendingFileCallback != null) {
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int i = 0; i < n; i++) {
                        result[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[]{ data.getData() };
                }
            }
            pendingFileCallback.onReceiveValue(result);
            pendingFileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA_PERM && pendingWebPermRequest != null) {
            boolean allGranted = grantResults.length > 0;
            for (int r : grantResults) {
                if (r != PackageManager.PERMISSION_GRANTED) { allGranted = false; break; }
            }
            if (allGranted) {
                pendingWebPermRequest.grant(pendingWebPermRequest.getResources());
            } else {
                pendingWebPermRequest.deny();
            }
            pendingWebPermRequest = null;
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            if (root != null) root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
