package com.siraj.app;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/** جسر JS ← أندرويد: ملف الأذان (على دفعات) وجدول المنبّهات. */
@CapacitorPlugin(name = "SirajAdhan")
public class SirajAdhanPlugin extends Plugin {

    @PluginMethod
    public void appendAdhan(PluginCall call) {
        String data = call.getString("data");
        boolean first = Boolean.TRUE.equals(call.getBoolean("first"));
        if (data == null) {
            call.reject("no data");
            return;
        }
        try {
            File f = AdhanStore.audioFile(getContext());
            FileOutputStream o = new FileOutputStream(f, !first);
            try {
                o.write(Base64.decode(data, Base64.DEFAULT));
            } finally {
                o.close();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearAdhan(PluginCall call) {
        try {
            File f = AdhanStore.audioFile(getContext());
            if (f.exists()) f.delete();
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        File f = AdhanStore.audioFile(getContext());
        JSObject r = new JSObject();
        r.put("hasAudio", f.exists() && f.length() > 0);
        r.put("size", f.exists() ? f.length() : 0);
        r.put("exact", AdhanStore.canExact(getContext()));
        r.put("scheduled", AdhanStore.loadItems(getContext()).length());
        call.resolve(r);
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null) {
            call.reject("no items");
            return;
        }
        AdhanStore.cancelAll(getContext());
        AdhanStore.saveItems(getContext(), items.toString());
        int n = AdhanStore.scheduleAll(getContext());
        JSObject r = new JSObject();
        r.put("count", n);
        call.resolve(r);
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        AdhanStore.cancelAll(getContext());
        AdhanStore.saveItems(getContext(), "[]");
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        AdhanService.stop(getContext());
        call.resolve();
    }
}
