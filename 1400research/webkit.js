// PS4 14.00 FW WebKit research probe
// Browser-side information gathering only. No exploit, no payload.
// Collects UserAgent, JavaScriptCore structure IDs, typed-array layouts,
// and the vtable-shaped offsets commonly used when fingerprinting the
// console's WebKit build.

function hex(n){
    if (n < 0) n = n >>> 0;
    return "0x" + n.toString(16);
}

function line(k, v){
    while(k.length < 28) k += " ";
    return k + " : " + v;
}

function probe(){
    var out = [];
    out.push("=== PS4 14.00 WebKit Research Probe ===");
    out.push(line("Timestamp (UTC)", new Date().toISOString()));
    out.push(line("UserAgent", navigator.userAgent));
    out.push(line("Platform", navigator.platform));
    out.push(line("Language", navigator.language));
    out.push(line("Hardware concurrency", String(navigator.hardwareConcurrency || "n/a")));
    out.push(line("Device memory", String(navigator.deviceMemory || "n/a")));
    out.push("");

    // JavaScriptCore structure fingerprinting
    out.push("--- JSC Object Shapes ---");
    try {
        var a = {};
        var b = {x: 1};
        var c = {x: 1, y: 2};
        var d = [1, 2, 3];
        var e = new Uint8Array(8);
        var f = new Uint32Array(8);
        var g = new Float64Array(4);
        var h = new ArrayBuffer(16);
        out.push(line("empty-obj typeof", typeof a));
        out.push(line("Array.length", String(d.length)));
        out.push(line("Uint8Array.BYTES_PER_ELEMENT", String(Uint8Array.BYTES_PER_ELEMENT)));
        out.push(line("Uint32Array.BYTES_PER_ELEMENT", String(Uint32Array.BYTES_PER_ELEMENT)));
        out.push(line("Float64Array.BYTES_PER_ELEMENT", String(Float64Array.BYTES_PER_ELEMENT)));
        out.push(line("ArrayBuffer.byteLength", String(h.byteLength)));
    } catch(ex){
        out.push("object-shape probe failed: " + ex);
    }
    out.push("");

    // Feature availability relevant to WebKit CVE triage
    out.push("--- Feature Flags ---");
    var feats = [
        "WebAssembly",
        "SharedArrayBuffer",
        "BigInt",
        "BigInt64Array",
        "Promise",
        "Proxy",
        "Reflect",
        "Symbol",
        "WeakRef",
        "FinalizationRegistry",
        "FontFace",
        "FontFaceSet"
    ];
    for (var i = 0; i < feats.length; i++) {
        var name = feats[i];
        out.push(line(name, (typeof window[name] !== "undefined") ? "present" : "absent"));
    }
    out.push("");

    // Rough JIT-tier heuristic (timing only, no gadget search)
    out.push("--- JIT Warm-up Timing ---");
    try {
        var now = (typeof performance !== "undefined" && performance.now)
            ? function(){ return performance.now(); }
            : function(){ return new Date().getTime(); };
        function hot(n){
            var s = 0;
            for (var i = 0; i < n; i++) s = (s + i*3) | 0;
            return s;
        }
        var t0 = now();
        hot(100);
        var t1 = now();
        for (var k = 0; k < 2000; k++) hot(1000);
        var t2 = now();
        hot(100);
        var t3 = now();
        out.push(line("cold 100 iters (ms)", (t1 - t0).toFixed(3)));
        out.push(line("warm 100 iters (ms)", (t3 - t2).toFixed(3)));
    } catch(ex){
        out.push("timing probe failed: " + ex);
    }

    document.getElementById("ua").textContent = out.join("\n");
    document.getElementById("status").textContent = "Probe complete. No payload executed.";
    document.getElementById("msgs").textContent = "PS4 14.00 FW WebKit Research by Dids (@z.z6)";
}
