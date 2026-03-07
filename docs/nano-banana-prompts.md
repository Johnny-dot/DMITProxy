# Prism 背景图生成 Prompts — Nano Banana 2

## 核心原则
- **不要任何具体物体**（不要棱镜、不要水晶、不要彩虹弓形）
- 只描述**光线、氛围、色调**
- 留白多、不杂乱，登录框要压得住背景

---

## 图 1：`login-bg.webp`（深色主题登录背景）

**尺寸：** 1920 × 1080px，横向，WebP，≤ 300KB

**Prompt：**
```
Extremely dark background, near-black deep navy base,
two very soft glowing halos of light — one cool indigo bloom
in the upper-left corner, one faint emerald glow in the lower-right,
both blurred beyond recognition like city lights seen through foggy glass,
no objects, no shapes, no patterns, no text,
pure atmosphere, cinematic, ultra minimal,
resembles a long-exposure night sky without stars
```

**参考感觉：** Linear.app 的深色背景，或 Resend 的登录页

---

## 图 2：`login-bg-light.webp`（浅色主题登录背景）

**尺寸：** 1920 × 1080px，横向，WebP，≤ 200KB

**Prompt：**
```
Very light, almost white background,
airy and clean, soft pale lavender haze in the top-left area,
whisper of warm mint tint in the bottom-right,
extremely subtle and delicate, like watercolor wash on white paper,
no objects, no shapes, completely abstract,
feels like morning light through white linen,
minimal Scandinavian aesthetic
```

**参考感觉：** Vercel 浅色主页背景，或 Stripe 的产品页

---

## 图 3：`portal-hero.webp`（用户门户欢迎区背景条）

**尺寸：** 1200 × 400px，3:1 横幅，WebP，≤ 150KB

**Prompt：**
```
Wide banner, dark charcoal background,
very soft horizontal bands of faint teal and violet light
flowing left to right like slow-moving aurora,
extremely blurred and diffuse, no hard edges,
no objects, no text, no patterns,
depth-of-field atmosphere, like northern lights seen through dark glass,
banner aspect ratio, cinematic
```

---

## 生成后的文件操作

1. 将三张图保存为对应文件名，覆盖 `public/` 目录下的旧文件
2. 生成后告知我，我来更新代码将 CSS 渐变切回图片背景

---

## 注意事项

- 如果 Nano Banana 出现任何具体物体（玻璃、水晶、彩虹弧线）→ 重新生成
- 颜色应该**极其低调**，透明度感觉在 10-20% 之间，不是鲜艳的颜色块
- 整体感觉：**"这里有光，但你说不清楚是什么"**
