      const stage = document.getElementById("stage");
      const stageShell = document.getElementById("stage-shell");
      const stageWrap = document.querySelector(".stage-wrap");
      const bgUpload = document.getElementById("bg-upload");
      const layersUpload = document.getElementById("layers-upload");
      const layerList = document.getElementById("layer-list");
      const statusText = document.getElementById("status-text");

      const stageWidthInput = document.getElementById("stage-width");
      const stageHeightInput = document.getElementById("stage-height");
      const applyStageSizeButton = document.getElementById("apply-stage-size");
      const hoverScaleRangeInput = document.getElementById("hover-scale-range");
      const hoverScaleNumberInput = document.getElementById("hover-scale-number");

      const clearBgButton = document.getElementById("clear-bg");
      const layerUpButton = document.getElementById("layer-up");
      const layerDownButton = document.getElementById("layer-down");
      const layerTopButton = document.getElementById("layer-top");
      const layerBottomButton = document.getElementById("layer-bottom");
      const removeLayerButton = document.getElementById("remove-layer");
      const exportButton = document.getElementById("export-html");

      const layerXInput = document.getElementById("layer-x");
      const layerYInput = document.getElementById("layer-y");
      const layerWInput = document.getElementById("layer-w");
      const layerHInput = document.getElementById("layer-h");
      const applyLayerRectButton = document.getElementById("apply-layer-rect");

      const MIN_LAYER_SIZE = 20;
      const HANDLE_DIRECTIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

      let backgroundSrc = "";
      let layers = [];
      let selectedLayerId = null;
      let layerIdSeed = 1;
      let interactionState = null;
      let stageScale = 1;
      let hoverScale = 1.3;
      let hoveredLayerId = null;

      function setStatus(message, isError = false) {
        statusText.textContent = message;
        statusText.style.color = isError ? "#c81e1e" : "#627186";
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function applyHoverScale() {
        stage.style.setProperty("--layer-hover-scale", String(hoverScale));
      }

      function setHoverScale(value) {
        const nextScale = clamp(Number(value) || 1.3, 1, 3);
        hoverScale = Math.round(nextScale * 100) / 100;
        const textValue = hoverScale.toFixed(2);
        hoverScaleRangeInput.value = textValue;
        hoverScaleNumberInput.value = textValue;
        applyHoverScale();
      }

      function getStageSize() {
        return {
          width: stage.clientWidth,
          height: stage.clientHeight,
        };
      }

      function getStageWrapInnerSize() {
        const style = getComputedStyle(stageWrap);
        const innerWidth =
          stageWrap.clientWidth -
          (parseFloat(style.paddingLeft) || 0) -
          (parseFloat(style.paddingRight) || 0);
        const innerHeight =
          stageWrap.clientHeight -
          (parseFloat(style.paddingTop) || 0) -
          (parseFloat(style.paddingBottom) || 0);
        return {
          width: Math.max(1, innerWidth),
          height: Math.max(1, innerHeight),
        };
      }

      function updateStageScale() {
        const { width: stageWidth, height: stageHeight } = getStageSize();
        const { width: wrapWidth, height: wrapHeight } = getStageWrapInnerSize();
        const widthScale = wrapWidth / stageWidth;
        const heightScale = wrapHeight / stageHeight;
        stageScale = Math.min(1, widthScale, heightScale);
        if (!Number.isFinite(stageScale) || stageScale <= 0) {
          stageScale = 1;
        }
        stage.style.transform = `scale(${stageScale})`;
        stageShell.style.width = `${Math.round(stageWidth * stageScale)}px`;
        stageShell.style.height = `${Math.round(stageHeight * stageScale)}px`;
      }

      function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      function getLayerById(id) {
        return layers.find((item) => item.id === id) || null;
      }

      function getLayersAsc() {
        return [...layers].sort((a, b) => a.zIndex - b.zIndex);
      }

      function getLayersDesc() {
        return [...layers].sort((a, b) => b.zIndex - a.zIndex);
      }

      function getMaxZIndex() {
        return layers.reduce((max, layer) => Math.max(max, layer.zIndex), 0);
      }

      function applyBackground() {
        stage.style.backgroundImage = backgroundSrc ? `url("${backgroundSrc}")` : "none";
      }

      function updateLayerElement(layer) {
        if (!layer.element) return;
        layer.element.style.left = `${layer.x}px`;
        layer.element.style.top = `${layer.y}px`;
        layer.element.style.width = `${layer.width}px`;
        layer.element.style.height = `${layer.height}px`;
        const visualZIndex =
          hoveredLayerId === layer.id ? getMaxZIndex() + 1000 : layer.zIndex;
        layer.element.style.zIndex = String(visualZIndex);
        layer.element.classList.toggle("selected", selectedLayerId === layer.id);
      }

      function clampLayerToStage(layer) {
        const { width: stageWidth, height: stageHeight } = getStageSize();
        layer.width = clamp(Math.round(layer.width), MIN_LAYER_SIZE, stageWidth);
        layer.height = clamp(Math.round(layer.height), MIN_LAYER_SIZE, stageHeight);
        layer.x = clamp(Math.round(layer.x), 0, stageWidth - layer.width);
        layer.y = clamp(Math.round(layer.y), 0, stageHeight - layer.height);
      }

      function syncActionButtons() {
        const disabled = !selectedLayerId;
        layerUpButton.disabled = disabled;
        layerDownButton.disabled = disabled;
        layerTopButton.disabled = disabled;
        layerBottomButton.disabled = disabled;
        removeLayerButton.disabled = disabled;
        applyLayerRectButton.disabled = disabled;

        layerXInput.disabled = disabled;
        layerYInput.disabled = disabled;
        layerWInput.disabled = disabled;
        layerHInput.disabled = disabled;
      }

      function syncLayerInputs() {
        const layer = getLayerById(selectedLayerId);
        if (!layer) {
          layerXInput.value = "";
          layerYInput.value = "";
          layerWInput.value = "";
          layerHInput.value = "";
          return;
        }
        layerXInput.value = layer.x;
        layerYInput.value = layer.y;
        layerWInput.value = layer.width;
        layerHInput.value = layer.height;
      }

      function renderLayerList() {
        layerList.innerHTML = "";
        const data = getLayersDesc();
        data.forEach((layer) => {
          const item = document.createElement("li");
          item.className = layer.id === selectedLayerId ? "active" : "";
          item.dataset.id = String(layer.id);

          const name = document.createElement("span");
          name.className = "layer-name";
          name.textContent = layer.name;

          const meta = document.createElement("span");
          meta.className = "layer-meta";
          meta.textContent = `z:${layer.zIndex}`;

          item.append(name, meta);
          item.addEventListener("click", () => selectLayer(layer.id));
          layerList.appendChild(item);
        });
      }

      function refreshSelectionState() {
        layers.forEach(updateLayerElement);
        renderLayerList();
        syncLayerInputs();
        syncActionButtons();
      }

      function selectLayer(id) {
        selectedLayerId = id;
        refreshSelectionState();
      }

      function normalizeZIndices() {
        const ordered = getLayersAsc();
        ordered.forEach((layer, idx) => {
          layer.zIndex = idx + 1;
        });
        layers.forEach(updateLayerElement);
        renderLayerList();
      }

      function createLayerElement(layer) {
        const layerElement = document.createElement("div");
        layerElement.className = "layer";
        layerElement.dataset.id = String(layer.id);

        const image = document.createElement("img");
        image.src = layer.src;
        image.alt = layer.name;
        image.draggable = false;
        layerElement.appendChild(image);

        HANDLE_DIRECTIONS.forEach((direction) => {
          const handle = document.createElement("span");
          handle.className = `resize-handle ${direction}`;
          handle.dataset.dir = direction;
          layerElement.appendChild(handle);
        });

        layerElement.addEventListener("mousedown", onLayerMouseDown);
        layerElement.addEventListener("click", (event) => {
          event.stopPropagation();
          selectLayer(layer.id);
        });
        layerElement.addEventListener("mouseenter", () => {
          hoveredLayerId = layer.id;
          updateLayerElement(layer);
        });
        layerElement.addEventListener("mouseleave", () => {
          if (hoveredLayerId === layer.id) {
            hoveredLayerId = null;
            updateLayerElement(layer);
          }
        });

        stage.appendChild(layerElement);
        layer.element = layerElement;
        updateLayerElement(layer);
      }

      async function addLayerFromFile(file) {
        if (!file || !file.type.startsWith("image/")) return;
        const src = await fileToDataURL(file);
        const image = new Image();
        image.src = src;

        await new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });

        const { width: stageWidth, height: stageHeight } = getStageSize();
        const maxWidth = stageWidth * 0.45;
        const maxHeight = stageHeight * 0.45;
        const sourceWidth = image.naturalWidth || 320;
        const sourceHeight = image.naturalHeight || 240;
        const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);

        const width = Math.max(MIN_LAYER_SIZE, Math.round(sourceWidth * scale));
        const height = Math.max(MIN_LAYER_SIZE, Math.round(sourceHeight * scale));
        const offset = layers.length * 14;

        const layer = {
          id: layerIdSeed++,
          name: file.name || `图层-${layerIdSeed}`,
          src,
          x: clamp(24 + offset, 0, stageWidth - width),
          y: clamp(24 + offset, 0, stageHeight - height),
          width,
          height,
          zIndex: getMaxZIndex() + 1,
          element: null,
        };

        layers.push(layer);
        createLayerElement(layer);
        normalizeZIndices();
        selectLayer(layer.id);
      }

      function removeSelectedLayer() {
        const layer = getLayerById(selectedLayerId);
        if (!layer) return;
        if (hoveredLayerId === layer.id) {
          hoveredLayerId = null;
        }
        if (layer.element) layer.element.remove();
        layers = layers.filter((item) => item.id !== layer.id);
        selectedLayerId = null;
        normalizeZIndices();
        refreshSelectionState();
      }

      function moveLayer(action) {
        const layer = getLayerById(selectedLayerId);
        if (!layer) return;

        const ordered = getLayersAsc();
        const index = ordered.findIndex((item) => item.id === layer.id);
        if (index < 0) return;

        if (action === "up" && index < ordered.length - 1) {
          const target = ordered[index + 1];
          [layer.zIndex, target.zIndex] = [target.zIndex, layer.zIndex];
        } else if (action === "down" && index > 0) {
          const target = ordered[index - 1];
          [layer.zIndex, target.zIndex] = [target.zIndex, layer.zIndex];
        } else if (action === "top") {
          layer.zIndex = getMaxZIndex() + 1;
        } else if (action === "bottom") {
          layer.zIndex = 0;
        } else {
          return;
        }

        normalizeZIndices();
        selectLayer(layer.id);
      }

      function applyLayerRectFromInputs() {
        const layer = getLayerById(selectedLayerId);
        if (!layer) return;

        const { width: stageWidth, height: stageHeight } = getStageSize();

        const nextWidth = Number(layerWInput.value);
        const nextHeight = Number(layerHInput.value);
        const width = Number.isFinite(nextWidth) ? nextWidth : layer.width;
        const height = Number.isFinite(nextHeight) ? nextHeight : layer.height;

        layer.width = clamp(Math.round(width), MIN_LAYER_SIZE, stageWidth);
        layer.height = clamp(Math.round(height), MIN_LAYER_SIZE, stageHeight);

        const nextX = Number(layerXInput.value);
        const nextY = Number(layerYInput.value);
        const x = Number.isFinite(nextX) ? nextX : layer.x;
        const y = Number.isFinite(nextY) ? nextY : layer.y;

        layer.x = clamp(Math.round(x), 0, stageWidth - layer.width);
        layer.y = clamp(Math.round(y), 0, stageHeight - layer.height);

        updateLayerElement(layer);
        syncLayerInputs();
      }

      function setStageSize(width, height) {
        const nextWidth = clamp(Math.round(Number(width) || 960), 1, 10000);
        const nextHeight = clamp(Math.round(Number(height) || 540), 1, 10000);

        stageWidthInput.value = String(nextWidth);
        stageHeightInput.value = String(nextHeight);
        stage.style.width = `${nextWidth}px`;
        stage.style.height = `${nextHeight}px`;

        layers.forEach((layer) => {
          clampLayerToStage(layer);
          updateLayerElement(layer);
        });
        syncLayerInputs();
        updateStageScale();
        return { width: nextWidth, height: nextHeight };
      }

      function applyStageSize() {
        const { width, height } = setStageSize(
          stageWidthInput.value,
          stageHeightInput.value
        );
        setStatus(`画布尺寸已更新为 ${width} x ${height}`);
      }

      function onLayerMouseDown(event) {
        if (event.button !== 0) return;

        const layerElement = event.currentTarget;
        const layerId = Number(layerElement.dataset.id);
        const layer = getLayerById(layerId);
        if (!layer) return;

        selectLayer(layerId);
        event.stopPropagation();
        event.preventDefault();

        const { width: stageWidth, height: stageHeight } = getStageSize();
        const start = {
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          right: layer.x + layer.width,
          bottom: layer.y + layer.height,
        };

        const handle = event.target.closest(".resize-handle");
        if (handle) {
          interactionState = {
            type: "resize",
            dir: handle.dataset.dir,
            layerId,
            startX: event.clientX,
            startY: event.clientY,
            start,
            stageWidth,
            stageHeight,
          };
        } else {
          interactionState = {
            type: "drag",
            layerId,
            startX: event.clientX,
            startY: event.clientY,
            start,
            stageWidth,
            stageHeight,
          };
        }
        stage.classList.add("interacting");
      }

      function onMouseMove(event) {
        if (!interactionState) return;
        const layer = getLayerById(interactionState.layerId);
        if (!layer) return;

        const dx = (event.clientX - interactionState.startX) / stageScale;
        const dy = (event.clientY - interactionState.startY) / stageScale;
        const start = interactionState.start;

        if (interactionState.type === "drag") {
          layer.x = clamp(
            Math.round(start.x + dx),
            0,
            interactionState.stageWidth - layer.width
          );
          layer.y = clamp(
            Math.round(start.y + dy),
            0,
            interactionState.stageHeight - layer.height
          );
        } else if (interactionState.type === "resize") {
          let left = start.x;
          let top = start.y;
          let right = start.right;
          let bottom = start.bottom;
          const direction = interactionState.dir;

          if (direction.includes("w")) {
            left = clamp(
              start.x + dx,
              0,
              start.right - MIN_LAYER_SIZE
            );
          }
          if (direction.includes("e")) {
            right = clamp(
              start.right + dx,
              start.x + MIN_LAYER_SIZE,
              interactionState.stageWidth
            );
          }
          if (direction.includes("n")) {
            top = clamp(
              start.y + dy,
              0,
              start.bottom - MIN_LAYER_SIZE
            );
          }
          if (direction.includes("s")) {
            bottom = clamp(
              start.bottom + dy,
              start.y + MIN_LAYER_SIZE,
              interactionState.stageHeight
            );
          }

          layer.x = Math.round(left);
          layer.y = Math.round(top);
          layer.width = Math.round(right - left);
          layer.height = Math.round(bottom - top);
          clampLayerToStage(layer);
        }

        updateLayerElement(layer);
        syncLayerInputs();
      }

      function onMouseUp() {
        interactionState = null;
        stage.classList.remove("interacting");
      }

      function buildExportHtml() {
        const state = {
          stageWidth: stage.clientWidth,
          stageHeight: stage.clientHeight,
          backgroundSrc,
          hoverScale,
          layers: getLayersAsc().map((layer) => ({
            src: layer.src,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            zIndex: layer.zIndex,
          })),
        };

        const escapeAttr = (value) =>
          String(value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const backgroundMarkup = state.backgroundSrc
          ? `<img class="bg" src="${escapeAttr(state.backgroundSrc)}" alt="" />`
          : "";

        const layersMarkup = [...state.layers]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(
            (layer) =>
              `<img class="layer" src="${escapeAttr(layer.src)}" style="left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;z-index:${
                layer.zIndex + 1
              };" alt="" />`
          )
          .join("\n      ");

        return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>导出成品</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f2f4f8;
        font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .stage {
        position: relative;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 12px 36px rgba(20, 33, 60, 0.18);
      }
      .bg {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        object-fit: fill;
        z-index: 0;
      }
      .layer {
        position: absolute;
        object-fit: fill;
        transform-origin: center center;
        transition: transform 0.16s ease;
      }
      .layer:hover {
        transform: scale(${hoverScale});
      }
    </style>
  </head>
  <body>
    <div class="stage" style="width:${state.stageWidth}px;height:${state.stageHeight}px;">
      ${backgroundMarkup}
      ${layersMarkup}
    </div>
  </body>
</html>`;
      }

      function downloadFile(content, filename) {
        const blob = new Blob([content], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      function exportHTML() {
        const html = buildExportHtml();
        const now = new Date();
        const pad2 = (n) => String(n).padStart(2, "0");
        const stamp =
          now.getFullYear() +
          pad2(now.getMonth() + 1) +
          pad2(now.getDate()) +
          "_" +
          pad2(now.getHours()) +
          pad2(now.getMinutes()) +
          pad2(now.getSeconds());
        downloadFile(html, `composition_${stamp}.html`);
        setStatus("已导出 HTML 文件");
      }

      bgUpload.addEventListener("change", async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          setStatus("背景图必须是图片格式", true);
          return;
        }
        backgroundSrc = await fileToDataURL(file);
        const bgImage = new Image();
        bgImage.src = backgroundSrc;
        await new Promise((resolve) => {
          bgImage.onload = resolve;
          bgImage.onerror = resolve;
        });

        const bgWidth = bgImage.naturalWidth || stage.clientWidth || 960;
        const bgHeight = bgImage.naturalHeight || stage.clientHeight || 540;
        const nextSize = setStageSize(bgWidth, bgHeight);

        applyBackground();
        setStatus(`背景已更新：${file.name}（画布 ${nextSize.width} x ${nextSize.height}）`);
        bgUpload.value = "";
      });

      clearBgButton.addEventListener("click", () => {
        backgroundSrc = "";
        applyBackground();
        setStatus("背景已清除");
      });

      layersUpload.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        for (const file of files) {
          try {
            await addLayerFromFile(file);
          } catch (error) {
            setStatus(`图层加载失败：${file.name}`, true);
          }
        }
        setStatus(`已上传 ${files.length} 个图层`);
        layersUpload.value = "";
      });

      stage.addEventListener("mousedown", (event) => {
        if (event.target === stage) {
          selectLayer(null);
        }
      });

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);

      applyStageSizeButton.addEventListener("click", applyStageSize);
      layerUpButton.addEventListener("click", () => moveLayer("up"));
      layerDownButton.addEventListener("click", () => moveLayer("down"));
      layerTopButton.addEventListener("click", () => moveLayer("top"));
      layerBottomButton.addEventListener("click", () => moveLayer("bottom"));
      removeLayerButton.addEventListener("click", removeSelectedLayer);
      applyLayerRectButton.addEventListener("click", applyLayerRectFromInputs);
      exportButton.addEventListener("click", exportHTML);
      window.addEventListener("resize", updateStageScale);
      hoverScaleRangeInput.addEventListener("input", (event) =>
        setHoverScale(event.target.value)
      );
      hoverScaleNumberInput.addEventListener("input", (event) =>
        setHoverScale(event.target.value)
      );

      syncActionButtons();
      applyBackground();
      setHoverScale(1.3);
      setStageSize(stageWidthInput.value, stageHeightInput.value);
