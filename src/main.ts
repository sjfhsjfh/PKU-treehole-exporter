import { treeholeClient } from "./client";
import type { PostWithComments } from "./model";
import { log } from "./log";
import {
  $typst,
  FetchPackageRegistry,
  MemoryAccessModel,
} from "@myriaddreamin/typst.ts";
import { TypstSnippet } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
import exportTypSource from "./export.typ?raw";

const TOOLBAR_SELECTOR = ".box.box-tip.sidebar-toolbar.sidebar-toolbar-fixed";
const TITLE_SELECTOR = ".sidebar-title.sidebar-top";
const DROPDOWN_SELECTOR = ".sidebar-toolbar-dropdown.sidebar-toolbar-item";
const POLL_MS = 500;

let currentPid: number | null = null;
let buttonEl: HTMLSpanElement | null = null;
let iconInjected = false;
let warnedMissing = false;
let typstInitialized = false;

// start polling for SPA changes
setInterval(refreshState, POLL_MS);
refreshState();

async function onClick(ev: MouseEvent) {
  ev.preventDefault();
  if (!currentPid) {
    log.error("未能解析当前树洞 pid");
    return;
  }

  try {
    const hud = ensureHud();
    setHud(hud, "正在获取树洞内容…");

    log.info("fetching post", currentPid, "...");
    const [postResp, comments] = await Promise.all([
      treeholeClient.fetchPost(currentPid),
      treeholeClient.fetchAllComments(currentPid, "asc", 50),
    ]);

    if (!postResp.success) throw new Error(postResp.message);

    const users = Array.from(
      new Set(["洞主", ...comments.map((c) => c.name).filter(Boolean)]),
    );

    const result: PostWithComments = {
      post: postResp.data,
      comments,
      users,
    };

    setHud(hud, "准备 PDF 导出…");
    await exportPdf(result);

    setHud(hud, "导出完成", 1200);
    log.info("PostWithComments", result);
  } catch (err) {
    log.error("failed:", err);
    alert("导出失败，请检查登录状态与网络");
  }
}

function refreshState() {
  const titleEl = document.querySelector(TITLE_SELECTOR);
  const toolbar = document.querySelector(
    TOOLBAR_SELECTOR,
  ) as HTMLElement | null;

  if (!titleEl || !toolbar) {
    currentPid = null;
    removeButton();
    if (!warnedMissing) {
      log.warn("列表视图或未渲染，等待树洞详情出现…");
      warnedMissing = true;
    }
    return;
  }

  warnedMissing = false;
  const pid = parsePidFromTitle(titleEl);
  if (!pid) {
    currentPid = null;
    removeButton();
    return;
  }

  currentPid = pid;
  ensureButton(toolbar);
}

function ensureButton(toolbar: HTMLElement) {
  if (!buttonEl) {
    buttonEl = document.createElement("span");
    buttonEl.className = "sidebar-toolbar-item treehole-exporter-btn";
    buttonEl.innerHTML = `
      <a href="javascript:void(0)">
        <span class="icon-export-hole"><svg><use href="#icon-export-hole-symbol"></use></svg></span>
        <label>导出树洞</label>
      </a>
    `;
    buttonEl.addEventListener("click", onClick);
  }

  // Insert before dropdown if present; otherwise append
  const dropdown = toolbar.querySelector(DROPDOWN_SELECTOR);
  if (dropdown && dropdown.parentElement === toolbar) {
    toolbar.insertBefore(buttonEl, dropdown);
  } else if (!toolbar.contains(buttonEl)) {
    toolbar.appendChild(buttonEl);
  }

  injectIconStyleOnce();
}

function removeButton() {
  if (buttonEl && buttonEl.parentElement) {
    buttonEl.parentElement.removeChild(buttonEl);
  }
}

function parsePidFromTitle(el: Element): number | null {
  const text = el.textContent || "";
  const match = text.match(/#(\d+)/);
  if (!match) return null;
  const pid = Number(match[1]);
  return Number.isFinite(pid) ? pid : null;
}

function injectIconStyleOnce() {
  if (iconInjected) return;
  const style = document.createElement("style");
  style.textContent = `
    /* inline icon via SVG sprite */
    .icon-export-hole { display: inline-block; width: 1em; height: 1em; vertical-align: -.125em; }
    .icon-export-hole svg { width: 100%; height: 100%; fill: currentColor; }
  `;
  const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sprite.setAttribute("aria-hidden", "true");
  sprite.setAttribute(
    "style",
    "position:absolute;width:0;height:0;overflow:hidden;",
  );
  sprite.innerHTML = `
    <defs>
      <symbol id="icon-export-hole-symbol" viewBox="0 0 32 32">
        <path d="M15 22h-15v8h30v-8h-15zM28 26h-4v-2h4v2zM7 10l8-8 8 8h-5v10h-6v-10z"></path>
      </symbol>
    </defs>
  `;
  document.head.appendChild(style);
  document.body.appendChild(sprite);
  iconInjected = true;
}

type HudRefs = { box: HTMLElement; text: HTMLElement; timer?: number };
let hudRefs: HudRefs | null = null;

function ensureHud(): HudRefs {
  if (hudRefs) return hudRefs;

  const style = document.createElement("style");
  style.textContent = `
    .treehole-exporter-hud {
      position: fixed;
      right: 16px;
      bottom: 16px;
      padding: 10px 12px;
      background: rgba(17, 24, 39, 0.9);
      color: #fff;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      display: flex;
      gap: 8px;
      align-items: center;
      z-index: 9999;
      font-size: 13px;
      pointer-events: none;
    }
    .treehole-exporter-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: treehole-spin 0.8s linear infinite;
    }
    @keyframes treehole-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.className = "treehole-exporter-hud";
  const spinner = document.createElement("div");
  spinner.className = "treehole-exporter-spinner";
  const text = document.createElement("div");
  text.textContent = "准备中…";
  box.appendChild(spinner);
  box.appendChild(text);
  document.body.appendChild(box);

  hudRefs = { box, text };
  return hudRefs;
}

function setHud(hud: HudRefs, message: string, autoHideMs?: number) {
  hud.text.textContent = message;
  if (hud.timer) window.clearTimeout(hud.timer);
  if (autoHideMs) {
    hud.timer = window.setTimeout(() => {
      hud.box.remove();
      hudRefs = null;
    }, autoHideMs);
  }
}

async function exportPdf(data: PostWithComments) {
  await ensureTypst();
  $typst.addSource("/data.json", JSON.stringify(data));
  $typst.addSource("/export.typ", exportTypSource);

  const pdfBytes = (await $typst.pdf({
    mainFilePath: "/export.typ",
  })) as Uint8Array;

  if (!pdfBytes) {
    throw new Error("生成 PDF 失败");
  }

  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `PKU树洞#${data.post.pid}-${ts}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// typst 初始化只跑一次
async function ensureTypst() {
  if (typstInitialized) return;
  $typst.setCompilerInitOptions({
    getModule: () =>
      "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
  });
  const memoryAccessModel = new MemoryAccessModel();
  const packageFetch = new FetchPackageRegistry(memoryAccessModel);
  $typst.use(
    TypstSnippet.withAccessModel(memoryAccessModel),
    TypstSnippet.withPackageRegistry(packageFetch),
    TypstSnippet.preloadFonts([
      "https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@2.004R/OTF/SourceHanSansCN-Regular.otf",
    ]),
  );
  typstInitialized = true;
}
