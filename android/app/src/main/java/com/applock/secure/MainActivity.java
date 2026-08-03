package com.applock.secure;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startNativeAppLockService();
        handleLockIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLockIntent(intent);
    }

    private void startNativeAppLockService() {
        Intent serviceIntent = new Intent(this, AppLockService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void handleLockIntent(Intent intent) {
        if (intent != null && intent.hasExtra("LOCKED_PACKAGE")) {
            String lockedPkg = intent.getStringExtra("LOCKED_PACKAGE");
            if (lockedPkg != null && getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript("if(window.onNativeAppLocked) window.onNativeAppLocked('" + lockedPkg + "');", null);
                });
            }
        }
    }
}
