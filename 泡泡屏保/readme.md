## 说在前面

> 还记得小时候在电脑上看到过这样一个泡泡屏保动画，那时候就觉得很有趣，感觉这个动画可以看一天。现在好像没怎么看到这个屏保动画了，今天就让我们一起来回味一下童年，实现一个这个经典的泡泡屏保动画。

![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/75898bd9a23748ac9bb2039dcdc2be7f~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=FQ61NW1QjEHCcG0gDvLs7mR3j2M%3D)

![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/aeaf276d7c6345c0b1af2722987ce200~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=VqU%2Fph6iL0XRv7aUP%2BWHDSD2f3g%3D)

### 泡泡样式绘制

#### 泡泡基础样式

```css
.bubble {
  position: absolute;
  border-radius: 50%;
}
```

#### 高光效果

```css
.bubble::before {
  content: "";
  position: absolute;
  top: 12%;
  left: 20%;
  width: 15%;
  height: 6%;
  border-radius: 30%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 40%,
    rgba(255, 255, 255, 0.3) 80%,
    rgba(255, 255, 255, 0) 95%
  );
  transform: rotate(332deg);
  opacity: 0.8;
}
```

- 通过伪元素实现高光区域
- 线性渐变模拟光影过渡
- 332 度旋转产生倾斜效果

![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/f58ea6c8ddcb49e5b4b1081d1ae76d8c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=qEOd%2F%2BRXVX8FJQ8YDvUTaxag5KA%3D)

#### 阴影类

设置几个不同颜色的阴影类，随机给泡泡加上

```css
.bubble-shadow1 {
  box-shadow: inset 0 0 10px rgba(250, 188, 123, 1), 0 0 5px rgba(250, 188, 123, 0.8);
}
.bubble-shadow2 {
  box-shadow: inset 0 0 10px rgba(21, 165, 237, 1), 0 0 5px rgba(21, 165, 237, 0.8);
}
.bubble-shadow3 {
  box-shadow: inset 0 0 10px rgba(123, 24, 125, 1), 0 0 5px rgba(123, 24, 125, 0.8);
}
.bubble-shadow4 {
  box-shadow: inset 0 0 10px rgba(146, 241, 2, 1), 0 0 5px rgba(146, 241, 2, 0.8);
}
.bubble-shadow5 {
  box-shadow: inset 0 0 10px rgba(245, 58, 58, 1), 0 0 5px rgba(245, 58, 58, 0.8);
}
```

### 泡泡动画实现

#### 初始化参数

```javascript
const list = [
  {
    r: 200,
    left: 0,
    top: 0,
    leftStep: 1,
    topStep: 2,
    flag: true,
  },
  {
    r: 120,
    left: 0,
    top: 0,
    leftStep: 2.5,
    topStep: 2.5,
    flag: true,
  }
  ...
];
```

- **r**：泡泡的半径
- **left**：泡泡的初始 x 坐标
- **top**：泡泡的初始 y 坐标
- **leftStep**：泡泡在 x 轴方向的初始速度
- **topStep**：泡泡在 y 轴方向的初始速度
- **flag**：判断泡泡是否与其它泡泡发生重叠

#### 根据配置列表生成泡泡

```javascript
function initBubble() {
  list.forEach((item, index) => {
    const bubble = document.createElement("div");
    const num = getRandom(1, 5);
    bubble.id = "bubble-" + index;
    bubble.classList.add("bubble");
    bubble.classList.add("bubble-shadow" + num);
    bubble.style.width = item.r + "px";
    bubble.style.height = item.r + "px";
    bubble.style.left = item.left + "px";
    bubble.style.top = item.top + "px";
    document.body.appendChild(bubble);
  });
}
```

#### 让泡泡动起来

##### 1、泡泡运动控制

```javascript
item.left += item.leftStep;
item.top += item.topStep;
bubble.style.left = item.left + "px";
bubble.style.top = item.top + "px";
```

- **位置计算**：每个泡泡的位置按步长（leftStep/topStep）持续更新
- **DOM 更新**：将计算后的位置同步到页面元素

##### 2、边界反弹逻辑

- **位置限制**：确保泡泡始终在视口范围内

```javascript
item.left = Math.max(0, Math.min(item.left, window.innerWidth - item.r));
item.top = Math.max(0, Math.min(item.top, window.innerHeight - item.r));
```

- **触壁反弹**：触碰到边界的时候将移动方向置反

```javascript
if (item.left >= window.innerWidth - item.r || item.left <= 0) {
  item.leftStep *= -1;
}
if (item.top >= window.innerHeight - item.r || item.top <= 0) {
  item.topStep *= -1;
}
```

##### 3、泡泡碰撞检测

比较圆心距离和两个半径和大小关系即可。

- **圆心距离 == 半径和**

  ![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d02b330271e54ba69557f38036d16068~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=SmI%2F7z1pySeXNfsh6gt%2FO6V3q7I%3D)

- **圆心距离 < 半径和**

  ![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/6b8c00fcd60b4bb1bec04e9653713734~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=bzRgwtlOPLjXC%2BhlMwR0HInLXJg%3D)

- **圆心距离 > 半径和**

  ![](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b744d1e6bac94d40bfd0d0c0e0bb2906~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAgSlllb250dQ==:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQwMjQ0MjkwNzI3Mjk0In0%3D&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1743245005&x-orig-sign=A0QsX0zXzfH4ekf1t0FU6Bmnfnk%3D)

```javascript
function isColliding(bubble1, bubble2) {
  const dx = bubble1.left + bubble1.r / 2 - (bubble2.left + bubble2.r / 2);
  const dy = bubble1.top + bubble1.r / 2 - (bubble2.top + bubble2.r / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= (bubble1.r + bubble2.r) / 2;
}
```

##### 4、弹性碰撞计算

###### （1）原始数据计算

弹性碰撞是指在碰撞过程中，两个物体的总动能和总动量都保持不变。

- **质量计算**：用泡泡的宽度乘以高度来近似表示泡泡的质量，即 **m1** 和 **m2**。在实际物理场景中，质量与物体的密度和体积有关，但这里简化处理。

```javascript
const m1 = bubble1.r * bubble1.r * Math.PI;
const m2 = bubble2.r * bubble2.r * Math.PI;
```

- **速度获取**：**v1x** 和 **v1y** 分别是泡泡 1 在水平和垂直方向上的速度分量；**v2x** 和 **v2y** 分别是泡泡 2 在水平和垂直方向上的速度分量。

```javascript
const v1x = bubble1.leftStep;
const v1y = bubble1.topStep;
const v2x = bubble2.leftStep;
const v2y = bubble2.topStep;
```

- **位置获取**：**x1**、**y1** 是泡泡 1 的圆心坐标；**x2**、**y2** 是泡泡 2 的圆心坐标。

```javascript
const x1 = bubble1.left + bubble1.r / 2;
const y1 = bubble1.top + bubble1.r / 2;
const x2 = bubble2.left + bubble2.r / 2;
const y2 = bubble2.top + bubble2.r / 2;
```

###### （2）计算两泡泡之间的距离和法向量

```javascript
const dx = x2 - x1;
const dy = y2 - y1;
const d = Math.sqrt(dx * dx + dy * dy);
const nx = dx / d;
const ny = dy / d;
```

- **距离计算**：
  - $dx = x_2 - x_1$，表示两泡泡圆心在 $x$ 轴方向上的距离。
  - $dy = y_2 - y_1$，表示两泡泡圆心在 $y$ 轴方向上的距离。
  - $d=\sqrt{dx^2 + dy^2}$，表示两泡泡圆心之间的实际距离。
- **法向量计算**：
  - $n_x=\frac{dx}{d}$，$n_y=\frac{dy}{d}$，$n_x$ 和 $n_y$ 是两泡泡圆心连线方向的单位法向量的分量。

###### （3）计算泡泡在法向和切向的速度分量

```javascript
const v1n = v1x * nx + v1y * ny;
const v1t = v1x * -ny + v1y * nx;
const v2n = v2x * nx + v2y * ny;
const v2t = v2x * -ny + v2y * nx;
```

- **法向速度分量**：
  - $v_{1n}=v_{1x}n_x + v_{1y}n_y$，这是将泡泡 1 的速度向量投影到法向量方向上得到的法向速度分量。
  - $v_{2n}=v_{2x}n_x + v_{2y}n_y$，同理是泡泡 2 的法向速度分量。
- **切向速度分量**：
  - $v_{1t}=-v_{1x}n_y + v_{1y}n_x$，这是将泡泡 1 的速度向量投影到与法向量垂直的切向方向上得到的切向速度分量。
  - $v_{2t}=-v_{2x}n_y + v_{2y}n_x$，同理是泡泡 2 的切向速度分量。

###### （4）根据弹性碰撞公式计算碰撞后的法向速度分量

```javascript
const v1nFinal = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2);
const v2nFinal = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2);
```

这两个公式是基于弹性碰撞的动量守恒和动能守恒定律推导出来的。对于一维弹性碰撞，设两个物体的质量分别为 $m_1$ 和 $m_2$，碰撞前的速度分别为 $u_1$ 和 $u_2$，碰撞后的速度分别为 $v_1$ 和 $v_2$，则有：

- 动量守恒：$m_1u_1 + m_2u_2 = m_1v_1 + m_2v_2$
- 动能守恒：$\frac{1}{2}m_1u_1^2+\frac{1}{2}m_2u_2^2=\frac{1}{2}m_1v_1^2+\frac{1}{2}m_2v_2^2$

联立这两个方程求解可得：

- $v_1=\frac{(m_1 - m_2)u_1 + 2m_2u_2}{m_1 + m_2}$
- $v_2=\frac{(m_2 - m_1)u_2 + 2m_1u_1}{m_1 + m_2}$

这里将上述公式应用到法向速度分量上，$v_{1nFinal}$ 是泡泡 1 碰撞后的法向速度分量，$v_{2nFinal}$ 是泡泡 2 碰撞后的法向速度分量。

###### （5）计算碰撞后的水平和垂直速度分量

```javascript
const v1xFinal = v1nFinal * nx - v1t * ny;
const v1yFinal = v1nFinal * ny + v1t * nx;
const v2xFinal = v2nFinal * nx - v2t * ny;
const v2yFinal = v2nFinal * ny + v2t * nx;
```

这是将碰撞后的法向速度分量和切向速度分量重新组合成水平和垂直方向的速度分量。具体来说，是通过向量的合成来实现的。

- 对于泡泡 1：
  - $v_{1xFinal}=v_{1nFinal}n_x - v_{1t}n_y$
  - $v_{1yFinal}=v_{1nFinal}n_y + v_{1t}n_x$
- 对于泡泡 2：
  - $v_{2xFinal}=v_{2nFinal}n_x - v_{2t}n_y$
  - $v_{2yFinal}=v_{2nFinal}n_y + v_{2t}n_x$

###### （6）更新泡泡的速度

```javascript
if (!bubble1.flag) {
  bubble1.leftStep = v1xFinal;
  bubble1.topStep = v1yFinal;
}
if (!bubble2.flag) {
  bubble2.leftStep = v2xFinal;
  bubble2.topStep = v2yFinal;
}
```

这里使用 `flag` 标志用于判断当前泡泡是否有与其它泡泡发生重叠的情况，如果有重叠，就先不处理该跑跑的弹性碰撞。反之则更新泡泡在水平和垂直方向上的速度分量，即 `leftStep` 和 `topStep`。

> 通过简单的物理计算模拟了两个泡泡之间的弹性碰撞，并根据计算结果更新它们的速度，从而粗略地实现了碰撞后的反弹效果。

## 源码

组件源码已上传到**gitee**，有兴趣的也可以到这里看看：[https://gitee.com/zheng_yongtao/video-code](https://gitee.com/zheng_yongtao/video-code)

---

- 🌟 觉得有帮助的可以点个 star\~
- 🖊 有什么问题或错误可以指出，欢迎 pr\~
- 📬 有什么想要实现的组件或想法可以联系我\~

---

## 公众号

关注公众号『 **前端也能这么有趣** 』，获取更多有趣内容。

发送 **加群** 还可以加入群聊，一起来学习（摸鱼）吧\~

## 说在后面

> 🎉 这里是 JYeontu，现在是一名前端工程师，有空会刷刷算法题，平时喜欢打羽毛球 🏸 ，平时也喜欢写些东西，既为自己记录 📋，也希望可以对大家有那么一丢丢的帮助，写的不好望多多谅解 🙇，写错的地方望指出，定会认真改进 😊，偶尔也会在自己的公众号『`前端也能这么有趣`』发一些比较有趣的文章，有兴趣的也可以关注下。在此谢谢大家的支持，我们下文再见 🙌。
