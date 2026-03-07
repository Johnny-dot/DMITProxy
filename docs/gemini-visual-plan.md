# Prism 视觉美化计划 — Gemini 执行文档

## 背景说明

- 项目名：**Prism**（代理服务管理面板）
- 技术栈：React + TypeScript + Tailwind CSS v4 + Vite
- 主题系统：`data-theme="dark"` / `data-theme="light"` 挂载在 `<html>` 上，无 Tailwind `dark:` 前缀
- 主色调：`emerald-500`（绿色强调）+ `zinc-950`（深色背景）
- 静态资源目录：`public/`（当前为空，所有生成图片放这里）
- 品牌寓意：**棱镜**（光折射分散 → 隐喻代理流量分发）

---

## 任务一：登录页背景图

**文件位置：** `public/login-bg.webp`（深色版）+ `public/login-bg-light.webp`（浅色版）

**Nano Banana 2 生成提示词：**
```
Deep dark background, abstract geometric light refraction through crystal prism,
subtle rainbow spectrum scattered across the surface, ultra fine bokeh,
cinematic dark ambience, no text, minimal, 16:9 aspect ratio,
dark navy and emerald tones, suitable as a website login background
```
浅色版：将 `Deep dark` 改为 `Soft light`，`dark navy` 改为 `soft white and light gray`

**集成位置：** `src/pages/Login.tsx` 第 79 行的外层 div

```tsx
// 替换前
<div className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-5 md:p-8">

// 替换后（根据 data-theme 动态切换）
<div
  className="relative flex min-h-screen items-center justify-center p-5 md:p-8"
  style={{
    backgroundImage: `url(${document.documentElement.getAttribute('data-theme') === 'light'
      ? '/login-bg-light.webp'
      : '/login-bg.webp'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }}
>
```

同样修改 `src/pages/user/UserLogin.tsx`（结构相同）。

**性能要求：** WebP 格式，宽度 1920px，质量 80，文件 ≤ 300KB

---

## 任务二：品牌图标替换（Logo）

**文件位置：** `public/logo.svg`（矢量，所有尺寸通用）

**Nano Banana 2 生成提示词：**
```
Minimal flat icon of a glass prism splitting white light into rainbow spectrum,
clean vector style, emerald green dominant, dark background,
no text, geometric precision, app icon style, 1:1 square ratio
```
生成后导出/转为 SVG（可用 PNG 替代，放 `public/logo.png`，256×256px）。

**集成位置：**

1. `src/pages/Login.tsx` 第 97-99 行 — 替换 `<Dog>` 图标：
```tsx
// 替换前
<Dog className="h-9 w-9 text-emerald-500 lg:h-10 lg:w-10" />
// 替换后
<img src="/logo.svg" alt="Prism" className="h-9 w-9 lg:h-10 lg:w-10" />
```

2. `src/components/layout/Sidebar.tsx` — 同样替换 logo 区域的图标
3. `src/pages/user/UserLogin.tsx` — 同上
4. `index.html` — 添加 favicon：`<link rel="icon" href="/logo.svg">`

---

## 任务三：Empty State 插画

**文件位置：** `public/illustrations/` 目录下，统一 WebP 格式，320×240px，≤ 60KB

| 文件名 | 用途 | 生成提示词关键词 |
|--------|------|----------------|
| `empty-users.webp` | 无用户/客户端 | `empty user network nodes, dark minimal` |
| `empty-nodes.webp` | 无节点/入站 | `empty server rack, minimal dark style` |
| `empty-traffic.webp` | 无流量数据 | `empty chart, dark minimal, clean lines` |
| `empty-notifications.webp` | 无通知 | `empty inbox, minimal, dark background` |
| `empty-subscription.webp` | 用户无订阅 | `empty signal, no connection, minimal dark` |

**统一提示词模板：**
```
[关键词], flat illustration style, dark background zinc-950,
emerald accent color, no text, minimal linework, centered composition,
suitable for empty state in web application, 4:3 ratio
```

**集成位置：** `src/components/ui/EmptyState.tsx`

先读取该文件，然后在 `EmptyState` 组件中增加可选 `illustration` prop：
```tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: string; // public/illustrations/ 下的文件名
  action?: React.ReactNode;
}
// 渲染时在标题上方加：
{illustration && (
  <img
    src={`/illustrations/${illustration}`}
    alt=""
    className="w-40 h-30 mx-auto mb-4 opacity-70"
    loading="lazy"
  />
)}
```

然后在各页面使用：
- `src/pages/Users.tsx` → `illustration="empty-users.webp"`
- `src/pages/Nodes.tsx` → `illustration="empty-nodes.webp"`
- `src/pages/OnlineUsers.tsx` → `illustration="empty-traffic.webp"`

---

## 任务四：用户门户欢迎区背景

**文件位置：** `public/portal-hero.webp`

**Nano Banana 2 生成提示词：**
```
Abstract dark background with subtle flowing light trails and data streams,
technology network visualization, dark navy base, emerald and cyan glow,
no text, ultra wide 3:1 ratio, suitable as a web section background strip
```

**集成位置：** `src/pages/portal/HomeTab.tsx`

在页面顶部的用户信息 section 添加背景：
```tsx
<div
  className="rounded-2xl overflow-hidden relative"
  style={{ backgroundImage: 'url(/portal-hero.webp)', backgroundSize: 'cover' }}
>
  <div className="absolute inset-0 bg-zinc-950/60" /> {/* 遮罩保证文字可读 */}
  <div className="relative z-10 p-6">
    {/* 原有内容不变 */}
  </div>
</div>
```

**性能要求：** WebP，宽度 1200px，质量 75，文件 ≤ 150KB

---

## 性能总体要求

1. **格式**：全部使用 WebP，不用 PNG/JPG
2. **懒加载**：所有 `<img>` 加 `loading="lazy"`，除 logo 外
3. **尺寸**：背景图不超过 1920px 宽；插画不超过 480px 宽
4. **文件大小**：背景图 ≤ 300KB，插画 ≤ 80KB，logo SVG ≤ 10KB
5. **不做**：不加 CSS animation/keyframes 在图片上，不用 GIF

---

## 验收检查清单

完成后，请截图以下页面供验收：

- [ ] `/login` 深色主题
- [ ] `/login` 浅色主题（切换验证背景图自动替换）
- [ ] `/portal` 用户门户首页
- [ ] 任意一个空数据状态页面（如无用户时的 Users 页）
- [ ] 侧边栏 logo 区域
