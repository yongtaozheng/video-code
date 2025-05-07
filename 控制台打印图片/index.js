// 引入必要的库
const sharp = require("sharp");
const fs = require("fs");
const { stdout } = require("process");

//创建临时文件夹
async function createTempFolder() {
  if (!fs.existsSync(".temp")) {
    fs.mkdirSync(".temp");
  }
}

// 十六进制转 RGB 转 ANSI 256色
function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[48;2;${r};${g};${b}m`;
}

//将图片转换为颜色点阵
async function imageToColorMatrix(imagePath) {
  await createTempFolder();
  //将图片大小框高调整到不大于50，保存原有框高比
  let originalInfo = await sharp(imagePath).metadata();
  if (originalInfo.height > 50) {
    const newHeight = 50;
    const newWidth = Math.floor(
      (originalInfo.width / originalInfo.height) * newHeight
    );
    await sharp(imagePath)
      .resize(newWidth, newHeight)
      .toFile(".temp/output.jpg");
    imagePath = ".temp/output.jpg";
  }
  //将图片大小框宽调整到不大于50，保存原有框宽比
  originalInfo = await sharp(imagePath).metadata();
  if (originalInfo.width > 50) {
    const newWidth = 50;
    const newHeight = Math.floor(
      (originalInfo.height / originalInfo.width) * newWidth
    );
    await sharp(imagePath).resize(newWidth, newHeight).toFile(".temp/tmp.jpg");
    imagePath = ".temp/tmp.jpg";
  }

  // 读取图片原始数据
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 创建二维数组
  const matrix = [];
  const channels = info.channels; // 通道数（RGB=3, RGBA=4）

  for (let y = 0; y < info.height; y++) {
    const row = [];
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * channels;

      // 提取RGB(A)值
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // 转换为十六进制（忽略透明度）
      const hex = `#${[r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;

      row.push(hex);
    }
    matrix.push(row);
  }

  return matrix;
}

//在终端绘制彩色点阵
function drawInConsole(matrix) {
  const scaledWidth = matrix[0].length;
  const scaledHeight = matrix.length;

  let output = "";

  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      const hex = matrix[y][x];
      const bgColor = hexToAnsi(hex) + " ·\x1b[0m";
      output += bgColor;
    }
    output += "\n";
  }
  stdout.write("\x1Bc");
  stdout.write(output);
}

// 读取文件并绘制
imageToColorMatrix("images/漩涡鸣人.jpg")
  .then((matrix) => {
    fs.writeFileSync("output.txt", JSON.stringify(matrix, null, 2));
    drawInConsole(matrix);
  })
  .catch(console.error);
