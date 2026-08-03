package com.applock.secure;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new NativeAppLockBridge(this), "NativeAppLock");
        }
        
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
            try {
                startForegroundService(serviceIntent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            startService(serviceIntent);
        }
    }

    private void handleLockIntent(Intent intent) {
        if (intent != null && intent.hasExtra("LOCKED_PACKAGE")) {
            final String lockedPkg = intent.getStringExtra("LOCKED_PACKAGE");
            if (lockedPkg != null && getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript("if(window.onNativeAppLocked) window.onNativeAppLocked('" + lockedPkg + "');", null);
                });
            }
        }
    }

    public class NativeAppLockBridge {
        private Context mContext;

        public NativeAppLockBridge(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public boolean checkUsageAccessPermission() {
            try {
                AppOpsManager appOps = (AppOpsManager) mContext.getSystemService(Context.APP_OPS_SERVICE);
                int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, 
                        android.os.Process.myUid(), mContext.getPackageName());
                return mode == AppOpsManager.MODE_ALLOWED;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean checkOverlayPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                return Settings.canDrawOverlays(mContext);
            }
            return true;
        }

        @JavascriptInterface
        public void requestUsageAccessPermission() {
            try {
                Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                mContext.startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + mContext.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    mContext.startActivity(intent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public String getInstalledApps() {
            JSONArray appsArray = new JSONArray();
            try {
                PackageManager pm = mContext.getPackageManager();
                List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
                for (ApplicationInfo packageInfo : packages) {
                    if (packageInfo.packageName.equals(mContext.getPackageName())) continue;
                    
                    if (pm.getLaunchIntentForPackage(packageInfo.packageName) != null) {
                        JSONObject appObj = new JSONObject();
                        String appName = packageInfo.loadLabel(pm).toString();
                        appObj.put("name", appName);
                        appObj.put("pkg", packageInfo.packageName);
                        
                        String cat = "General";
                        String icon = "📱";
                        String color = "#0071E3";
                        
                        String pkgLow = packageInfo.packageName.toLowerCase();
                        
                        if (pkgLow.contains("whatsapp") || pkgLow.contains("telegram") || pkgLow.contains("messenger") || pkgLow.contains("chat") || pkgLow.contains("snapchat") || pkgLow.contains("instagram")) {
                            cat = "Social & Messaging";
                            icon = "💬";
                            color = "#25D366";
                            if (pkgLow.contains("instagram") || pkgLow.contains("snapchat")) {
                                icon = "📸";
                                color = "#E1306C";
                            }
                        } else if (pkgLow.contains("pay") || pkgLow.contains("bank") || pkgLow.contains("wallet") || pkgLow.contains("upi") || pkgLow.contains("finance")) {
                            cat = "Finance & Payments";
                            icon = "💳";
                            color = "#002E6E";
                        } else if (pkgLow.contains("photo") || pkgLow.contains("gallery") || pkgLow.contains("camera") || pkgLow.contains("video") || pkgLow.contains("youtube") || pkgLow.contains("netflix")) {
                            cat = "Photos & Media";
                            icon = "🖼️";
                            color = "#FF9F0A";
                        } else if ((packageInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0 || pkgLow.contains("setting") || pkgLow.contains("chrome")) {
                            cat = "System & Settings";
                            icon = "⚙️";
                            color = "#8E8E93";
                        }
                        
                        appObj.put("category", cat);
                        appObj.put("icon", icon);
                        appObj.put("color", color);
                        appsArray.put(appObj);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return appsArray.toString();
        }

        @JavascriptInterface
        public void setLockedApps(String jsonArrayString) {
            try {
                JSONArray array = new JSONArray(jsonArrayString);
                Set<String> set = new HashSet<>();
                for (int i = 0; i < array.length(); i++) {
                    set.add(array.getString(i));
                }
                SharedPreferences prefs = mContext.getSharedPreferences("AppLockPrefs", Context.MODE_PRIVATE);
                prefs.edit().putStringSet("locked_packages", set).apply();
                AppLockService.setLockedPackages(set);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
