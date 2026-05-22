# Copy Audit — 2026-05-22

Calibration reference: Login page changes already approved (登录后,继续使用你的服务。 → 登录,继续使用。 / Sign in to continue.)

Scope: `src/i18n/locales/zh-CN.ts`, `src/i18n/locales/en-US.ts` (all namespaces except `guides`), plus hardcoded `isZh ?` patterns in `src/pages/**/*.tsx` and `src/components/**/*.tsx`.

---

## Group A — Page subtitles and section headers (highest visibility)

### `dashboard.subtitle`

- **Before (ZH):** 来自 3X-UI 的实时系统与客户端指标。
- **Before (EN):** Live system and client metrics from 3X-UI.
- **After (ZH):** 3X-UI 实时系统与客户端指标。
- **After (EN):** Live system and client metrics from 3X-UI.
- **Why:** "来自 3X-UI 的" → "3X-UI" as noun adjunct. EN is already tight; no change needed.

---

### `inbounds.subtitle`

- **Before (ZH):** 管理 Xray 入站配置。
- **Before (EN):** Manage your Xray inbound configurations.
- **After (ZH):** 管理 Xray 入站配置。 _(no change — already tight)_
- **After (EN):** Manage Xray inbound configurations.
- **Why:** "your" adds nothing here; drop it.

---

### `users.subtitle`

- **Before (ZH):** 来自 3X-UI 入站的实时客户端列表。
- **Before (EN):** Live client list from 3X-UI inbounds.
- **After (ZH):** 3X-UI 入站实时客户端列表。
- **After (EN):** Live client list from 3X-UI inbounds. _(already fine)_
- **Why:** "来自…的" → attributive noun phrase.

---

### `nodes.subtitle`

- **Before (ZH):** 基于 3X-UI 入站构建的节点视图。
- **Before (EN):** Inbound-backed node view from 3X-UI.
- **After (ZH):** 3X-UI 入站节点视图。
- **After (EN):** Inbound-backed node view from 3X-UI. _(already fine)_
- **Why:** "基于…构建的" is heavy scaffolding. EN is already punchy.

---

### `nodes.intro`

- **Before (ZH):** 此页面将实时入站指标聚合为节点卡片。协议和路由调整请在"入站"页面处理。
- **Before (EN):** This page groups live inbound metrics as node cards. For protocol and route changes, use the Inbounds page.
- **After (ZH):** 实时入站指标汇总为节点卡片。协议与路由调整请在入站页操作。
- **After (EN):** Live inbound metrics grouped as node cards. Protocol and routing changes go to Inbounds.
- **Why:** "此页面将…" opener filler removed; EN "For … use the" restructured to active noun phrase.

---

### `online.subtitle`

- **Before (ZH):** 基于实时流量计数估算活跃客户端。
- **Before (EN):** Estimated active clients based on live traffic counters.
- **After (ZH):** 按实时流量计数估算活跃客户端。
- **After (EN):** Active clients estimated from live traffic counters.
- **Why:** "基于…" works; small tightening to drop "based on" passive in EN.

---

### `traffic.subtitle`

- **Before (ZH):** 汇总 3X-UI 入站与客户端的累计使用统计。
- **Before (EN):** Cumulative usage statistics aggregated from 3X-UI inbounds and clients.
- **After (ZH):** 3X-UI 入站与客户端累计使用统计。
- **After (EN):** Cumulative usage from 3X-UI inbounds and clients.
- **Why:** "汇总…的" header scaffolding; EN "statistics aggregated from" → just "from".

---

### `traffic.note`

- **Before (ZH):** 3X-UI 当前只提供累计计数，这里不代表分钟级计费统计。
- **Before (EN):** 3X-UI exposes cumulative counters only; this page does not represent per-minute billing.
- **After (ZH):** 3X-UI 仅提供累计计数，非分钟级计费统计。
- **After (EN):** 3X-UI exposes cumulative counters only, not per-minute billing.
- **Why:** "当前"（current） adds nothing; EN "this page does not represent" → "not".

---

### `subscriptions.subtitle`

- **Before (ZH):** 为指定 subId 生成并分享订阅链接。
- **Before (EN):** Generate and share subscription URLs for a specific subId.
- **After (ZH):** 按 subId 生成并分享订阅链接。
- **After (EN):** Generate and share subscription links for a subId.
- **Why:** "为指定" → "按"; "a specific" → "a".

---

### `settings.subtitle`

- **Before (ZH):** 配置面板设置，管理日常运维操作。
- **Before (EN):** Configure your panel and run maintenance tasks.
- **After (ZH):** 面板配置与运维管理。
- **After (EN):** Panel configuration and maintenance.
- **Why:** Sentence → noun phrase; drops "your" and "run … tasks".

---

### `profile.subtitle`

- **Before (ZH):** 查看当前账户偏好与信息。
- **Before (EN):** View your current preferences and account details.
- **After (ZH):** 当前账户偏好与信息。
- **After (EN):** Preferences and account details.
- **Why:** "查看" / "View your current" opener cut; noun phrase is enough for a subtitle.

---

### `userAccounts.subtitle`

- **Before (ZH):** 管理朋友账号和邀请码。
- **Before (EN):** Manage friend accounts and invite codes.
- **After (ZH):** 管理朋友账号和邀请码。 _(already tight)_
- **After (EN):** Friend accounts and invite codes.
- **Why:** Drop "Manage" — redundant when the page title says "Users & Invites".

---

## Group B — Portal onboarding and "how to use" copy

### `portal.subscriptionTitle`

- **Before (ZH):** 你的订阅链接
- **Before (EN):** Your Subscription Link
- **After (ZH):** 订阅链接
- **After (EN):** Subscription Link
- **Why:** Possessive "你的" / "Your" is redundant — the user knows it's theirs.

---

### `portal.subscriptionDesc`

- **Before (ZH):** 复制链接并导入代理客户端即可开始使用。
- **Before (EN):** Copy this link and import it into your proxy client to get started.
- **After (ZH):** 复制链接，导入代理客户端。
- **After (EN):** Copy the link and import it into your proxy client.
- **Why:** "即可开始使用" / "to get started" is pure filler.

---

### `portal.notReadyTitle`

- **Before (ZH):** 你的订阅尚未配置完成。
- **Before (EN):** Your subscription hasn't been set up yet.
- **After (ZH):** 订阅尚未配置完成。
- **After (EN):** Subscription not set up yet.
- **Why:** Drop possessive; EN contraction/passive rewritten.

---

### `portal.notReadyDesc`

- **Before (ZH):** 当前订阅还在准备中；如果长时间没有变化，可以先去帮助页看看。
- **Before (EN):** Your subscription is still being prepared. If it takes too long, open Help to see what to do next.
- **After (ZH):** 订阅准备中；长时间无变化，请查看帮助页。
- **After (EN):** Still being prepared. If it's taking too long, check Help.
- **Why:** "当前" filler; "可以先去…看看" → "请查看"; EN "to see what to do next" cut.

---

### `portal.howToUse1`

- **Before (ZH):** 先从下方列表下载兼容客户端。
- **Before (EN):** Download a compatible client from the list below.
- **After (ZH):** 从下方列表下载客户端。
- **After (EN):** Download a client from the list below.
- **Why:** "先" and "compatible" both unnecessary (list only shows compatible ones).

---

### `portal.howToUse2`

- **Before (ZH):** 复制上方订阅链接。
- **Before (EN):** Copy your subscription URL above.
- **After (ZH):** 复制上方订阅链接。 _(already fine)_
- **After (EN):** Copy the subscription URL above.
- **Why:** Drop "your".

---

### `portal.howToUse3`

- **Before (ZH):** 在客户端中选择"添加订阅"或"导入 URL"，粘贴链接。
- **Before (EN):** In the client, find "Add Subscription" or "Import URL" and paste the link.
- **After (ZH):** 在客户端选择"添加订阅"或"导入 URL"，粘贴。
- **After (EN):** In the client, choose "Add Subscription" or "Import URL" and paste.
- **Why:** "链接" / "the link" is implicit after "paste"; "find" → "choose".

---

### `portal.howToUse4`

- **Before (ZH):** 从节点列表选择服务器并连接。
- **Before (EN):** Select a server from the list and connect.
- **After (ZH):** 从节点列表选择服务器，连接。
- **After (EN):** Pick a server and connect.
- **Why:** Minor; "from the list" is implicit.

---

### `portal.needHelp`

- **Before (ZH):** 需要帮助时，直接去帮助页。
- **Before (EN):** Need help? Head to Help.
- **After (ZH):** 需要帮助？去帮助页。
- **After (EN):** Need help? Head to Help. _(already fine)_
- **Why:** "时，直接" is wordy; question form is more natural.

---

## Group C — UserLogin, UserRegister, UserResetPassword (hardcoded isZh)

### `UserLogin.tsx:58` — page title

- **Before (ZH):** 回到你的页面，继续就好。
- **Before (EN):** A simple way back to your own page.
- **After (ZH):** 回来了，继续就好。
- **After (EN):** Back to your page.
- **Why:** EN is unusually wordy for a page title; "A simple way back to your own page" = 8 words for something that fits in 3.

---

### `UserLogin.tsx:61–75` — sidebar description (hardcoded)

- **Before (ZH):** 登录后会直接回到常用的订阅、下载和帮助页面。
- **Before (EN):** Sign in and go straight back to your usual links, downloads, and help.
- **After (ZH):** 登录后直达订阅、下载、帮助。
- **After (EN):** Sign in to reach subscriptions, downloads, and help.
- **Why:** "回到常用的…页面" → noun list; EN "go straight back to your usual" is padded.

---

### `UserLogin.tsx:74–76` — body description (hardcoded)

- **Before (ZH):** 登录后可以查看订阅、下载客户端和社区入口。
- **Before (EN):** Sign in to access your subscription, downloads, and community links.
- **After (ZH):** 登录后直达订阅、下载与社区。
- **After (EN):** Sign in for subscriptions, downloads, and community links.
- **Why:** "可以查看…" and "to access your" are both verbose.

---

### `UserRegister.tsx:66` — page title

- **Before (ZH):** 先完成注册，再开始使用。
- **Before (EN):** Create your account and get started.
- **After (ZH):** 完成注册，开始使用。
- **After (EN):** Create your account and get started. _(already fine)_
- **Why:** "先" filler removed.

---

### `UserRegister.tsx:69–71` — sidebar description (hardcoded)

- **Before (ZH):** 准备好邀请码、用户名和密码，注册后会直接进入你的页面。
- **Before (EN):** Use your invite code, username, and password, then continue straight to your page.
- **After (ZH):** 邀请码、用户名、密码，注册后直达个人页。
- **After (EN):** Invite code, username, password — then straight to your page.
- **Why:** Sentence opener "准备好" / "Use your … and" replaced by comma list.

---

### `UserResetPassword.tsx:105` — page title

- **Before (ZH):** 改好密码，继续登录。
- **Before (EN):** Reset your password and sign back in.
- **After (ZH):** 改好密码，继续登录。 _(already calibrated)_
- **After (EN):** Reset your password, then sign back in.
- **Why:** "and" → "then" signals sequence more clearly; minor.

---

### `UserResetPassword.tsx:108–110` — description (hardcoded)

- **Before (ZH):** 只要链接还有效，几步就能恢复访问。
- **Before (EN):** If the link is still valid, you can restore access in a few steps.
- **After (ZH):** 链接有效时，几步恢复访问。
- **After (EN):** Valid link? A few steps to restore access.
- **Why:** EN "If the link is still valid, you can restore access in a few steps" = 14 words; can cut substantially.

---

## Group D — PublicAuthLayout highlights (hardcoded isZh)

### `PublicAuthLayout.tsx:36–38` — highlight 1 description

- **Before (ZH):** 登录后，常用入口会放在顺手的位置。
- **Before (EN):** The links you use most stay close at hand after sign-in.
- **After (ZH):** 登录后，常用入口触手可及。
- **After (EN):** Your most-used links, right at hand after sign-in.
- **Why:** EN is a 11-word awkward sentence; ZH "放在顺手的位置" → idiom "触手可及".

---

### `PublicAuthLayout.tsx:43–45` — highlight 2 description

- **Before (ZH):** 哪些已经准备好、下一步该做什么，都能快速看明白。
- **Before (EN):** You can see what is ready and what to do next at a glance.
- **After (ZH):** 哪些已就绪、下一步做什么，一眼看清。
- **After (EN):** See what's ready and what's next at a glance.
- **Why:** Both versions wordy; "You can see … at a glance" can compress.

---

### `PublicAuthLayout.tsx:50–52` — highlight 3 description

- **Before (ZH):** 按提示一步步完成，不用先理解太多术语。
- **Before (EN):** Follow the prompts step by step without learning too much jargon first.
- **After (ZH):** 按提示操作，无需熟悉术语。
- **After (EN):** Follow the prompts — no jargon needed.
- **Why:** "一步步" / "step by step" and "too much … first" padding removed.

---

## Group E — MySubscription.tsx tab intro copy (hardcoded isZh)

### `MySubscription.tsx:185` — Account overview tab title

- **Before (ZH):** 先确认你的账户状态。
- **Before (EN):** Check your account status first.
- **After (ZH):** 确认账户状态。
- **After (EN):** Check account status.
- **Why:** "先" / "first" and "你的" / "your" both removable.

---

### `MySubscription.tsx:195` — Setup tab title

- **Before (ZH):** 选好设备，跟着步骤接入。
- **Before (EN):** Pick your device and follow the setup.
- **After (ZH):** 选设备，按步骤接入。
- **After (EN):** Pick a device and follow the steps.
- **Why:** "好" is redundant; EN "your device" → "a device", "the setup" → "the steps".

---

### `MySubscription.tsx:216` — Community tab title

- **Before (ZH):** 找到你的群组和加入方式。
- **Before (EN):** Find your group links and join details.
- **After (ZH):** 群组与加入方式。
- **After (EN):** Group links and join details.
- **Why:** "找到你的" / "Find your" cut; noun phrase works.

---

## Group F — HomeTab.tsx user-facing section descriptions (hardcoded isZh)

### `HomeTab.tsx:73` — admin section title

- **Before (ZH):** 统一用户中心与管理入口
- **Before (EN):** Unified user center with management access
- **After (ZH):** 用户中心与管理入口
- **After (EN):** User center with management access
- **Why:** "统一" / "Unified" is architectural jargon the user doesn't need to see.

---

### `HomeTab.tsx:213` — Account overview subtitle

- **Before (ZH):** 你的账号和线路状态。
- **Before (EN):** Your account and route status.
- **After (ZH):** 账号与线路状态。
- **After (EN):** Account and route status.
- **Why:** Possessive "你的" / "Your" adds nothing in a section the user clearly owns.

---

### `HomeTab.tsx:217–219` — Account overview body (hardcoded)

- **Before (ZH):** 先看看订阅是否可用、流量还有多少，再继续复制链接或下载客户端。
- **Before (EN):** Check whether your subscription is ready and how much traffic is left before copying links or downloading a client.
- **After (ZH):** 确认订阅可用、流量余量，再复制链接或下载客户端。
- **After (EN):** Check that your subscription is ready and traffic is available before copying links or downloading.
- **Why:** "先看看…" opener + "继续" filler cut; EN shortens to one clause.

---

### `HomeTab.tsx:279` — upload tooltip (hardcoded)

- **Before (ZH):** 这是你已经上传的流量。
- **Before (EN):** This is the traffic you have uploaded.
- **After (ZH):** 已上传流量。
- **After (EN):** Traffic you've uploaded.
- **Why:** "这是你已经" scaffolding removed entirely.

---

### `HomeTab.tsx:316` — Usage section subtitle (hardcoded)

- **Before (ZH):** 当前流量、到期时间与连接状态
- **Before (EN):** Traffic, expiry, and connection status
- **After (ZH):** 流量、到期时间与连接状态
- **After (EN):** Traffic, expiry, and connection status _(already fine)_
- **Why:** "当前" is redundant in a real-time panel — everything is current.

---

### `HomeTab.tsx:332` — empty usage state (hardcoded)

- **Before (ZH):** 暂时没有可用的流量数据，请稍后再试。
- **Before (EN):** No usage data is available yet.
- **After (ZH):** 暂无流量数据，稍后再试。
- **After (EN):** No usage data yet.
- **Why:** "可用的" / "is available" verbose; "请稍后再试" is implicit.

---

### `HomeTab.tsx:473` — Announcements section subtitle (hardcoded)

- **Before (ZH):** 公告与联系渠道
- **Before (EN):** Announcements and support
- **After (ZH):** 公告与联系渠道 _(already tight)_
- **After (EN):** Announcements and support _(already tight)_
- **Why:** Both versions already concise — no change needed.

---

### `HomeTab.tsx:494` — Empty announcements state (hardcoded)

- **Before (ZH):** 暂时还没有新的说明。
- **Before (EN):** No new notes yet.
- **After (ZH):** 暂无新说明。
- **After (EN):** No new notes yet. _(already fine)_
- **Why:** "暂时还没有新的" → "暂无新".

---

## Group G — NotificationsTab.tsx (hardcoded isZh)

### `NotificationsTab.tsx:87` — section heading

- **Before (ZH):** 订阅提醒与服务通知
- **Before (EN):** Subscription updates and service notices
- **After (ZH):** 订阅提醒与服务通知 _(already tight)_
- **After (EN):** Subscription and service notices
- **Why:** "updates and … notices" is redundant — both are notices. Minor EN trim.

---

### `NotificationsTab.tsx:94–100` — inline description variant (hardcoded)

- **Before (ZH):** 有新消息时，会显示在这里。/ 订阅状态、服务说明和联系信息会按时间显示。
- **Before (EN):** New updates appear here. / Subscription status, service notes, and contact info are shown in time order.
- **After (ZH):** 新消息显示在这里。/ 订阅状态、服务说明、联系信息按时间排列。
- **After (EN):** New updates appear here. / Subscription status, service notes, and contact info, newest first.
- **Why:** "会按时间显示" → "按时间排列"; EN "are shown in time order" → "newest first".

---

## Group H — CommunityTab.tsx helper strings (hardcoded isZh)

### `CommunityTab.tsx:92` — description with URL + QR

- **Before (ZH):** 可以直接点击链接，或扫描右侧二维码加入。
- **Before (EN):** Open the invite link or scan the QR code to join.
- **After (ZH):** 点击链接或扫描二维码加入。
- **After (EN):** Open the invite link or scan the QR code to join. _(already fine)_
- **Why:** "可以直接" filler removed.

---

### `CommunityTab.tsx:97` — description with QR image only

- **Before (ZH):** 使用二维码加入。
- **Before (EN):** Use the QR code to join.
- **After (ZH):** 扫码加入。
- **After (EN):** Scan the QR to join.
- **Why:** "使用二维码" → "扫码"; "the QR code" → "the QR".

---

### `CommunityTab.tsx:104` — coming soon state

- **Before (ZH):** 社区入口即将开放。
- **Before (EN):** This entry will open soon.
- **After (ZH):** 社区入口即将开放。 _(already fine)_
- **After (EN):** Coming soon.
- **Why:** EN "This entry will open soon" is 5 words for a 2-word status.

---

### `CommunityTab.tsx:175–178` — empty state

- **Before (ZH):** 暂时还没有开放的社群入口。/ 发布后会直接显示在这里。
- **Before (EN):** No community links are available yet. / Published community links will appear here.
- **After (ZH):** 暂无社群入口。/ 发布后显示在这里。
- **After (EN):** No community links yet. / Published links will appear here.
- **Why:** "暂时还没有开放的" → "暂无"; EN "are available" cut; second line drops "community" (already implied).

---

## Group I — NodeQualityCard.tsx (hardcoded isZh)

### `NodeQualityCard.tsx:240` — empty state

- **Before (ZH):** 现在还没有可以展示的检测结果。
- **Before (EN):** There are no check results to show yet.
- **After (ZH):** 暂无检测结果。
- **After (EN):** No check results yet.
- **Why:** "现在还没有可以展示的" is 8 chars of scaffolding; EN "There are … to show" is padded passive.

---

## Group J — MirrorDownloadDialog.tsx (hardcoded isZh)

### `MirrorDownloadDialog.tsx:136`

- **Before (ZH):** 暂时无法获取当前镜像状态。
- **Before (EN):** Unable to load the current mirror status.
- **After (ZH):** 无法获取镜像状态。
- **After (EN):** Unable to load mirror status.
- **Why:** "暂时" / "current" both superfluous — error is error.

---

### `MirrorDownloadDialog.tsx:167`

- **Before (ZH):** 已在新标签页打开镜像下载。
- **Before (EN):** Mirror download opened in a new tab.
- **After (ZH):** 已在新标签页打开镜像下载。 _(already tight)_
- **After (EN):** Mirror download opened in a new tab. _(already fine)_
- **Why:** No change — both already concise.

---

### `MirrorDownloadDialog.tsx:179`

- **Before (ZH):** 正在检查镜像状态。
- **Before (EN):** Checking the mirror status.
- **After (ZH):** 正在检查镜像状态。 _(already fine)_
- **After (EN):** Checking mirror status.
- **Why:** Drop "the" — minor.

---

### `MirrorDownloadDialog.tsx:261`

- **Before (ZH):** 首次请求时由服务器准备
- **Before (EN):** Prepared by the server on first request
- **After (ZH):** 首次请求时服务器准备
- **After (EN):** Built on first request
- **Why:** EN passive "Prepared by the server" → active "Built"; ZH drops "由".

---

## Group K — `userAuth` namespace

### `userAuth.createDesc`

- **Before (ZH):** 填好邀请码、用户名和密码，即可创建账号。
- **Before (EN):** Enter your invite code, username, and password to create your account.
- **After (ZH):** 邀请码、用户名、密码，即可创建账号。
- **After (EN):** Enter your invite code, username, and password to create an account.
- **Why:** "填好" opener replaced by noun list (ZH); EN "your account" → "an account".

---

### `userAuth.resetDesc`

- **Before (ZH):** 打开有效重置链接后即可设置新密码。
- **Before (EN):** Open a valid reset link to set a new password.
- **After (ZH):** 有效重置链接打开后即可设置新密码。
- **After (EN):** Open a valid reset link to set a new password. _(already fine)_
- **Why:** ZH minor restructure; EN is already compact.

---

### `userAuth.resetSuccess`

- **Before (ZH):** 密码已重置，请重新登录。
- **Before (EN):** Password has been reset. Please sign in again.
- **After (ZH):** 密码已重置，请重新登录。 _(already fine)_
- **After (EN):** Password reset. Sign in again.
- **Why:** EN "has been" passive unnecessarily heavy for a toast.

---

### `userAuth.adminUseLogin`

- **Before (ZH):** 这个账号需要从主登录页进入，请回到 /login。
- **Before (EN):** This account should be used from the main sign-in page at /login.
- **After (ZH):** 此账号请从 /login 登录。
- **After (EN):** Use the main sign-in page at /login.
- **Why:** Both versions over-explain; the path `/login` is the key info.

---

## Group L — `userAccounts` namespace

### `userAccounts.registrationTip`

- **Before (ZH):** 开启"自动创建"后，新用户注册时会自动分配 3X-UI 账号。你也可以在这里手动设置 subId。
- **Before (EN):** With auto-provision on, new users get a 3X-UI account automatically when they register. You can also set the subId manually here.
- **After (ZH):** 启用自动创建后，注册即自动分配 3X-UI 账号；也可在此手动设置 subId。
- **After (EN):** With auto-provision on, new users automatically get a 3X-UI account. You can also assign subId manually.
- **Why:** ZH: "你也可以在这里手动设置" → "也可在此手动设置"; EN: "when they register" cut (implied), "here" → "manually".

---

### `userAccounts.autoProvisionOff`

- **Before (ZH):** 自动创建未开启，新用户需要手动分配 subId。
- **Before (EN):** Auto-provision is off. New users will need manual subId assignment.
- **After (ZH):** 自动创建未开启，新用户需手动分配 subId。
- **After (EN):** Auto-provision off. New users need manual subId assignment.
- **Why:** Minor tightening; "will need" → "need"; ZH "需要" → "需".

---

### `userAccounts.noInviteCodes`

- **Before (ZH):** 还没有邀请码，点击"生成"创建。
- **Before (EN):** No invite codes yet. Click Generate to create one.
- **After (ZH):** 还没有邀请码，点击生成。
- **After (EN):** No invite codes yet. Click Generate.
- **Why:** "创建" / "to create one" is redundant after "Generate".

---

### `userAccounts.deleteUserConfirm`

- **Before (ZH):** 确认删除用户 {username}？这会移除本地登录、会话、重置链接和相关邀请码记录。
- **Before (EN):** Delete user {username}? This removes local login, sessions, reset links, and related invite records.
- **After (ZH):** 删除用户 {username}？将移除登录、会话、重置链接及邀请码记录。
- **After (EN):** Delete {username}? Removes login, sessions, reset links, and invite records.
- **Why:** "确认" filler; "本地" / "local" and "相关" / "related" redundant qualifiers.

---

## Group M — `inbounds` namespace

### `inbounds.trafficResetHint`

- **Before (ZH):** 此配置对应 3X-UI 的入站级周期流量重置，会按周期清空该入站及其客户端流量统计。
- **Before (EN):** This maps to the 3X-UI inbound-level periodic traffic reset and clears traffic counters for the inbound and its clients on that schedule.
- **After (ZH):** 对应 3X-UI 入站级周期重置，按周期清空该入站及客户端流量统计。
- **After (EN):** Maps to 3X-UI inbound-level periodic reset; clears traffic counters for the inbound and its clients.
- **Why:** "此配置" / "This" opener; "on that schedule" redundant (just stated above).

---

### `inbounds.trafficResetOverriddenHint`

- **Before (ZH):** 已禁用：该入站已设置 Prism 账单日，由 Prism 负责月度重置。清空账单日后可重新启用 3X-UI 周期重置。
- **Before (EN):** Disabled because a Prism billing day is set on this inbound. Prism will handle the monthly reset instead; clear the billing day to re-enable 3X-UI periodic reset.
- **After (ZH):** 已禁用：已设 Prism 账单日，月度重置由 Prism 负责。清空账单日后可重新启用。
- **After (EN):** Disabled: a Prism billing day is set, so Prism handles the monthly reset. Clear it to re-enable.
- **Why:** "该入站" context already clear; EN "3X-UI periodic reset" at the end → "it".

---

### `inbounds.billingDayHint`

- **Before (ZH):** 按 UTC 计算每月第几天由 Prism 触发该入站的流量重置，用于对齐 DMIT 等以 UTC 计量的 VPS 账单周期；当月天数不足时回退到当月最后一天。设置账单日后 3X-UI 的周期重置会被强制为"从不"以避免双重清零。
- **Before (EN):** UTC day-of-month (1-31) when Prism resets this inbound, to match DMIT-style billing cycles (DMIT tracks usage in UTC). Months with fewer days fall back to the last day. When set, 3X-UI periodic reset is forced to "Never" to avoid double resets.
- **After (ZH):** UTC 第几天（1–31）Prism 触发入站流量重置，用于对齐 DMIT 等 UTC 账单周期；当月不足天数时回退最后一天。设置后 3X-UI 周期重置强制为"从不"，避免双重清零。
- **After (EN):** UTC day (1–31) when Prism resets this inbound, matching DMIT-style billing cycles. Falls back to the last day for shorter months. Setting this forces 3X-UI periodic reset to "Never" to avoid double resets.
- **Why:** Both versions are long but pack meaningful information — the trim is conservative. ZH drops "按 UTC 计算每月" opener; EN drops "(DMIT tracks usage in UTC)" parenthetical.

---

### `inbounds.noInboundsConfigured`

- **Before (ZH):** 你还没有配置任何入站。
- **Before (EN):** You haven't configured any inbounds yet.
- **After (ZH):** 还没有配置任何入站。
- **After (EN):** No inbounds configured yet.
- **Why:** Drop "你" / "You haven't" — shorter noun form works.

---

### `inbounds.note`

- **Before (ZH):** 提示：这里的变更会立即生效，请谨慎操作。
- **Before (EN):** Heads up: changes here take effect on the server immediately.
- **After (ZH):** 注意：变更立即生效，请谨慎操作。
- **After (EN):** Changes here take effect immediately.
- **Why:** "这里的" / "on the server" redundant context; EN "Heads up:" filler label.

---

## Group N — `users` namespace

### `users.editClientDescription`

- **Before (ZH):** 修改这个 3X-UI 客户端的当前配置。
- **Before (EN):** Update this client in the current 3X-UI inbound.
- **After (ZH):** 修改 3X-UI 客户端配置。
- **After (EN):** Update this client's 3X-UI config.
- **Why:** "这个…的当前" / "this … in the current" padding removed.

---

### `users.editClientConfigUnavailable`

- **Before (ZH):** 这个客户端缺少完整配置，目前无法编辑。
- **Before (EN):** This client cannot be edited because its full config is unavailable.
- **After (ZH):** 客户端配置不完整，无法编辑。
- **After (EN):** Cannot edit — full config unavailable.
- **Why:** "这个" / "This client cannot be edited because" all scaffolding.

---

### `users.editClientIdMissing`

- **Before (ZH):** 这个客户端缺少 3X-UI 更新所需的 clientId。
- **Before (EN):** This client is missing the protocol-specific client ID required by 3X-UI.
- **After (ZH):** 客户端缺少 3X-UI 所需的 clientId。
- **After (EN):** Missing the client ID required by 3X-UI.
- **Why:** "这个" and "protocol-specific" (implicit) cut.

---

### `users.clientActivityDescription`

- **Before (ZH):** 查看这条客户端的最后在线时间和最近 IP 记录。
- **Before (EN):** Check the latest online time and recent IP records for this client.
- **After (ZH):** 查看最后在线时间和最近 IP 记录。
- **After (EN):** Last online time and recent IP records for this client.
- **Why:** "这条客户端的" / "for this client" is context already in the modal title.

---

### `users.noIpRecords`

- **Before (ZH):** 这个客户端暂时没有 IP 记录。
- **Before (EN):** No IP records found for this client.
- **After (ZH):** 暂无 IP 记录。
- **After (EN):** No IP records.
- **Why:** "这个客户端" is in-context; "found for this client" redundant.

---

### `users.resetClientTrafficConfirm`

- **Before (ZH):** 确认清空客户端 {username} 的累计流量吗？该操作不可撤销。
- **Before (EN):** Reset all cumulative traffic counters for client {username}? This cannot be undone.
- **After (ZH):** 清空 {username} 的流量统计？此操作不可撤销。
- **After (EN):** Reset traffic for {username}? This cannot be undone.
- **Why:** "确认" / "all cumulative … counters" padding removed; "累计" stays in ZH but shorter form used.

---

### `users.deleteClientConfirm`

- **Before (ZH):** 确认删除入站 {inbound} 下的客户端 {username}？该操作不可撤销。
- **Before (EN):** Delete client {username} from inbound {inbound}? This action cannot be undone.
- **After (ZH):** 删除 {inbound} 下的 {username}？不可撤销。
- **After (EN):** Delete {username} from {inbound}? This cannot be undone.
- **Why:** "确认" opener; "客户端" / "client" and "该操作" / "This action" redundant.

---

### `users.subIdMissing`

- **Before (ZH):** 该用户还没有 subId
- **Before (EN):** This user has no subId yet
- **After (ZH):** 该用户尚无 subId
- **After (EN):** No subId yet
- **Why:** "还没有" → "尚无"; EN "This user has" context already clear.

---

## Group O — `settings` namespace

### `settings.generalDesc`

- **Before (ZH):** 工作区内可见的基础面板信息。
- **Before (EN):** Basic panel information visible across the workspace.
- **After (ZH):** 面板基础信息，在工作区内可见。
- **After (EN):** Basic panel info visible across the workspace.
- **Why:** Minor restructure; EN "information" → "info".

---

### `settings.announcementDesc`

- **Before (ZH):** 此消息会显示给门户中的所有用户。
- **Before (EN):** This message is shown to all users in the portal.
- **After (ZH):** 显示给门户中所有用户。
- **After (EN):** Shown to all users in the portal.
- **Why:** "此消息会" / "This message is" scaffolding removed.

---

### `settings.passwordHint`

- **Before (ZH):** 管理员密码修改请在 3X-UI 面板设置中处理
- **Before (EN):** Admin password change should be handled in 3X-UI panel settings
- **After (ZH):** 管理员密码请在 3X-UI 面板设置中修改
- **After (EN):** Change admin password in 3X-UI panel settings
- **Why:** "should be handled" → active verb; ZH restructured to active.

---

### `settings.twoFactorHint`

- **Before (ZH):** 2FA 配置请在 3X-UI 面板设置中处理
- **Before (EN):** 2FA setup should be configured in 3X-UI panel settings
- **After (ZH):** 2FA 请在 3X-UI 面板设置中配置
- **After (EN):** Configure 2FA in 3X-UI panel settings
- **Why:** Same pattern as passwordHint — "should be configured" → active.

---

### `settings.noBackup`

- **Before (ZH):** 本次会话尚未创建备份。
- **Before (EN):** No backup created in this session.
- **After (ZH):** 本次会话尚未备份。
- **After (EN):** No backup this session.
- **Why:** "创建备份" → "备份"; EN "created in" → just "this session".

---

## Group P — `portal` namespace misc

### `portal.howToUse` (section header)

- **Before (ZH):** 使用步骤
- **Before (EN):** How to Use
- **After (ZH):** 使用步骤 _(already fine)_
- **After (EN):** How to Use _(already fine)_
- **Why:** No change.

---

### `portal.downloadClient`

- **Before (ZH):** 客户端下载
- **Before (EN):** Download a Client
- **After (ZH):** 客户端下载 _(already fine)_
- **After (EN):** Download a Client _(fine as a section label)_
- **Why:** No change needed.

---

### `portal.advancedRules`

- **Before (ZH):** 适合需要规则组的客户端
- **Before (EN):** Best for rule-based clients
- **After (ZH):** 适合规则组客户端
- **After (EN):** Best for rule-based clients _(already fine)_
- **Why:** ZH drops "需要" — "规则组客户端" is understood.

---

### `portal.easyToUse`

- **Before (ZH):** 跨平台，导入更省心
- **Before (EN):** Cross-platform and easy to set up
- **After (ZH):** 跨平台，导入简单
- **After (EN):** Cross-platform, easy to set up
- **Why:** ZH "更省心" slightly vague → "简单"; EN replace "and" with comma.

---

## Group Q — `systemNotifications` namespace

### `systemNotifications.serverOkTitle`

- **Before (ZH):** 3X-UI 连接正常
- **Before (EN):** 3X-UI connection is healthy
- **After (ZH):** 3X-UI 连接正常 _(already fine)_
- **After (EN):** 3X-UI connected
- **Why:** "connection is healthy" → "connected" (3 words vs 2).

---

### `systemNotifications.serverOkBody`

- **Before (ZH):** 面板连接正常，一切就绪。
- **Before (EN):** Panel is connected and responding normally.
- **After (ZH):** 面板连接正常，一切就绪。 _(already fine)_
- **After (EN):** Panel connected and responding.
- **Why:** Drop "normally" — redundant.

---

### `systemNotifications.autoProvisionReadyBody`

- **Before (ZH):** 邀请码注册后会自动创建 3X-UI 账号。
- **Before (EN):** New registrations via invite will auto-get a 3X-UI account.
- **After (ZH):** 邀请注册后自动创建 3X-UI 账号。
- **After (EN):** Invite registrations auto-get a 3X-UI account.
- **Why:** ZH "邀请码" → "邀请"; EN "New registrations via" → "Invite registrations". "will" cut.

---

### `systemNotifications.announcementInactiveBody`

- **Before (ZH):** 用户当前看不到任何公告。
- **Before (EN):** No announcement is currently shown to users.
- **After (ZH):** 用户当前看不到公告。
- **After (EN):** No announcement shown to users.
- **Why:** "任何" / "currently" cut; meaning preserved.

---

### `systemNotifications.publicUrlMissingBody`

- **Before (ZH):** 建议在设置中填写 public URL，用于分享和重置链接。
- **Before (EN):** Set a public URL in Settings for share links and reset links.
- **After (ZH):** 在设置中填写 public URL，用于分享和重置链接。
- **After (EN):** Set a public URL in Settings for share and reset links.
- **Why:** ZH drops "建议"; EN "share links and reset links" → "share and reset links".

---

## Group R — `subscriptions` namespace (portal feature)

### `subscriptions.subIdDescription`

- **Before (ZH):** 从用户/用户账号页面粘贴 subId 来生成链接。
- **Before (EN):** Paste a subId from Users / User Accounts to generate links.
- **After (ZH):** 从用户或账号页面粘贴 subId。
- **After (EN):** Paste a subId from Users or User Accounts.
- **Why:** "来生成链接" / "to generate links" — that's the page's whole purpose; cut.

---

### `subscriptions.statInputHint`

- **Before (ZH):** 输入 subId 查看解析后的客户端信息。
- **Before (EN):** Input subId to view resolved client stats.
- **After (ZH):** 输入 subId 查看客户端信息。
- **After (EN):** Enter a subId to view client stats.
- **Why:** "解析后的" / "resolved" is internal jargon; "Input" → "Enter" (more natural EN).

---

### `subscriptions.tip`

- **Before (ZH):** 提示：快速上手建议先复制 {name} 链接。
- **Before (EN):** Tip: for quick onboarding, copy the {name} link first.
- **After (ZH):** 快速上手：先复制 {name} 链接。
- **After (EN):** Quick start: copy the {name} link.
- **Why:** "提示：" opener changed to inline context; EN drops "for … onboarding" and "first".

---

### `subscriptions.validSubIdFirst`

- **Before (ZH):** 请先输入有效的 subId
- **Before (EN):** Please input a valid subId first
- **After (ZH):** 请输入有效的 subId
- **After (EN):** Enter a valid subId
- **Why:** "先" / "first" and "Please" cut.

---

### `subscriptions.qrFailed`

- **Before (ZH):** 二维码生成失败，你仍可复制链接。
- **Before (EN):** Failed to generate QR code. You can still copy the link.
- **After (ZH):** 二维码生成失败，仍可复制链接。
- **After (EN):** Failed to generate QR code — you can still copy the link.
- **Why:** "你仍可" → "仍可" (ZH); EN already fine with minor punctuation tweak.

---

### `subscriptions.linkCopiedImport`

- **Before (ZH):** 链接已复制，请在客户端中导入。
- **Before (EN):** Link copied. Import it in your client.
- **After (ZH):** 链接已复制，在客户端导入即可。
- **After (EN):** Copied. Import in your client.
- **Why:** ZH "请在客户端中" → "在客户端"; EN "Link copied" → "Copied".

---

## Group S — `dashboard.help` tooltip strings

### `dashboard.help.totalClients`

- **Before (ZH):** 从所有入站解析出的客户端条目总数。
- **Before (EN):** Total number of client entries parsed from all inbounds.
- **After (ZH):** 所有入站解析出的客户端总数。
- **After (EN):** Total client entries from all inbounds.
- **Why:** "从…解析出的…条目" scaffolding trimmed.

---

### `dashboard.help.activeClients`

- **Before (ZH):** 当前状态为活跃且近期有上传/下载流量的客户端。
- **Before (EN):** Clients with recent upload/download traffic and currently active status.
- **After (ZH):** 状态活跃且近期有流量的客户端。
- **After (EN):** Clients with active status and recent traffic.
- **Why:** "当前状态为…且" scaffolding; "upload/download" → "traffic" (obvious).

---

### `dashboard.help.uptime`

- **Before (ZH):** 服务器自上次重启以来的运行时长。
- **Before (EN):** How long the server has been running since last restart.
- **After (ZH):** 服务器上次重启以来的运行时长。
- **After (EN):** Server uptime since last restart.
- **Why:** "自" → implied by "since"; EN "How long the server has been running" → "Server uptime".

---

### `dashboard.help.serverStatus`

- **Before (ZH):** 服务器实时资源使用情况。
- **Before (EN):** Live resource usage on the server.
- **After (ZH):** 服务器实时资源使用情况。 _(already tight)_
- **After (EN):** Live server resource usage.
- **Why:** EN restructures "on the server" to adjective position.

---

## Group T — `nodes` namespace

### `nodes.noNodesFound`

- **Before (ZH):** 未找到入站节点。
- **Before (EN):** No inbound nodes found.
- **After (ZH):** 未找到入站节点。 _(already fine)_
- **After (EN):** No nodes found.
- **Why:** "inbound" is redundant context in a Nodes page.

---

## Group U — `online` namespace

### `online.noActivity`

- **Before (ZH):** 当前没有检测到有流量活动的客户端。
- **Before (EN):** No clients with active traffic found.
- **After (ZH):** 未检测到有流量的客户端。
- **After (EN):** No clients with active traffic.
- **Why:** "当前" filler; EN "found" cut.

---

### `online.help.activeConnections`

- **Before (ZH):** 当客户端状态为活跃且累计流量大于 0 时，视为在线。
- **Before (EN):** Clients considered online when status is active and cumulative traffic is greater than 0.
- **After (ZH):** 状态活跃且累计流量 > 0 的客户端视为在线。
- **After (EN):** Counted online when status is active and cumulative traffic > 0.
- **Why:** "当…时" → subject-first sentence; EN adopts same.

---

## Group V — `traffic.help` tooltip strings

### `traffic.help.protocolDist`

- **Before (ZH):** 累计流量在不同协议之间的分布情况。
- **Before (EN):** How cumulative traffic is distributed across different protocols.
- **After (ZH):** 累计流量按协议的分布情况。
- **After (EN):** Cumulative traffic distribution by protocol.
- **Why:** "在不同协议之间的" → "按协议的"; EN passive nominalization → noun phrase.

---

### `traffic.help.avgTrafficPerClient`

- **Before (ZH):** 总累计流量除以客户端总数。
- **Before (EN):** Total cumulative traffic divided by total client count.
- **After (ZH):** 总流量除以客户端总数。
- **After (EN):** Total traffic divided by client count.
- **Why:** "累计" / "cumulative" already implied by the page context; "total client count" → "client count".

---

## Summary by impact tier

| Tier    | Group                                                                         | Examples                                                             |
| ------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Highest | B (portal onboarding), C (auth page titles), E (tab intros)                   | portal.subscriptionDesc, UserLogin titles, MySubscription tab titles |
| High    | A (page subtitles), D (PublicAuthLayout highlights), F (HomeTab descriptions) | dashboard.subtitle, settings.subtitle, HomeTab body copy             |
| Medium  | K (userAuth), L (userAccounts), M (inbounds hints), N (users confirms)        | billingDayHint, deleteClientConfirm, registrationTip                 |
| Lower   | P/Q/R (subscriptions misc, notifications), S/T/U/V (help tooltips)            | dashboard.help.uptime, subscriptions.tip, online.noActivity          |

---

_Total candidates: 70 — within the 50–80 target range._
_Guides namespace: skipped as instructed._
_Test files and snapshots: not touched._
