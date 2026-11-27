package com.siraj.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** جسر JS ← أندرويد: وجدول المنبّهات. */
@CapacitorPlugin(name = "SirajAdhan")
public class SirajAdhanPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("hasAudio", AdhanStore.rawId(getContext()) != 0);
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
    public void test(PluginCall call) {
        int sec = call.getInt("sec", 10);
        if (sec < 5) sec = 5;
        boolean ok = AdhanStore.scheduleOne(getContext(), 987654, System.currentTimeMillis() + sec * 1000L,
                "تجربة الأذان", "هذا اختبار لصوت الأذان.");
        JSObject r = new JSObject();
        r.put("ok", ok);
        r.put("hasAudio", AdhanStore.rawId(getContext()) != 0);
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
