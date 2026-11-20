/* 经确认的手绘关键画面驱动的 Three.js 分层动画；所有贴图均在本地。 */
"use strict";
(async () => {
  if (!window.THREE) return;
  const T = THREE,
    $ = (id) => document.getElementById(id),
    TAU = Math.PI * 2,
    clamp = T.MathUtils.clamp,
    lerp = T.MathUtils.lerp;
  if (!window.GARDEN_ART) {
    $("load-text").textContent = "画卷尚未载入";
    $("load-error").textContent = "请保留 assets/illustrations.js 后刷新。";
    return;
  }
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    $("load-text").textContent = "暂时无法展开花园";
    $("load-error").textContent = "请启用浏览器硬件加速后重试。";
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.setClearColor(0xeee1c6, 1);
  $("garden").appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  const loader = new T.TextureLoader(),
    art = {};
  try {
    await Promise.all(
      Object.entries(window.GARDEN_ART).map(async ([name, url]) => {
        const tex = await loader.loadAsync(url);
        tex.colorSpace = T.SRGBColorSpace;
        tex.minFilter = T.LinearMipmapLinearFilter;
        tex.magFilter = T.LinearFilter;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        art[name] = tex;
      }),
    );
  } catch (e) {
    $("load-text").textContent = "部分画面未能展开";
    $("load-error").textContent = "请刷新页面重新载入手绘图层。";
    return;
  }
  const W = 16,
    H = 9,
    ASPECT = W / H,
    scene = new T.Scene(),
    camera = new T.PerspectiveCamera(30, 1, 0.1, 80),
    garden = new T.Group();
  scene.add(garden);
  const imagePlane = new T.Plane(new T.Vector3(0, 0, 1), 0),
    ray = new T.Raycaster(),
    mouse = new T.Vector2(),
    hit = new T.Vector3();
  // 所有坐标均为画稿内的标准化坐标，原点在左下；庭院使用无机械装置的手绘底图。
  const river = [
    new T.Vector2(0.25, 0),
    new T.Vector2(0.305, 0.1),
    new T.Vector2(0.345, 0.18),
    new T.Vector2(0.395, 0.22),
    new T.Vector2(0.46, 0.22),
    new T.Vector2(0.5, 0.185),
    new T.Vector2(0.56, 0.24),
    new T.Vector2(0.62, 0.3),
    new T.Vector2(0.68, 0.33),
    new T.Vector2(0.74, 0.31),
    new T.Vector2(0.765, 0.26),
    new T.Vector2(0.705, 0.21),
    new T.Vector2(0.66, 0.14),
    new T.Vector2(0.64, 0.08),
    new T.Vector2(0.66, 0),
  ];
  // 只分析透明水层的轮廓，不把水画回底图。每一行用于沿弯曲水道搬运完整的 RGBA 笔触。
  const waterImage = art.waterfall.image,
    profileCanvas = document.createElement("canvas");
  profileCanvas.width = waterImage.width;
  profileCanvas.height = waterImage.height;
  const profileContext = profileCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  profileContext.drawImage(waterImage, 0, 0);
  const alphaPixels = profileContext.getImageData(
      0,
      0,
      waterImage.width,
      waterImage.height,
    ).data,
    waterSections = [];
  for (let i = 0; i < 32; i++) {
    const y = 0.23 + (i / 31) * 0.46,
      row = clamp(
        Math.floor((1 - y) * waterImage.height),
        0,
        waterImage.height - 1,
      );
    let left = waterImage.width,
      right = -1;
    for (
      let x = Math.floor(waterImage.width * 0.17);
      x < waterImage.width * 0.39;
      x++
    ) {
      if (alphaPixels[(row * waterImage.width + x) * 4 + 3] > 28) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    waterSections.push(
      right > left
        ? new T.Vector2(
            (left + right) / 2 / waterImage.width,
            Math.max(0.004, (right - left) / 2 / waterImage.width),
          )
        : null,
    );
  }
  for (let i = 0; i < 32; i++)
    if (!waterSections[i]) {
      let nearest = -1;
      for (let j = 0; j < 32; j++)
        if (
          waterSections[j] &&
          (nearest < 0 || Math.abs(j - i) < Math.abs(nearest - i))
        )
          nearest = j;
      waterSections[i] =
        nearest >= 0
          ? waterSections[nearest].clone()
          : new T.Vector2(
              0.22 +
                0.115 *
                  (1 -
                    Math.exp(
                      -Math.max(0.68 - (0.23 + (i / 31) * 0.46), 0) * 7.5,
                    )),
              0.02,
            );
    }
  const uniforms = {
    plate: { value: art.plate },
    waterfall: { value: art.waterfall },
    fallSections: { value: waterSections },
    time: { value: 0 },
    day: { value: 0 },
    wind: { value: 0 },
    river: { value: river },
    ripples: {
      value: Array.from({ length: 9 }, () => new T.Vector4(0, 0, -100, 0)),
    },
  };
  const gardenMaterial = new T.ShaderMaterial({
    uniforms,
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
uniform sampler2D plate;uniform sampler2D waterfall;uniform vec2 fallSections[32];uniform float time;uniform float day;uniform float wind;uniform vec2 river[15];uniform vec4 ripples[9];varying vec2 vUv;
vec3 over(vec3 below,vec4 above){return mix(below,above.rgb,clamp(above.a,0.,1.));}
float riverMask(vec2 p){float inside=0.;float closest=10.;for(int i=0;i<15;i++){int j=i==14?0:i+1;vec2 a=river[i],b=river[j],ab=b-a;float h=clamp(dot(p-a,ab)/max(dot(ab,ab),.00001),0.,1.);closest=min(closest,length((p-a-ab*h)*vec2(1.77778,1.)));if((a.y>p.y)!=(b.y>p.y)){float crossX=(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x;if(p.x<crossX)inside=1.-inside;}}float pool=1.-smoothstep(.83,1.,length((p-vec2(.29,.225))/vec2(.075,.065)));return max(inside*smoothstep(0.,.008,closest),pool);}
// 双相位交叉淡化连续搬运水面笔触，重置时不会出现跳帧。
float waterPigment(vec3 c){return smoothstep(-.005,.045,c.g-c.r)*smoothstep(-.008,.035,c.b-c.r);}
vec2 fallSection(float y){float f=clamp((y-.23)/.46,0.,1.)*31.;int i=int(min(floor(f),30.));return mix(fallSections[i],fallSections[i+1],f-float(i));}
vec4 fallingWater(vec2 uv,float progress){if(uv.y<.224||uv.y>.697)return vec4(0.);vec2 outSection=fallSection(uv.y);float across=(uv.x-outSection.x)/max(outSection.y,.004);if(abs(across)>1.08)return vec4(0.);float sourceY=mix(.27,.66,progress);vec2 sourceSection=fallSection(sourceY);vec4 c=texture2D(waterfall,vec2(sourceSection.x+across*sourceSection.y,sourceY));c.a*=smoothstep(.224,.24,uv.y)*(1.-smoothstep(.683,.697,uv.y));return c;}
void main(){vec2 uv=vUv,p=uv;float breeze=.22+wind;float fgRight=smoothstep(.69,.94,p.x)*(1.-smoothstep(.22,.39,p.y));float fgLeft=(1.-smoothstep(.10,.19,p.x))*(1.-smoothstep(.43,.56,p.y));float willow=(1.-smoothstep(.12,.29,p.x))*smoothstep(.69,.96,p.y);float wisteria=smoothstep(.65,.9,p.x)*smoothstep(.71,.96,p.y);float distant=smoothstep(.56,.7,p.x)*smoothstep(.32,.42,p.y)*(1.-smoothstep(.57,.67,p.y));p.x+=sin(time*.72+p.y*9.+p.x*5.)*breeze*(fgRight*.0035+fgLeft*.0025+willow*.0028+wisteria*.003+distant*.0006);p.y+=cos(time*.58+p.x*13.)*breeze*(fgRight*.0014+wisteria*.001+fgLeft*.0008);
float water=riverMask(uv);p.x+=water*sin(uv.y*53.-time*.62+sin(uv.x*29.))*.0007;p.y+=water*sin(uv.x*66.+time*.39)*.0004;
float rings=0.;for(int i=0;i<9;i++){float age=time-ripples[i].z;vec2 d=(uv-ripples[i].xy)*vec2(1.77778,1.);float r=length(d);float wave=sin(r*350.-age*6.)*exp(-abs(r-age*.026)*150.)*max(0.,1.-age/4.5)*step(0.,age);p+=normalize(d+vec2(.00001))*wave*.0012*water;rings+=wave;}
vec3 c=texture2D(plate,clamp(p,.001,.999)).rgb;
float flowPhase=fract(time*.19),flowMix=abs(flowPhase*2.-1.);vec2 direction=mix(vec2(-.025,-.038),vec2(.045,-.013),(1.-smoothstep(.35,.43,uv.x))*smoothstep(.10,.18,uv.y));vec2 flowA=clamp(p-direction*flowPhase,.001,.999),flowB=clamp(p-direction*fract(flowPhase+.5),.001,.999);vec3 colorA=texture2D(plate,flowA).rgb,colorB=texture2D(plate,flowB).rgb;float wetA=(1.-flowMix)*riverMask(flowA)*waterPigment(colorA),wetB=flowMix*riverMask(flowB)*waterPigment(colorB),wet=wetA+wetB;vec3 flowing=(colorA*wetA+colorB*wetB)/max(wet,.00001);c=mix(c,flowing,water*waterPigment(c)*wet*.96);
// 瀑布作为独立流动层覆盖底图。
float fallPhase=fract((uv.y-.23)/.46+time*.62),fallMix=abs(fallPhase*2.-1.);vec4 fallA=fallingWater(uv,fallPhase),fallB=fallingWater(uv,fract(fallPhase+.5));fallA.rgb*=fallA.a;fallB.rgb*=fallB.a;vec4 flowingFall=mix(fallA,fallB,fallMix);flowingFall.rgb/=max(flowingFall.a,.00001);c=over(c,flowingFall);
float shimmer=pow(max(0.,sin(uv.y*390.+uv.x*120.+time*7.+sin(uv.x*90.))),20.)*water;c+=vec3(.045,.038,.020)*shimmer+rings*.018*water;float dusk=smoothstep(.65,.85,day)*(1.-smoothstep(.94,1.,day));float sunset=sin(smoothstep(.5,.78,day)*3.14159);c*=mix(vec3(1.),vec3(.79,.81,.91),dusk*.45);c=mix(c,c*vec3(1.04,.99,.94),sunset*.22);float window1=exp(-dot((uv-vec2(.443,.759))*vec2(36.,25.),(uv-vec2(.443,.759))*vec2(36.,25.)));float window2=exp(-dot((uv-vec2(.053,.58))*vec2(45.,34.),(uv-vec2(.053,.58))*vec2(45.,34.)));c+=vec3(.085,.043,.009)*(window1+window2)*dusk;gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`,
  });
  const backdrop = new T.Mesh(new T.PlaneGeometry(W, H), gardenMaterial);
  backdrop.renderOrder = 0;
  garden.add(backdrop);
  const unitGeo = new T.PlaneGeometry(1, 1, 10, 4),
    uvToWorld = (x, y, z = 0.1) =>
      new T.Vector3((x - 0.5) * W, (y - 0.5) * H, z);
  function atlasTexture(col, row) {
    const tex = art.botanicals.clone();
    tex.offset.set(col * 0.5, row * 0.5);
    tex.repeat.set(0.5, 0.5);
    tex.needsUpdate = true;
    return tex;
  }
  const butterflyTextures = [atlasTexture(0, 1), atlasTexture(1, 1)],
    flowerTextures = [atlasTexture(0, 0), atlasTexture(1, 0)];
  // 翅膀在三维中折叠，身体沿曲线飞行；透明纹理保留画稿的笔触。
  const butterflies = [];
  function makeButterfly(index, temporary = false, origin = null) {
    const mat = new T.MeshBasicMaterial({
      map: butterflyTextures[index % 2],
      transparent: true,
      alphaTest: 0.04,
      depthTest: false,
      depthWrite: false,
      side: T.DoubleSide,
    });
    const geo = unitGeo.clone(),
      base = Float32Array.from(geo.attributes.position.array),
      mesh = new T.Mesh(geo, mat);
    mesh.renderOrder = 5;
    garden.add(mesh);
    const b = {
      mesh,
      base,
      index,
      phase: index * 1.9,
      age: 0,
      temporary,
      origin,
      geo,
    };
    butterflies.push(b);
    return b;
  }
  for (let i = 0; i < 5; i++) makeButterfly(i);
  function petalTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(12, 8, 44, 52);
    g.addColorStop(0, "#ffe8cf");
    g.addColorStop(1, "#e9a3a0");
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(31, 57);
    x.bezierCurveTo(11, 43, 6, 19, 22, 11);
    x.bezierCurveTo(45, -1, 62, 31, 31, 57);
    x.fill();
    x.strokeStyle = "#d8968b66";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(30, 51);
    x.quadraticCurveTo(24, 28, 31, 15);
    x.stroke();
    return new T.CanvasTexture(c);
  }
  const petalMap = petalTexture();
  petalMap.colorSpace = T.SRGBColorSpace;
  const petals = [];
  function emitPetals(x, y, count = 7) {
    for (let i = 0; i < count; i++) {
      let p = petals.find((p) => p.age > p.life);
      if (!p) {
        if (petals.length >= 70) p = petals.shift();
        else {
          const m = new T.MeshBasicMaterial({
              map: petalMap,
              transparent: true,
              depthWrite: false,
              depthTest: false,
              side: T.DoubleSide,
            }),
            o = new T.Mesh(new T.PlaneGeometry(1, 1), m);
          o.renderOrder = 6;
          garden.add(o);
          p = { mesh: o };
        }
        petals.push(p);
      }
      p.age = 0;
      p.life = 5 + Math.random() * 5;
      p.x = x + (Math.random() - 0.5) * 0.012;
      p.y = y + (Math.random() - 0.5) * 0.015;
      p.vx = 0.004 + (Math.random() - 0.5) * 0.014;
      p.vy = 0.018 + Math.random() * 0.025;
      p.size = 0.055 + Math.random() * 0.05;
      p.phase = Math.random() * TAU;
      p.mesh.visible = true;
      p.mesh.material.opacity = 0.8;
    }
  }
  const blooms = [];
  function bloom(x, y, automatic = false) {
    if (blooms.length >= 18) {
      const old = blooms.shift();
      garden.remove(old.group);
      old.stem.geometry.dispose();
      old.stem.material.dispose();
      old.head.geometry.dispose();
      old.head.material.dispose();
    }
    const group = new T.Group();
    group.position.copy(uvToWorld(x, y, 0.19));
    garden.add(group);
    const height = 0.25 + Math.random() * 0.16,
      curve = new T.QuadraticBezierCurve3(
        new T.Vector3(),
        new T.Vector3(-0.04, height * 0.55, 0),
        new T.Vector3(0.015, height, 0),
      );
    const stem = new T.Mesh(
      new T.TubeGeometry(curve, 12, 0.006, 4, false),
      new T.MeshBasicMaterial({
        color: 0x718755,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    stem.renderOrder = 3;
    group.add(stem);
    const head = new T.Mesh(
      new T.PlaneGeometry(0.45, 0.45),
      new T.MeshBasicMaterial({
        map: flowerTextures[blooms.length % 2],
        transparent: true,
        alphaTest: 0.05,
        depthTest: false,
        depthWrite: false,
      }),
    );
    head.position.set(0.015, height, 0);
    head.renderOrder = 4;
    group.add(head);
    const data = {
      group,
      stem,
      head,
      age: 0,
      phase: Math.random() * TAU,
      automatic,
    };
    group.scale.setScalar(0.001);
    blooms.push(data);
  }
  function randomBloom() {
    const spots = [
      [0.81, 0.13],
      [0.91, 0.23],
      [0.68, 0.42],
      [0.58, 0.42],
      [0.18, 0.13],
      [0.43, 0.4],
    ];
    const visible = spots.filter((p) => {
        const v = uvToWorld(p[0], p[1]).project(camera);
        return Math.abs(v.x) < 0.86 && Math.abs(v.y) < 0.82;
      }),
      pool = visible.length ? visible : spots;
    const p = pool[Math.floor(Math.random() * pool.length)];
    bloom(
      p[0] + (Math.random() - 0.5) * 0.025,
      p[1] + (Math.random() - 0.5) * 0.02,
    );
    emitPetals(p[0], p[1], 5);
  }
  // 小而稀疏的滴水、光点，仍然服从画中的空间位置。
  const dropPositions = new Float32Array(180 * 6),
    dropGeo = new T.BufferGeometry();
  dropGeo.setAttribute("position", new T.BufferAttribute(dropPositions, 3));
  const dropMat = new T.LineBasicMaterial({
    color: 0xfff5dd,
    transparent: true,
    opacity: 0.26,
    depthTest: false,
    depthWrite: false,
  });
  const drops = new T.LineSegments(dropGeo, dropMat);
  drops.renderOrder = 3;
  garden.add(drops);
  function glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const x = c.getContext("2d"),
      g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,245,193,1)");
    g.addColorStop(0.2, "rgba(255,222,143,.5)");
    g.addColorStop(1, "rgba(255,222,143,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return new T.CanvasTexture(c);
  }
  const glowMap = glowTexture(),
    fireflies = [];
  for (let i = 0; i < 24; i++) {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: glowMap,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    s.scale.setScalar(0.07);
    s.renderOrder = 7;
    garden.add(s);
    fireflies.push({
      s,
      x: 0.38 + Math.random() * 0.55,
      y: 0.15 + Math.random() * 0.42,
      phase: Math.random() * TAU,
    });
  }
  const splashPositions = new Float32Array(52 * 6),
    splashGeo = new T.BufferGeometry();
  splashGeo.setAttribute("position", new T.BufferAttribute(splashPositions, 3));
  const splash = new T.LineSegments(
    splashGeo,
    new T.LineBasicMaterial({
      color: 0xfff8e6,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    }),
  );
  splash.renderOrder = 4;
  garden.add(splash);
  // 落水泡沫也是独立的动态笔触，不复用底图中的白色喷溅。
  function foamTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,251,235,.92)";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(3, 47);
    ctx.quadraticCurveTo(13, 31, 22, 45);
    ctx.bezierCurveTo(28, 45, 25, 17, 38, 18);
    ctx.bezierCurveTo(49, 17, 44, 43, 55, 42);
    ctx.quadraticCurveTo(60, 41, 62, 47);
    ctx.fillStyle = "rgba(255,252,238,.55)";
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(235,247,238,.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 53);
    ctx.quadraticCurveTo(31, 59, 60, 51);
    ctx.stroke();
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }
  const foamMap = foamTexture(),
    foamPieces = [];
  for (let i = 0; i < 42; i++) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        map: foamMap,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.renderOrder = 4;
    garden.add(mesh);
    foamPieces.push({
      mesh,
      phase: i * 0.618033,
      side: Math.sin(i * 17.31),
      y: Math.sin(i * 31.1) * 0.007,
      size: 0.16 + (i % 6) * 0.025,
    });
  }
  let nextWaterRipple = 0.7;
  let sim = 0,
    day = 0,
    wind = 0,
    windOn = false,
    paused = false,
    roam = true,
    drag = null,
    hidden = document.hidden,
    last = 0,
    rippleIndex = 0,
    rippleCount = 0,
    nextPetal = 1,
    lastAutoBloom = -1,
    noteLife = 0,
    soundOn = false,
    audio = null,
    nextChime = 0,
    zoom = 1,
    targetZoom = 1;
  const center = new T.Vector2(),
    targetCenter = new T.Vector2(),
    hover = new T.Vector2(),
    cameraAim = new T.Vector3(),
    viewFrustum = new T.Vector2(),
    baseDistance = H / (2 * Math.tan(Math.PI / 12));
  let initialView = true,
    snapCamera = true;
  const cameraStops = [
    [0, 0, 0, 1],
    [0.15, 0, 0, 1],
    [0.34, -0.7, 0.22, 1.1],
    [0.6, 0.85, 0.1, 1.13],
    [0.8, 1.0, -0.12, 1.12],
    [1, 0, 0, 1],
  ];
  function route() {
    if (camera.aspect < 1)
      return {
        x: -3.65 + (1 - Math.cos((day * TAU) / 180)) * 4.2,
        y: Math.sin((day * TAU) / 180) * 0.12,
        z: 1 + 0.025 * Math.sin((day * TAU) / 180) ** 2,
      };
    let i = 0,
      t = day / 180;
    while (i < cameraStops.length - 2 && t > cameraStops[i + 1][0]) i++;
    const a = cameraStops[i],
      b = cameraStops[i + 1],
      u = T.MathUtils.smootherstep(t, a[0], b[0]);
    return {
      x: lerp(a[1], b[1], u),
      y: lerp(a[2], b[2], u),
      z: lerp(a[3], b[3], u),
    };
  }
  function stopRoam() {
    if (!roam) return;
    roam = false;
    targetCenter.set(cameraAim.x, cameraAim.y);
    center.copy(targetCenter);
    targetZoom = zoom;
    $("roam").setAttribute("aria-pressed", "false");
  }

  function note(text) {
    $("note").textContent = text;
    $("note").classList.add("visible");
    noteLife = 2;
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (initialView) {
      targetCenter.set(camera.aspect < 1 ? -3.65 : 0, 0);
      center.copy(targetCenter);
      initialView = false;
    }
    constrain();
    snapCamera = true;
  }
  function constrain() {
    const base = Math.min(1, ASPECT / camera.aspect),
      distance = (baseDistance * base) / (targetZoom * 1.035);
    const halfH = Math.tan(Math.PI / 12) * distance,
      halfW = halfH * camera.aspect;
    viewFrustum.set(halfW, halfH);
    targetCenter.x = clamp(
      targetCenter.x,
      -W / 2 + halfW + 0.05,
      W / 2 - halfW - 0.05,
    );
    targetCenter.y = clamp(
      targetCenter.y,
      -H / 2 + halfH + 0.035,
      H / 2 - halfH - 0.035,
    );
  }
  addEventListener("resize", resize);
  resize();
  function pointerUV(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(mouse, camera);
    if (!ray.ray.intersectPlane(imagePlane, hit)) return null;
    return new T.Vector2(hit.x / W + 0.5, hit.y / H + 0.5);
  }
  function inRiver(p) {
    if (Math.hypot((p.x - 0.29) / 0.075, (p.y - 0.225) / 0.065) < 1)
      return true;
    const falling =
      0.22 + 0.115 * (1 - Math.exp(-Math.max(0.68 - p.y, 0) * 7.5));
    if (p.y > 0.23 && p.y < 0.7 && Math.abs(p.x - falling) < 0.025) return true;
    let inside = false;
    for (let i = 0, j = river.length - 1; i < river.length; j = i++) {
      const a = river[i],
        b = river[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside;
  }
  function ripple(uv, petalsOnTouch = true) {
    uniforms.ripples.value[rippleIndex].set(uv.x, uv.y, sim, 1);
    rippleIndex = (rippleIndex + 1) % 9;
    rippleCount++;
    if (petalsOnTouch) emitPetals(uv.x, uv.y, 2);
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (paused) return;
    drag = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      age: 0,
      moved: false,
    };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    hover.set(e.clientX / innerWidth - 0.5, 0.5 - e.clientY / innerHeight);
    if (!drag || drag.id !== e.pointerId || paused) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5)
      drag.moved = true;
    if (drag.moved) {
      stopRoam();
      targetCenter.x -= ((e.clientX - drag.x) / innerWidth) * viewFrustum.x * 2;
      targetCenter.y +=
        ((e.clientY - drag.y) / innerHeight) * viewFrustum.y * 2;
      constrain();
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    if (paused || d.moved || d.age > 0.4) return;
    const uv = pointerUV(e);
    if (!uv) return;
    if (inRiver(uv)) {
      ripple(uv);
      chime();
    } else {
      if (uv.y < 0.62) bloom(uv.x, uv.y);
      emitPetals(uv.x, uv.y, 9);
      if (butterflies.filter((b) => b.temporary).length < 5)
        makeButterfly(butterflies.length, true, uv.clone());
      chime();
    }
  });
  for (const e of ["pointercancel", "lostpointercapture"])
    canvas.addEventListener(e, () => (drag = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      stopRoam();
      targetZoom = clamp(targetZoom - e.deltaY * 0.00045, 1, 1.3);
      constrain();
    },
    { passive: false },
  );
  function setPause() {
    paused = !paused;
    drag = null;
    $("pause").textContent = paused ? "▷" : "Ⅱ";
    $("pause").title = paused ? "继续" : "暂停";
    $("pause").setAttribute("aria-label", $("pause").title);
  }
  function reset() {
    sim = day = wind = 0;
    drag = null;
    paused = false;
    windOn = false;
    roam = true;
    lastAutoBloom = -1;
    nextPetal = 1;
    nextChime = 0;
    zoom = targetZoom = 1;
    targetCenter.set(camera.aspect < 1 ? -3.65 : 0, 0);
    constrain();
    center.copy(targetCenter);
    for (const b of blooms) {
      garden.remove(b.group);
      b.stem.geometry.dispose();
      b.stem.material.dispose();
      b.head.geometry.dispose();
      b.head.material.dispose();
    }
    blooms.length = 0;
    for (let i = butterflies.length - 1; i >= 0; i--) {
      const b = butterflies[i];
      if (b.temporary) {
        garden.remove(b.mesh);
        b.geo.dispose();
        b.mesh.material.dispose();
        butterflies.splice(i, 1);
      } else b.age = 0;
    }
    petals.forEach((p) => {
      p.age = 100;
      p.mesh.visible = false;
    });
    uniforms.ripples.value.forEach((r) => (r.z = -100));
    rippleCount = 0;
    nextWaterRipple = 0.7;
    $("pause").textContent = "Ⅱ";
    $("pause").title = "暂停";
    $("pause").setAttribute("aria-label", "暂停");
    $("breeze").setAttribute("aria-pressed", "false");
    $("roam").setAttribute("aria-pressed", "true");
    noteLife = 0;
    snapCamera = true;
    $("note").classList.remove("visible");
    update(0);
  }
  $("pause").onclick = setPause;
  $("reset").onclick = reset;
  $("breeze").onclick = () => {
    windOn = !windOn;
    $("breeze").setAttribute("aria-pressed", String(windOn));
  };
  $("roam").onclick = () => {
    if (roam) stopRoam();
    else {
      roam = true;
      $("roam").setAttribute("aria-pressed", "true");
    }
  };
  $("seed").onclick = () => {
    if (!paused) {
      randomBloom();
      chime();
    }
  };
  $("daytime").oninput = (e) => {
    day = +e.target.value;
    lastAutoBloom = Math.floor(day / 26);
    snapCamera = true;
    update(0);
  };
  addEventListener("keydown", (e) => {
    if (
      e.code === "Space" &&
      !["BUTTON", "INPUT"].includes(document.activeElement.tagName)
    ) {
      e.preventDefault();
      setPause();
    }
  });
  addEventListener("blur", () => (drag = null));
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    last = 0;
    drag = null;
  });
  function chime() {
    if (!soundOn || !audio || paused || hidden) return;
    const { ctx, gain } = audio,
      o = ctx.createOscillator(),
      a = ctx.createGain();
    o.type = "sine";
    o.frequency.value = [523.25, 587.33, 659.25, 783.99, 880][
      Math.floor(Math.random() * 5)
    ];
    a.gain.setValueAtTime(0, ctx.currentTime);
    a.gain.linearRampToValueAtTime(0.009, ctx.currentTime + 0.04);
    a.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.2);
    o.connect(a);
    a.connect(gain);
    o.start();
    o.stop(ctx.currentTime + 3.3);
  }
  $("sound").onclick = async () => {
    try {
      if (!audio) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (!A) throw Error();
        const ctx = new A(),
          gain = ctx.createGain();
        gain.connect(ctx.destination);
        const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate),
          a = buf.getChannelData(0);
        let b = 0;
        for (let i = 0; i < a.length; i++) {
          b = (b + (Math.random() * 2 - 1) * 0.02) / 1.02;
          a[i] = b * 3;
        }
        const source = ctx.createBufferSource(),
          filter = ctx.createBiquadFilter(),
          vol = ctx.createGain();
        source.buffer = buf;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = 750;
        vol.gain.value = 0.055;
        source.connect(filter);
        filter.connect(vol);
        vol.connect(gain);
        source.start();
        audio = { ctx, gain };
      }
      soundOn = !soundOn;
      if (soundOn) await audio.ctx.resume();
      $("sound").setAttribute("aria-pressed", String(soundOn));
      $("sound").title = soundOn ? "关闭溪流与风铃" : "开启溪流与风铃";
      $("sound").setAttribute("aria-label", $("sound").title);
      if (soundOn) chime();
    } catch (e) {
      note("暂时无法开启声音");
    }
  };
  function update(dt) {
    if (dt > 0) {
      sim += dt;
      day = (day + dt) % 180;
      if (drag) drag.age += dt;
      const held = drag && !drag.moved && drag.age > 0.35;
      wind = lerp(wind, windOn || held ? 1 : 0, 1 - Math.exp(-dt * 1.5));
      if (noteLife > 0) {
        noteLife -= dt;
        if (noteLife <= 0) $("note").classList.remove("visible");
      }
      if (sim > nextChime) {
        nextChime = sim + 8 + Math.random() * 9;
        chime();
      }
      if (sim > nextWaterRipple) {
        nextWaterRipple = sim + 2.7;
        ripple(new T.Vector2(0.327, 0.226), false);
      }
      if (sim > nextPetal) {
        nextPetal = sim + 1.6 / (1 + wind * 4);
        emitPetals(
          0.65 + Math.random() * 0.3,
          0.7 + Math.random() * 0.23,
          1 + Math.floor(wind * 2),
        );
      }
      if (Math.floor(day / 26) !== lastAutoBloom) {
        lastAutoBloom = Math.floor(day / 26);
        if (day > 1) randomBloom();
      }
    }
    const t = day / 180,
      gust = Math.sin(T.MathUtils.smoothstep(t, 0.27, 0.52) * Math.PI) * 0.2;
    uniforms.time.value = sim;
    uniforms.day.value = t;
    uniforms.wind.value = wind + gust;
    for (let i = butterflies.length - 1; i >= 0; i--) {
      const b = butterflies[i];
      if (dt > 0) b.age += dt;
      if (b.temporary && b.age > 13) {
        garden.remove(b.mesh);
        b.geo.dispose();
        b.mesh.material.dispose();
        butterflies.splice(i, 1);
        continue;
      }
      const a = sim * (0.095 + b.index * 0.005) + b.phase;
      let x, y;
      if (b.temporary) {
        x = b.origin.x + Math.sin(b.age * 0.7) * 0.045;
        y = b.origin.y + b.age * 0.02 + Math.sin(b.age) * 0.01;
      } else {
        x = 0.55 + Math.sin(a) * 0.25 + Math.sin(a * 0.42 + b.index) * 0.08;
        y = 0.48 + Math.cos(a * 0.8 + b.index) * 0.19;
      }
      const pos = uvToWorld(x, y, 0.25 + (b.index % 3) * 0.12);
      b.mesh.position.copy(pos);
      b.mesh.rotation.z = Math.sin(a + 0.4) * 0.35;
      const flap = Math.sin(sim * 6.2 + b.phase),
        p = b.geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const bx = b.base[j * 3],
          by = b.base[j * 3 + 1];
        p.setXYZ(
          j,
          bx * (0.72 + Math.cos(sim * 6.2 + b.phase) * 0.22),
          by,
          Math.abs(bx) * flap * 0.65,
        );
      }
      p.needsUpdate = true;
      const size = b.temporary ? 0.34 : 0.34 + (b.index % 3) * 0.07;
      b.mesh.scale.setScalar(size);
      b.mesh.material.opacity = b.temporary
        ? clamp((13 - b.age) / 2, 0, 1)
        : 0.87;
    }
    for (const p of petals) {
      if (p.age > p.life) {
        p.mesh.visible = false;
        continue;
      }
      if (dt > 0) {
        p.age += dt;
        p.x += (p.vx + wind * 0.018) * dt;
        p.vy -= dt * 0.004;
        p.y += p.vy * dt;
      }
      p.mesh.position.copy(
        uvToWorld(p.x + Math.sin(sim * 0.8 + p.phase) * 0.006, p.y, 0.38),
      );
      p.mesh.rotation.set(
        Math.sin(sim + p.phase) * 0.7,
        Math.cos(sim * 0.7 + p.phase) * 0.6,
        sim * 0.3 + p.phase,
      );
      p.mesh.scale.setScalar(p.size);
      p.mesh.material.opacity =
        Math.min(1, p.age) * Math.max(0, 1 - p.age / p.life) * 0.8;
    }
    for (const b of blooms) {
      if (dt > 0) b.age += dt;
      const k = T.MathUtils.smootherstep(b.age, 0, 2.7);
      b.group.scale.setScalar(Math.max(0.001, k));
      b.group.rotation.z = Math.sin(sim * 0.9 + b.phase) * (0.025 + wind * 0.1);
      b.head.rotation.z = Math.sin(sim * 0.55 + b.phase) * 0.03;
    }
    const sprinkler = [
      [0.576, 0.599],
      [0.623, 0.578],
      [0.67, 0.559],
    ];
    for (let i = 0; i < 180; i++) {
      const head = sprinkler[i % 3],
        age = (sim * (i < 120 ? 0.6 : 0.8) + i * 0.618) % 1,
        spread = Math.sin(i * 91.7) * (0.01 + age * 0.009);
      const y = i < 120 ? head[1] - age * 0.083 : 0.68 - age * 0.45,
        x =
          i < 120
            ? head[0] + spread * age
            : 0.22 +
              0.115 * (1 - Math.exp(-Math.max(0.68 - y, 0) * 7.5)) +
              Math.sin(i * 11.3) * 0.009;
      const a = uvToWorld(x, y, 0.13),
        b = uvToWorld(x + 0.0003, y - 0.003, 0.13);
      dropPositions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    dropGeo.attributes.position.needsUpdate = true;
    dropMat.opacity = 0.3 + 0.08 * Math.sin(t * Math.PI) ** 2;
    for (let i = 0; i < 52; i++) {
      const age = (sim * 1.22 + i * 0.618033) % 1,
        side = Math.sin(i * 23.7),
        x = 0.327 + side * age * 0.03,
        y =
          0.225 +
          Math.sin(age * Math.PI) * (0.012 + (i % 5) * 0.002) -
          age * 0.008;
      const a = uvToWorld(x, y, 0.22),
        b = uvToWorld(x + side * 0.0008, y - 0.0017, 0.22);
      splashPositions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    splashGeo.attributes.position.needsUpdate = true;
    for (const f of foamPieces) {
      const age = (sim * 0.8 + f.phase) % 1,
        x = 0.327 + f.side * (0.007 + age * 0.035),
        y = 0.222 + f.y - age * 0.013 + Math.sin(age * Math.PI) * 0.005;
      f.mesh.position.copy(uvToWorld(x, y, 0.24));
      const scale = f.size * (0.5 + age * 0.9);
      f.mesh.scale.set(scale * 1.7, scale * 1.2, 1);
      f.mesh.rotation.z = f.side * 0.13 + Math.sin(sim + f.phase) * 0.05;
      f.mesh.material.opacity = Math.sin(age * Math.PI) * 0.75;
    }
    const dusk =
      T.MathUtils.smoothstep(t, 0.65, 0.85) *
      (1 - T.MathUtils.smoothstep(t, 0.94, 1));
    fireflies.forEach((f) => {
      f.s.position.copy(
        uvToWorld(
          f.x + Math.sin(sim * 0.23 + f.phase) * 0.015,
          f.y + Math.sin(sim * 0.3 + f.phase) * 0.012,
          0.45,
        ),
      );
      f.s.material.opacity =
        dusk * (0.3 + 0.7 * Math.sin(sim * 0.9 + f.phase) ** 2) * 0.45;
    });
    const routeGoal = roam
        ? route()
        : { x: targetCenter.x, y: targetCenter.y, z: targetZoom },
      alpha = snapCamera ? 1 : 1 - Math.exp(-dt * 2);
    zoom = lerp(zoom, routeGoal.z, alpha);
    center.lerp(new T.Vector2(routeGoal.x, routeGoal.y), alpha);
    snapCamera = false;
    const base = Math.min(1, ASPECT / camera.aspect),
      distance = (baseDistance * base) / (zoom * 1.035),
      halfH = Math.tan(Math.PI / 12) * distance;
    viewFrustum.set(halfH * camera.aspect, halfH);
    const slackX = Math.max(0, W / 2 - viewFrustum.x - 0.045),
      slackY = Math.max(0, H / 2 - viewFrustum.y - 0.035),
      cx = clamp(center.x, -slackX, slackX),
      cy = clamp(center.y, -slackY, slackY);
    camera.position.set(cx + hover.x * 0.055, cy + hover.y * 0.025, distance);
    cameraAim.set(cx, cy, 0);
    camera.lookAt(cameraAim);
    camera.updateMatrixWorld();
    $("phase").textContent =
      t < 0.18
        ? "晨露"
        : t < 0.38
          ? "花开"
          : t < 0.58
            ? "微风"
            : t < 0.76
              ? "暖阳"
              : t < 0.94
                ? "暮光"
                : "晨光";
    $("daytime").value = day;
    $("daytime").style.setProperty("--progress", (day / 180) * 100 + "%");
    $("daytime").setAttribute("aria-valuetext", $("phase").textContent);
    $("hint").style.opacity = sim < 13 ? "1" : "0";
    $("hint").textContent =
      camera.aspect < 1
        ? "拖动看花园 · 轻点开花 · 按住起风"
        : "轻点开花 · 轻触水面 · 按住起风";
    renderer.render(scene, camera);
  }
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
    last = now;
    if (!hidden) update(paused ? 0 : dt);
    if (audio)
      audio.gain.gain.setTargetAtTime(
        soundOn && !paused && !hidden ? 1 : 0,
        audio.ctx.currentTime,
        0.2,
      );
  }
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    paused = true;
    $("loading").style.display = "grid";
    $("loading").style.opacity = "1";
    $("load-text").textContent = "花园暂时休息了";
    $("load-error").textContent = "刷新页面即可重新展开。";
  });
  update(0);
  $("loading").style.opacity = "0";
  $("loading").style.pointerEvents = "none";
  $("loading").addEventListener(
    "transitionend",
    () => {
      $("loading").style.display = "none";
    },
    { once: true },
  );
  requestAnimationFrame(tick);
  Object.defineProperty(window, "gardenStatus", {
    get: () => ({
      day,
      sim,
      paused,
      wind,
      windOn,
      roam,
      gears: 0,
      waterFlowPhase: (sim * 0.19) % 1,
      waterfallFlowPhase: (sim * 0.62) % 1,
      rippleCount,
      flowers: blooms.length,
      butterflies: butterflies.length,
      petals: petals.filter((p) => p.age < p.life).length,
      drawCalls: renderer.info.render.calls,
      assetsReady: true,
      view: { x: cameraAim.x, y: cameraAim.y, zoom },
      waterwheel: false,
      bakedWaterfall: false,
      waterLayers: ["flowing-ribbon", "animated-spray", "animated-foam"],
      hotspots: [],
    }),
  });
})();
