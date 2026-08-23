package com.cntrd.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Thin wrapper around a full-screen WebView pointed at the CNTRD v2 app.
 * Everything else (auth, feed, plays, messages, push, service worker) lives
 * on the server — this Activity just gives Android a launcher icon and a
 * frame to host the site.
 */
public class MainActivity extends Activity {

    // Point the app at /v2/feed — the new experience. The site's own
    // sign-in redirect handles the "not authed yet" case gracefully.
    private static final String START_URL = "https://cntrd-618y.onrender.com/v2/feed";

    private static final int REQ_FILE_CHOOSER = 100;
    private static final int REQ_CAMERA_PERM  = 101;

    private WebView web;
    private ValueCallback<Uri[]> pendingFileCallback;
    private PermissionRequest pendingWebPermRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full-bleed window so the WebView can respect the site's
        // safe-area handling on notched devices.
        getWindow().setStatusBarColor(Color.parseColor("#F4EDE0"));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        FrameLayout frame = new FrameLayout(this);
        frame.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        web = new WebView(this);
        frame.addView(web);
        setContentView(frame);

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
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Keep in-app navigation inside the WebView; external links bounce
        // out to the OS browser.
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri url = req.getUrl();
                String host = url.getHost();
                if (host != null && host.equalsIgnoreCase("cntrd-618y.onrender.com")) {
                    return false; // stay in the app
                }
                Intent i = new Intent(Intent.ACTION_VIEW, url);
                startActivity(i);
                return true;
            }
        });

        // Grant CAMERA + MIC to the page when it asks (Plays creator),
        // and route <input type="file"> picks through the system picker.
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                String[] resources = request.getResources();
                boolean needsCamera = false;
                for (String r : resources) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)
                            || PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                        needsCamera = true;
                        break;
                    }
                }
                if (needsCamera && checkSelfPermission(Manifest.permission.CAMERA)
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
                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = filePathCallback;

                Intent chooser = fileChooserParams.createIntent();
                try {
                    startActivityForResult(chooser, REQ_FILE_CHOOSER);
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

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Back button navigates WebView history; only exit when we're at
        // the start URL.
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
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
            boolean allGranted = true;
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
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
