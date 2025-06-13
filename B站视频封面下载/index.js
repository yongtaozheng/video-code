javascript: (async () => {
  const img = document.querySelector("#wxwork-share-pic").src.split("@")[0];
  const title = document.querySelector(
    "#viewbox_report > div.video-info-title > div > h1"
  ).innerText;
  try {
    const response = await fetch(img);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = title + img.substring(img.lastIndexOf("."));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("下载图片失败:", error);
    alert("下载失败，请检查图片URL是否有效");
  }
})();
