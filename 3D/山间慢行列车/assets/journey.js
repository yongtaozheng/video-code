/* Original illustrated slow journey. One simulation clock owns every movement. */
"use strict";
(async () => {
  const $ = (id) => document.getElementById(id),
    T = window.THREE,
    clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)),
    lerp = (a, b, t) => a + (b - a) * t;
  const errors = [];
  addEventListener("error", (e) => errors.push(e.message));
  let time = 0,
    last = 0,
    paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
    hidden = document.hidden,
    open = 0,
    openTarget = 0,
    wind = 0,
    journal = null,
    teaStart = -20,
    followUntil = -20,
    callStart = -30,
    ready = false,
    soundOn = false,
    audio = null,
    drawTime = -1,
    renderCount = 0;
  let pointer = { x: 0.5, y: 0.5 },
    wave = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error("画面素材未能加载"));
      img.src = src;
    });
  try {
    $("interior").src = TRAIN_ART.carriage;
    $("valance-art").src = TRAIN_ART.carriage;
    $("flowers-front").src = TRAIN_ART.carriage;
    $("landscape-fallback").style.backgroundImage =
      `url("${TRAIN_ART.landscape}")`;
    const results = await Promise.allSettled([
      load(TRAIN_ART.landscape),
      load(TRAIN_ART.carriage),
      document.fonts.ready,
    ]);
    if (results[0].status !== "fulfilled" || results[1].status !== "fulfilled")
      throw Error("画面素材未能加载，请刷新重试。");
    const art = results[0].value;
    journal = window.createTrainJournal(T, results[1].value, art);
    // A moving painted panorama, atmospheric silhouettes and nearer foliage form separate depths.
    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 720;
    const c = canvas.getContext("2d", { alpha: false });
    let renderer = null,
      scene,
      camera,
      paint,
      texture,
      bird;
    function oval(ctx, x, y, rx, ry, color, rotation = 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    let seed = 7381;
    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    const sparkle = Array.from({ length: 38 }, () => ({
      x: random(),
      y: 0.49 + random() * 0.24,
      w: 4 + random() * 16,
      p: random() * 7,
    }));
    function treeSprite(kind) {
      const cv = document.createElement("canvas");
      cv.width = 320;
      cv.height = 560;
      const g = cv.getContext("2d");
      g.strokeStyle = "#706a43";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(157, 560);
      g.bezierCurveTo(145, 390, 172, 230, 153, 95);
      g.stroke();
      const colors = kind
        ? ["#85966799", "#91a075a0", "#b4b478b0", "#687b57a0", "#d1c58a80"]
        : ["#6f8a6588", "#9ca879aa", "#aabb82a0", "#80946b99", "#bbc493a0"];
      for (let i = 0; i < 190; i++) {
        const y = 80 + random() * 410,
          width = (kind ? 40 : 95) * Math.sin(((y - 30) / 550) * Math.PI);
        const x = 157 + (random() - 0.5) * width * 2;
        oval(
          g,
          x,
          y,
          8 + random() * 20,
          4 + random() * 12,
          colors[Math.floor(random() * colors.length)],
          random() * 3,
        );
      }
      for (let i = 0; i < 32; i++) {
        g.strokeStyle = "#e2d29655";
        g.lineWidth = 1;
        g.beginPath();
        const y = 110 + random() * 400;
        g.moveTo(156, y);
        g.lineTo(156 + (random() - 0.5) * 80, y - 30);
        g.stroke();
      }
      return cv;
    }
    const trees = [treeSprite(0), treeSprite(1)];
    const stems = Array.from({ length: 90 }, () => ({
      x: random(),
      h: 16 + random() * 60,
      p: random() * 6,
    }));
    function panorama(t) {
      const W = canvas.width,
        H = canvas.height,
        cycle = (t % 96) / 96;
      const offset = t * 10.5,
        tileW = H * 3;
      c.fillStyle = "#e8d9bd";
      c.fillRect(0, 0, W, H);
      // Alternate mirrored tiles meet at the same painted edge, so the panorama never jumps.
      const first = Math.floor(offset / tileW);
      for (let n = first - 1; n < first + 2; n++) {
        const x = n * tileW - offset;
        c.save();
        c.translate(x, 0);
        if (Math.abs(n) % 2) {
          c.translate(tileW, 0);
          c.scale(-1, 1);
        }
        c.drawImage(art, 0, 0, tileW, H);
        c.restore();
      }
      // Subtle moving reflections sit only on the lake, feathered away from the banks.
      c.save();
      c.globalCompositeOperation = "screen";
      for (const s of sparkle) {
        let x = (((s.x * W - t * 4) % W) + W) % W;
        const y = s.y * H + Math.sin(t * 0.5 + s.p) * 1.5;
        c.strokeStyle = `rgba(255,239,197,${0.08 + 0.075 * Math.sin(t * 0.8 + s.p) ** 2})`;
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + s.w * 0.5, y + Math.sin(t + s.p), x + s.w, y);
        c.stroke();
      }
      c.restore();
      // Much closer trackside trees pass at a different speed, with breathing room between them.
      const spacing = 1370;
      for (let i = 0; i < 3; i++) {
        const x = ((i * spacing - t * 55 + spacing * 3) % (spacing * 3)) - 480;
        const img = trees[i % 2];
        c.globalAlpha = 0.8;
        c.drawImage(img, x, H - 150 + (i % 2) * 30, 180, 245);
        c.globalAlpha = 1;
      }
      const near = c.createLinearGradient(0, H - 70, 0, H);
      near.addColorStop(0, "#c4b47b00");
      near.addColorStop(1, "#c6b97855");
      c.fillStyle = near;
      c.fillRect(0, H - 70, W, 70);
      for (const s of stems) {
        const x = (((s.x * W - t * 89) % W) + W) % W,
          y = H + 5,
          lean = Math.sin(t * 1.3 + s.p) * 3 + wind * 8;
        c.strokeStyle = "#baa16455";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + lean, y - s.h * 0.6, x + lean * 1.5, y - s.h);
        c.stroke();
      }
      const dusk = Math.sin(Math.PI * cycle) ** 2;
      c.fillStyle = `rgba(230,177,114,${dusk * 0.045})`;
      c.fillRect(0, 0, W, H);
      if (texture) texture.needsUpdate = true;
      drawTime = t;
    }
    function birdTexture(part) {
      const cv = document.createElement("canvas");
      cv.width = 256;
      cv.height = 256;
      const g = cv.getContext("2d");
      g.translate(128, 128);
      if (part === "body") {
        oval(g, 0, 2, 45, 22, "#81664d", -0.15);
        oval(g, 12, 10, 28, 12, "#f3e3b9", -0.15);
        oval(g, 33, -12, 18, 17, "#947553");
        g.fillStyle = "#634936";
        g.beginPath();
        g.moveTo(-34, 0);
        g.lineTo(-79, -19);
        g.lineTo(-63, 13);
        g.closePath();
        g.fill();
        g.fillStyle = "#dfb670";
        g.beginPath();
        g.moveTo(48, -11);
        g.lineTo(64, -4);
        g.lineTo(48, -1);
        g.fill();
        oval(g, 38, -14, 3, 3, "#352c24");
        oval(g, 39, -15, 1, 1, "#fff8df");
      } else {
        g.fillStyle = "#8b7657";
        g.beginPath();
        g.moveTo(-12, 16);
        g.bezierCurveTo(-54, -13, -91, -62, -85, -91);
        g.bezierCurveTo(-73, -78, -27, -65, 25, -12);
        g.closePath();
        g.fill();
        for (let i = 0; i < 7; i++) {
          g.strokeStyle = i % 2 ? "#c7b28c" : "#67573f";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(-6 - i * 7, 7 - i * 2);
          g.quadraticCurveTo(
            -20 - i * 6,
            -23 - i * 6,
            -39 - i * 7,
            -41 - i * 7,
          );
          g.stroke();
        }
      }
      return new T.CanvasTexture(cv);
    }
    try {
      if (!T) throw Error("Three.js 未载入");
      renderer = new T.WebGLRenderer({
        canvas: $("world"),
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
      renderer.outputColorSpace = T.SRGBColorSpace;
      scene = new T.Scene();
      camera = new T.OrthographicCamera(-768, 768, 360, -360, 0.1, 100);
      camera.position.z = 20;
      texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      paint = new T.Mesh(
        new T.PlaneGeometry(1536, 720),
        new T.MeshBasicMaterial({ map: texture }),
      );
      scene.add(paint);
      bird = new T.Group();
      const bm = new T.MeshBasicMaterial({
        map: birdTexture("body"),
        transparent: true,
        depthWrite: false,
      });
      const wm = new T.MeshBasicMaterial({
        map: birdTexture("wing"),
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
      });
      const far = new T.Mesh(new T.PlaneGeometry(110, 110), wm),
        body = new T.Mesh(new T.PlaneGeometry(110, 110), bm),
        wing = new T.Mesh(new T.PlaneGeometry(110, 110), wm);
      far.position.z = 1;
      body.position.z = 2;
      wing.position.z = 3;
      bird.add(far, body, wing);
      bird.userData = { wing, far };
      bird.position.z = 4;
      bird.visible = false;
      scene.add(bird);
      function resize() {
        const b = $("view").getBoundingClientRect();
        renderer.setSize(Math.max(1, b.width), Math.max(1, b.height), false);
        renderer.render(scene, camera);
      }
      addEventListener("resize", resize);
      resize();
      $("world").addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        paused = true;
        errors.push("WebGL context lost");
        $("world").style.display = "none";
        syncPause();
      });
    } catch (e) {
      errors.push(String(e));
      $("world").style.display = "none";
    }
    const dust = Array.from({ length: 22 }, (_, i) => {
      const el = document.createElement("i");
      $("dust").appendChild(el);
      const x = random(),
        y = random(),
        p = random() * 10;
      return { el, x, y, p, size: 1 + random() * 2 };
    });
    function announce(text) {
      $("announcement").textContent = text;
    }
    function toggleWindow() {
      openTarget = openTarget ? 0 : 1;
      $("window").setAttribute("aria-pressed", String(!!openTarget));
      $("window").querySelector("span").textContent = openTarget
        ? "关窗"
        : "开窗";
      announce(openTarget ? "窗打开了，微风吹进车厢。" : "窗关好了。");
    }
    function turnPage() {
      if (journal.turn(time)) announce("书页轻轻翻向左边，露出下一段风景。");
    }
    function tea() {
      teaStart = time;
      announce("热气轻轻升起。");
    }
    function callBird() {
      callStart = time;
      followUntil = time + 14;
      announce("一只小鸟飞来，陪你走一段山路。");
    }
    function syncPause() {
      $("pause").setAttribute("aria-pressed", String(paused));
      $("pause").setAttribute("aria-label", paused ? "继续旅途" : "暂停旅途");
      $("pause-icon").setAttribute(
        "d",
        paused ? "m8 5 11 7-11 7Z" : "M8 5v14M16 5v14",
      );
    }
    function togglePause() {
      paused = !paused;
      last = 0;
      syncPause();
    }
    function makeAudio() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      const ctx = new Audio(),
        gain = ctx.createGain(),
        filter = ctx.createBiquadFilter(),
        noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate),
        data = noise.getChannelData(0);
      let value = 0;
      for (let i = 0; i < data.length; i++) {
        value = (value + Math.random() * 0.04 - 0.02) / 1.018;
        data[i] = value;
      }
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 650;
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return { ctx, gain, filter, next: 0 };
    }
    async function toggleSound() {
      try {
        if (!audio) audio = makeAudio();
        if (!audio) {
          announce("此浏览器暂不支持环境音。");
          return;
        }
        await audio.ctx.resume();
        soundOn = !soundOn;
        $("sound").setAttribute("aria-pressed", String(soundOn));
        $("sound").setAttribute(
          "aria-label",
          soundOn ? "关闭列车环境音" : "开启列车环境音",
        );
      } catch (e) {
        announce("声音未能开启，请再试一次。");
      }
    }
    function tickAudio(active) {
      if (!audio) return;
      const { ctx, gain, filter } = audio;
      gain.gain.setTargetAtTime(
        active ? 0.045 + open * 0.04 : 0,
        ctx.currentTime,
        0.2,
      );
      filter.frequency.setTargetAtTime(450 + open * 800, ctx.currentTime, 0.3);
      if (active && time > audio.next) {
        audio.next = time + 1.45;
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator(),
            g = ctx.createGain(),
            start = ctx.currentTime + i * 0.13;
          osc.type = "sine";
          osc.frequency.value = 85 - i * 11;
          g.gain.setValueAtTime(0, start);
          g.gain.linearRampToValueAtTime(0.018, start + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.12);
        }
      }
    }
    for (const id of ["window", "window-hotspot"]) $(id).onclick = toggleWindow;
    for (const id of ["book", "book-hotspot"]) $(id).onclick = turnPage;
    $("tea-hotspot").onclick = tea;
    $("bird").onclick = callBird;
    $("pause").onclick = togglePause;
    $("sound").onclick = toggleSound;
    $("view").onclick = callBird;
    $("view").onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        callBird();
      }
    };
    $("journey").addEventListener("pointermove", (e) => {
      const r = $("carriage").getBoundingClientRect();
      pointer.x = clamp((e.clientX - r.left) / r.width);
      pointer.y = clamp((e.clientY - r.top) / r.height);
    });
    addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        !["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        ) &&
        document.activeElement.getAttribute("role") !== "button"
      ) {
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener("visibilitychange", () => {
      hidden = document.hidden;
      last = 0;
      tickAudio(soundOn && !paused && !hidden);
    });
    function frame(dt) {
      time += dt;
      const a = 1 - Math.exp(-dt * 2.7);
      open = lerp(open, openTarget, a);
      wind = lerp(wind, open * 0.85, 1 - Math.exp(-dt * 1.5));
      wave = Math.sin(time * 1.3) * wind;
      if (time - drawTime > 1 / 28 || drawTime < 0) panorama(time);
      if (bird) {
        const follow = time < followUntil,
          age = time - callStart,
          auto = time % 32 > 21 && time % 32 < 30;
        bird.visible = follow || auto;
        const t = follow ? age : (time % 32) - 21;
        let x = follow ? lerp(930, 105, clamp(t / 2.2)) : 850 - t * 200;
        let y = follow
          ? 65 + Math.sin(time * 0.65) * 32
          : 120 + Math.sin(time * 0.8) * 23;
        if (follow && followUntil - time < 2) {
          const out = 1 - (followUntil - time) / 2;
          x += out * 850;
          y += out * 140;
        }
        bird.position.set(x, y, 4);
        bird.scale.setScalar(follow ? 0.95 : 0.65);
        bird.rotation.z = Math.sin(time * 1.5) * 0.035;
        bird.userData.wing.rotation.x = Math.sin(time * 11) * 1.0;
        bird.userData.far.rotation.x = -Math.sin(time * 11) * 0.9;
      }
      if (renderer) {
        renderer.render(scene, camera);
        renderCount++;
      }
      $("glass").style.transform = `translateY(${-open * 65}%)`;
      $("valance").style.transform =
        `scaleY(${1 + Math.sin(time * 1.15) * wind * 0.012}) skewX(${wave * 0.25}deg)`;
      const warmth = Math.max(0, 1 - (time - teaStart) / 8);
      document.querySelectorAll("#steam path").forEach((p, i) => {
        const drift = (pointer.x - 0.665) * 45 * warmth + wind * 15,
          x = 82 + i * 29,
          s = Math.sin(time * 0.85 + i * 2) * 12 + drift,
          y = 233;
        p.setAttribute(
          "d",
          `M${x} ${y} C${x - 27 + s} 190 ${x + 26 + s} 172 ${x + s} 139 S${x - 21 + s} 91 ${x + 11 + s} ${45 - i * 10}`,
        );
        p.setAttribute("stroke-width", 2.5 + warmth * 1.7);
        p.style.opacity =
          (0.12 + 0.16 * Math.sin(time * 0.7 + i) ** 2 + warmth * 0.13) *
          (1 - i * 0.12);
      });
      const tr = clamp((time - teaStart) / 2.2);
      $("tea-rings").style.opacity = tr < 1 ? (1 - tr) * 0.6 : 0;
      const ring = $("tea-rings").firstElementChild;
      ring.setAttribute("rx", 15 + tr * 58);
      ring.setAttribute("ry", 2 + tr * 9);
      journal.update(time);
      dust.forEach((d) => {
        const x = (d.x + time * (0.0009 + wind * 0.0015)) % 1,
          y = (d.y - time * 0.0015 + 2) % 1;
        Object.assign(d.el.style, {
          left: 20 + x * 65 + "%",
          top: 20 + y * 69 + "%",
          width: d.size + "px",
          height: d.size + "px",
          opacity:
            (0.12 + 0.18 * Math.sin(time * 0.5 + d.p) ** 2) *
            (0.65 + open * 0.35),
        });
      });
      const cycle = (time % 96) / 96,
        phase =
          cycle < 0.32 ? "风过麦田" : cycle < 0.66 ? "沿湖而行" : "山村来信";
      $("place").textContent = phase;
      $("moment").textContent = cycle < 0.7 ? "午后" : "暖阳";
      $("route-dot").style.left = cycle * 93 + "%";
      $("hint").style.opacity = clamp(1 - (time - 9) / 3);
      $("sunwash").style.opacity = 0.4 + Math.sin(Math.PI * cycle) ** 2 * 0.4;
      tickAudio(soundOn && !paused && !hidden);
    }
    ready = true;
    syncPause();
    frame(0);
    $("loading").style.opacity = 0;
    $("loading").style.pointerEvents = "none";
    setTimeout(() => ($("loading").style.display = "none"), 900);
    Object.defineProperty(window, "trainStatus", {
      get: () => ({
        ready,
        time,
        paused,
        hidden,
        windowOpen: open,
        windowTarget: openTarget,
        wind,
        page: journal.page,
        flipping: journal.active,
        flipProgress: journal.progress,
        birdFollowing: time < followUntil,
        phase: $("place").textContent,
        soundOn,
        webgl: !!renderer,
        drawCalls: renderer?.info.render.calls || 0,
        renderCount,
        errors: errors.slice(),
        cycleSeconds: 96,
        reducedMotion: reduced,
      }),
    });
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (!paused && !hidden) frame(dt);
    }
    requestAnimationFrame(loop);
  } catch (e) {
    errors.push(String(e));
    $("loading").textContent = e.message || "车厢未能载入，请刷新重试。";
  }
})();
