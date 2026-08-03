package com.applock.secure;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import java.util.HashSet;
import java.util.Set;

public class AppLockService extends Service {
    private static final String CHANNEL_ID = "AppLockServiceChannel";
    private Handler handler;
    private Runnable monitorRunnable;
    private String lastForegroundPackage = "";
    
    private static Set<String> lockedPackages = new HashSet<>();

    public static void setLockedPackages(Set<String> packages) {
        lockedPackages = packages;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("App Lock Protection Active")
                .setContentText("Monitoring background applications in real-time...")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        
        startForeground(1001, notification);

        SharedPreferences prefs = getSharedPreferences("AppLockPrefs", Context.MODE_PRIVATE);
        Set<String> savedPackages = prefs.getStringSet("locked_packages", null);
        if (savedPackages != null) {
            lockedPackages = new HashSet<>(savedPackages);
        }

        handler = new Handler(Looper.getMainLooper());
        monitorRunnable = new Runnable() {
            @Override
            public void run() {
                checkForegroundApp();
                handler.postDelayed(this, 200); // Check every 200ms
            }
        };
        handler.post(monitorRunnable);
    }

    private void checkForegroundApp() {
        String currentPackage = getForegroundPackageName();
        if (currentPackage != null && !currentPackage.equals(getPackageName()) && !currentPackage.equals(lastForegroundPackage)) {
            SharedPreferences prefs = getSharedPreferences("AppLockPrefs", Context.MODE_PRIVATE);
            Set<String> currentLocked = prefs.getStringSet("locked_packages", null);
            boolean isLocked = false;
            if (currentLocked != null) {
                isLocked = currentLocked.contains(currentPackage);
            } else {
                isLocked = lockedPackages.contains(currentPackage) || isDefaultLockedPackage(currentPackage);
            }

            if (isLocked) {
                lastForegroundPackage = currentPackage;
                Intent lockIntent = new Intent(this, MainActivity.class);
                lockIntent.setAction(Intent.ACTION_MAIN);
                lockIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                lockIntent.putExtra("LOCKED_PACKAGE", currentPackage);
                startActivity(lockIntent);
            }
        }
    }

    private boolean isDefaultLockedPackage(String pkg) {
        return pkg.equals("com.whatsapp") || 
               pkg.equals("com.instagram.android") || 
               pkg.equals("com.google.android.apps.photos") || 
               pkg.equals("net.one97.paytm") || 
               pkg.equals("com.google.android.apps.nfc.payment") || 
               pkg.equals("com.phonepe.app") || 
               pkg.equals("com.snapchat.android");
    }

    private String getForegroundPackageName() {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return null;

        long endTime = System.currentTimeMillis();
        long startTime = endTime - 1000 * 5;

        UsageEvents events = usm.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();
        String packageName = null;

        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                packageName = event.getPackageName();
            }
        }
        return packageName;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (handler != null && monitorRunnable != null) {
            handler.removeCallbacks(monitorRunnable);
        }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "App Lock Real-Time Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
