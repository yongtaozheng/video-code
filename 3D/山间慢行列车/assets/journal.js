/* Project a curved sheet around the painted book's actual diagonal spine.
 * Coordinates are measured in the original 1672 × 941 illustration. */
window.createTrainJournal = function (T, carriage, landscape) {
  const canvas = document.getElementById("paper");
  const A = { x: 595, y: 740 },
    B = { x: 679, y: 851 },
    R = { x: 758, y: 720 },
    RB = { x: 862, y: 815 },
    L = { x: 408, y: 758 },
    LB = { x: 449, y: 880 };
  const duration = 1.7,
    columns = 32,
    rows = 12,
    lerp = (a, b, t) => a + (b - a) * t;
  let page = 0,
    next = 0,
    start = -Infinity,
    active = false,
    progress = 0;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch (e) {
    canvas.style.display = "none";
    return {
      turn: () => false,
      update() {},
      get page() {
        return 0;
      },
      get active() {
        return false;
      },
      get progress() {
        return 0;
      },
    };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0, 0);
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(350, 915, -550, -925, 0.1, 100);
  camera.position.z = 30;
  function geometry(left = false) {
    const g = new T.BufferGeometry(),
      vertices = [],
      uv = [],
      indices = [];
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= columns; col++) {
        const u = col / columns,
          v = row / rows,
          sx = lerp(A.x, B.x, v),
          sy = lerp(A.y, B.y, v),
          edge = left
            ? { x: lerp(L.x, LB.x, v), y: lerp(L.y, LB.y, v) }
            : { x: lerp(R.x, RB.x, v), y: lerp(R.y, RB.y, v) },
          x = lerp(sx, edge.x, u),
          y = lerp(sy, edge.y, u);
        vertices.push(x, -y, 0);
        uv.push(x / 1672, 1 - y / 941);
      }
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    return g;
  }
  const tex = new T.Texture(carriage);
  tex.colorSpace = T.SRGBColorSpace;
  tex.needsUpdate = true;
  const textures = [tex];
  for (let p = 1; p < 3; p++) {
    const cv = document.createElement("canvas");
    cv.width = 1672;
    cv.height = 941;
    const c = cv.getContext("2d");
    c.drawImage(carriage, 0, 0, 1672, 941);
    c.save();
    c.beginPath();
    c.moveTo(634, 752);
    c.lineTo(746, 741);
    c.lineTo(798, 785);
    c.lineTo(679, 807);
    c.closePath();
    c.clip();
    c.globalAlpha = 0.88;
    c.filter = "sepia(.16) saturate(.7)";
    const sw = landscape.width * 0.42,
      sx = (p === 1 ? 0.1 : 0.55) * landscape.width;
    c.drawImage(
      landscape,
      sx,
      landscape.height * 0.19,
      sw,
      landscape.height * 0.7,
      626,
      735,
      180,
      78,
    );
    c.restore();
    const t = new T.CanvasTexture(cv);
    t.colorSpace = T.SRGBColorSpace;
    textures.push(t);
  }
  const baseMaterial = new T.MeshBasicMaterial({
      map: textures[0],
      side: T.DoubleSide,
    }),
    rightBase = new T.Mesh(geometry(), baseMaterial);
  rightBase.position.z = 0.1;
  scene.add(rightBase);
  const frontGeometry = geometry(),
    backGeometry = geometry(true),
    frontMaterial = new T.MeshBasicMaterial({
      map: tex,
      side: T.FrontSide,
      transparent: true,
    }),
    backMaterial = new T.MeshBasicMaterial({
      map: tex,
      side: T.BackSide,
      transparent: true,
    });
  const front = new T.Mesh(frontGeometry, frontMaterial),
    back = new T.Mesh(backGeometry, backMaterial);
  front.frustumCulled = back.frustumCulled = false;
  front.position.z = back.position.z = 2;
  front.visible = back.visible = false;
  scene.add(front, back);
  // A separate soft shadow follows the lifted page rather than the whole book.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 256;
  shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext("2d"),
    gradient = sc.createRadialGradient(128, 64, 4, 128, 64, 110);
  gradient.addColorStop(0, "rgba(76,48,24,.25)");
  gradient.addColorStop(1, "rgba(76,48,24,0)");
  sc.fillStyle = gradient;
  sc.fillRect(0, 0, 256, 128);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(265, 113),
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.position.set(735, -799, 0.5);
  shadow.visible = false;
  scene.add(shadow);
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    renderer.render(scene, camera);
  }
  addEventListener("resize", resize);
  resize();
  function update(now) {
    if (active) {
      progress = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = progress * progress * (3 - 2 * progress),
        theta = Math.PI * eased,
        cos = Math.cos(theta),
        sin = Math.sin(theta),
        positions = frontGeometry.attributes.position;
      for (let row = 0; row <= rows; row++)
        for (let col = 0; col <= columns; col++) {
          const u = col / columns,
            v = row / rows,
            i = row * (columns + 1) + col,
            sx = lerp(A.x, B.x, v),
            sy = lerp(A.y, B.y, v),
            edge =
              cos >= 0
                ? { x: lerp(R.x, RB.x, v), y: lerp(R.y, RB.y, v) }
                : { x: lerp(L.x, LB.x, v), y: lerp(L.y, LB.y, v) },
            curl = Math.sin(Math.PI * u) * sin * 11,
            reach = Math.abs(cos) * u,
            x = sx + (edge.x - sx) * reach + sin * 5 * u * (1 - v),
            y = sy + (edge.y - sy) * reach - sin * u * 149 - curl;
          positions.setXYZ(i, x, -y, 0);
          backGeometry.attributes.position.setXYZ(i, x, -y, 0);
        }
      positions.needsUpdate = true;
      backGeometry.attributes.position.needsUpdate = true;
      frontMaterial.color.setScalar(1 - sin * 0.12);
      backMaterial.color.setScalar(0.93 + Math.abs(cos) * 0.07);
      shadow.material.opacity = sin * 0.85;
      shadow.position.x = 735 - 125 * eased;
      shadow.scale.x = 0.5 + sin * 0.6;
      if (progress >= 1) {
        page = next;
        active = false;
        front.visible = back.visible = shadow.visible = false;
      }
    }
    renderer.render(scene, camera);
  }
  return {
    turn(now) {
      if (active) return false;
      start = now;
      next = (page + 1) % textures.length;
      frontMaterial.map = textures[page];
      baseMaterial.map = textures[next];
      front.visible = back.visible = shadow.visible = true;
      progress = 0;
      active = true;
      update(now);
      return true;
    },
    update,
    get page() {
      return page;
    },
    get active() {
      return active;
    },
    get progress() {
      return progress;
    },
    duration,
  };
};
