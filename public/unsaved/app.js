import {
  STORAGE_KEY,
  freshState,
  readSave,
  validateState,
  encodeState,
  decodeState,
  mergeState,
  complete,
  nextScene,
  canVisit,
  levels,
  startBoard,
  moveBoard,
  budget,
  linkPairs,
  endingFor,
} from "./core.js";
import { sceneUrl } from "./sites.js";

const scene = document.body.dataset.scene;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let state = freshState();
let mayWrite = true;
let sound = false;
let audio;
let currentEnding;
let selectedSouvenirs = [];
let resetScene = () => {};
const notice = (message) => {
  $("#notice").textContent = message;
  $("#notice").className = message ? "warning" : "";
};

const journal = [
  [
    "start",
    "intro",
    "一份没写完的发布说明",
    "三份自我介绍都把最后一幕交给了另一个自己。",
  ],
  [
    "profiles",
    "about",
    "三个版本的 Amiya",
    "起点藏起害怕，工具箱藏起需要帮助，旁观者漏掉快乐。",
  ],
  [
    "first",
    "first",
    "第一面旗",
    "箱子压下开关以后门会一直开。一个粗糙的小世界也能真的走完。",
  ],
  [
    "margins",
    "margins",
    "后来补上的三句话",
    "理性与情绪可以共存；关系仍有疑问；网站技术曾返回到小作品。",
  ],
  [
    "network",
    "links",
    "绕路的连接",
    "游戏 → AI → 社区 → 服务器 → 网站 → 小作品。准备之后还需要决定。",
  ],
  [
    "jam",
    "jam",
    "可以结束的 Jam 版本",
    "移动、桥、终点是当前体验必需的；撤销留出了试错余地。",
  ],
  [
    "shelf",
    "shelf",
    "可以共同署名的经历",
    "三份版本不再争夺唯一身份。现在的人仍需要走下一步。",
  ],
  [
    "finish",
    "end",
    "最后一幕",
    "你把这部游戏玩到了最后。还可以选另一组纪念物。",
  ],
  [
    "room",
    "room",
    "没有 KPI 的四个音",
    "小房间不改变好坏，只让最后一页多一点声音。",
  ],
];
const hints = {
  intro: [
    "先打开发布说明。结尾处有前往主页的链接。",
    "正文下面的「前往主页」会携带进度进入另一站。",
    "点「打开这份发布说明」，再点「前往主页，找那三份关于我」。",
  ],
  about: [
    "三份介绍都要打开，不需要判断谁是正确的。",
    "分别点「起点」「工具箱」「旁观者」，之后下面会出现旧作。",
    "打开全部三个标签，再点「打开旧作：先让方块走起来」。",
  ],
  first: [
    "让木箱触发圆形开关，再到右上角的旗帜。开关触发后不会关闭。",
    "从箱子左侧推它两格。然后从下方绕过箱子。",
    "从初始位置依次按：下、下、右、右、下、右、右、上、右、右、上、上。",
  ],
  margins: [
    "每一题要选边注和证据。比较的是推论是否有依据，不是看起来是否乐观。",
    "演讲的失落、尚未确认的关系、网站帮助小作品，分别回应三段旧想法。",
    "第一题：判断也被情绪推动＋失落参与评价；第二题：保留不确定＋尚未确认关系；第三题：探索成为条件＋网站实现点子。",
  ],
  links: [
    "按来源、去处的顺序点两个节点。每次点节点会出现相关记录。",
    "从游戏开发出发。博客最后一张边注告诉你，网站后来通向什么。",
    "依次接：游戏→AI，AI→社区，社区→服务器，服务器→网站，网站→小作品。",
  ],
  jam: [
    "先试现在的版本，观察在哪里走不通；再按目标调整模块。",
    "角色需要移动，中央缺口需要桥，旗帜需要结束条件。Boss 这次用不上。",
    "取消 Boss，选择移动＋桥＋终点（5 格），可加撤销（共 6 格）；试玩后向右走六步。",
  ],
  shelf: [
    "把你亲身操作过的证据，配给它能回应的那句话。",
    "粗糙作品仍有成就、准备不能代替决定、绕路未必白走，分别有一份证据。",
    "起点选第一间房；工具箱选 Jam 工程；旁观者选关系图。",
  ],
  end: [
    "选两件纪念物，再打开最后一幕。所有组合都可以完成。",
    "从最上方走廊往右走到底，再绕到旗帜。",
    "初始位置：右六次、下、下、左、下。后记由你带的两件纪念物决定。",
  ],
  room: [
    "任意点四个不同的琴键。静音也有效。",
    "不需要演奏某首曲子，也没有节奏要求。",
    "点 1、2、3、4，就能带走这间房间的纪念物。",
  ],
};

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) state = readSave(stored);
} catch (error) {
  mayWrite = false;
  notice(
    `无法读取本地进度：${error.message}。旧数据不会被覆盖；可在「线索与存档」导入备份或明确重开。`,
  );
}

function persist(force = false) {
  if (!mayWrite && !force) return;
  try {
    if (!force) {
      const currentText = localStorage.getItem(STORAGE_KEY);
      if (currentText) {
        const current = readSave(currentText);
        if (current.id !== state.id) {
          mayWrite = false;
          notice(
            "另一标签页已经切换了存档。这页暂不覆盖它；可导出当前局，再刷新选择要继续的进度。",
          );
          return;
        }
        state = mergeState(state, current);
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    mayWrite = true;
  } catch (error) {
    mayWrite = false;
    notice(
      `浏览器未保存进度：${error.message}。请导出文件或复制携带码；游戏内跨站链接仍会带上当前进度。`,
    );
  }
}

function acceptIncoming(incoming, explicit = false) {
  if (incoming.id === state.id) state = mergeState(state, incoming);
  else if (!state.flags.length && !state.seen.length) state = incoming;
  else {
    const consent = confirm(
      "这份存档属于另一局。确定：切换到它并替换此站本地进度。取消：保留当前局。若需要两份，请先取消并导出当前存档。",
    );
    if (!consent) return false;
    state = incoming;
  }
  persist(explicit || mayWrite);
  return true;
}

const token = new URLSearchParams(location.hash.slice(1)).get("u");
if (token !== null) {
  try {
    acceptIncoming(decodeState(token));
  } catch (error) {
    notice(`携带进度未导入：${error.message}`);
  }
  history.replaceState(null, "", location.pathname + location.search);
}
// A saved link can target this same document; rebuild scene state after that navigation too.
window.addEventListener("hashchange", () => {
  if (new URLSearchParams(location.hash.slice(1)).has("u")) location.reload();
});

$("#toolbar").innerHTML =
  `<a class="brand" data-route="intro" href="https://blog.sayori.org/unsaved/"><span class="dot" aria-hidden="true"></span>Amiya 的未保存版本</a><nav class="tools" aria-label="游戏工具"><button id="journal-open">线索与存档</button><button id="hint-open">卡住了？</button><button id="sound-toggle" aria-pressed="false">开启声音</button></nav>`;
$("#footer").innerHTML =
  `<span>个人叙事 ARG · 新增对白与情节为虚构改编</span><span><button id="about-open">作品说明</button> &nbsp; <a href="https://blog.sayori.org/">离开游戏，回书桌</a></span>`;

document.body.insertAdjacentHTML(
  "beforeend",
  `
<dialog class="dialog" id="journal-dialog" aria-labelledby="journal-title"><div class="dialog-head"><h2 id="journal-title">这一路留下的东西</h2><button data-close aria-label="关闭线索与存档">关闭</button></div><a class="button" data-next href="/unsaved/">继续主线</a><ul id="journal-list" class="journal-list"></ul><details><summary>导出、导入与携带码</summary><p>两站各存一份本地进度，通过游戏内链接交换。旧标签不会跨域实时更新；回程请用游戏链接，或导入最新存档。</p><p>保存已完成节点、线索、提示和后记。未完成的棋盘、连线尝试刷新后复位。</p><div class="actions"><button id="export-save">导出 JSON 存档</button><button id="copy-save">复制携带码</button></div><label for="save-code">携带码（可手动复制，也可粘贴后导入）</label><textarea id="save-code" spellcheck="false"></textarea><button id="import-code">导入这份携带码</button><p><label for="save-file">或导入本作的 JSON 文件</label><input id="save-file" type="file" accept=".json,application/json"></p><p id="save-status" class="status" role="status"></p></details><details><summary>重新开始</summary><p>创建新的一局。不会删除别站的旧副本；再次遇到旧副本时，会询问你保留哪一局。请先导出要保留的进度。</p><button id="reset-save">确认后重新开始</button></details></dialog>
<dialog class="dialog" id="hint-dialog" aria-labelledby="hint-title"><div class="dialog-head"><h2 id="hint-title">给一点提示</h2><button data-close aria-label="关闭提示">关闭</button></div><p>提示不会扣分。每点一次，多说一点；最后一级直接给操作。</p><ol id="hint-list" class="hint-list"></ol><button id="more-hint">看第一点提示</button></dialog>
<dialog class="dialog" id="about-dialog" aria-labelledby="about-title"><div class="dialog-head"><h2 id="about-title">现实的出口</h2><button data-close aria-label="关闭作品说明">关闭</button></div><p>你正在玩 Amiya_desi 的个人叙事 ARG。文章主题和少量经历来自公开记录；本作的自述、异常网页、关卡、提交记录和结尾均为虚构化创作。</p><p>游戏不会访问真实账号、发送消息或要求联系真人。不要猜真实密码、寻找私人资料或进行线下行动。主线只需使用已标明的游戏内链接。</p><p>本作不上传身份或游玩记录。开启声音只使用合成音，不需要麦克风权限。静音与触屏也能完整通关。</p><p>无需付费服务。所有新增图形、声音与文本均为本作制作；原文章和原作保留其原有许可。完整来源在结尾页。</p><p>可以关掉页面，稍后再回来。你不用证明今天就能玩完。</p><a href="https://blog.sayori.org/">离开游戏，回到正常的博客</a></dialog>`,
);

function updateLinks() {
  for (const anchor of $$("[data-route], [data-next]")) {
    const target = anchor.hasAttribute("data-next")
      ? nextScene(state)
      : anchor.dataset.route;
    anchor.href = `${sceneUrl(target, location)}#u=${encodeState(state)}`;
  }
}

function refresh() {
  $$("[data-unlock]").forEach((element) => {
    element.hidden = !state.flags.includes(element.dataset.unlock);
  });
  $("#journal-list").replaceChildren(
    ...journal
      .filter(([flag]) => state.flags.includes(flag))
      .map(([, route, title, detail]) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.dataset.route = route;
        a.textContent = title;
        const p = document.createElement("p");
        p.textContent = detail;
        li.append(a, p);
        return li;
      }),
  );
  if (!$("#journal-list").children.length)
    $("#journal-list").textContent = "还没开始。先打开那份发布说明。";
  $("#save-code").value = encodeState(state);
  $("#hint-list").replaceChildren(
    ...hints[scene].slice(0, state.hints[scene] || 0).map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  const count = state.hints[scene] || 0;
  $("#more-hint").textContent =
    count === 0
      ? "看第一点提示"
      : count === 3
        ? "提示已全部展开"
        : "再说具体一点";
  $("#more-hint").disabled = count === 3;
  updateLinks();
}

function finish(flag) {
  state = complete(state, flag);
  persist();
  refresh();
  tone(660);
}

function remember(record) {
  state = validateState({
    ...state,
    seen: [...new Set([...state.seen, record])],
  });
  persist();
  refresh();
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tone(frequency) {
  if (!sound) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, audio.currentTime);
  gain.gain.linearRampToValueAtTime(0.07, audio.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.32);
}

$("#sound-toggle").addEventListener("click", async () => {
  if (sound) {
    sound = false;
    await audio.suspend();
  } else {
    try {
      audio ??= new AudioContext();
      await audio.resume();
      sound = true;
    } catch {
      notice("这个浏览器暂时不能播放声音。文字反馈与全部谜题仍可使用。");
      return;
    }
  }
  $("#sound-toggle").textContent = sound ? "关闭声音" : "开启声音";
  $("#sound-toggle").setAttribute("aria-pressed", String(sound));
  tone(440);
});
for (const [button, dialog] of [
  ["journal-open", "journal-dialog"],
  ["hint-open", "hint-dialog"],
  ["about-open", "about-dialog"],
]) {
  $(`#${button}`).addEventListener("click", () => {
    refresh();
    $(`#${dialog}`).showModal();
  });
}
$$("[data-close]").forEach((button) =>
  button.addEventListener("click", () => button.closest("dialog").close()),
);
$("#more-hint").addEventListener("click", () => {
  state.hints[scene] = Math.min(3, (state.hints[scene] || 0) + 1);
  persist();
  refresh();
});
$("#export-save").addEventListener("click", () => {
  download(
    "amiya-unsaved.json",
    JSON.stringify(state, null, 2),
    "application/json",
  );
  $("#save-status").textContent = "已请求下载存档。请确认浏览器保存成功。";
});
$("#copy-save").addEventListener("click", async () => {
  $("#save-code").value = encodeState(state);
  try {
    await navigator.clipboard.writeText($("#save-code").value);
    $("#save-status").textContent = "携带码已复制。";
  } catch {
    $("#save-code").focus();
    $("#save-code").select();
    $("#save-status").textContent =
      "浏览器未允许自动复制。已选中文字，请手动复制。";
  }
});

function importState(value) {
  if (acceptIncoming(value, true)) {
    location.href = `${sceneUrl(nextScene(state), location)}#u=${encodeState(state)}`;
  } else $("#save-status").textContent = "保留当前局，未替换进度。";
}
$("#import-code").addEventListener("click", () => {
  try {
    importState(decodeState($("#save-code").value.trim()));
  } catch (error) {
    $("#save-status").textContent = `没有导入：${error.message}`;
  }
});
$("#save-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8192) throw new Error("文件超过 8 KB，不像本作的存档。");
    importState(readSave(await file.text()));
  } catch (error) {
    $("#save-status").textContent = `没有导入：${error.message}`;
  }
  event.target.value = "";
});
$("#reset-save").addEventListener("click", () => {
  if (
    !confirm(
      "确认创建新的一局？此站当前存档将被替换。若要保留，请取消并先导出。",
    )
  )
    return;
  state = freshState();
  persist(true);
  location.href = `${sceneUrl("intro", location)}#u=${encodeState(state)}`;
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  if (event.newValue === null) {
    mayWrite = false;
    notice(
      "本地存档在另一标签被移除了。这页保留内存中的进度；请导出后再刷新。",
    );
    return;
  }
  try {
    const incoming = readSave(event.newValue);
    if (incoming.id !== state.id) {
      mayWrite = false;
      notice(
        "另一标签已经开始了另一局。这页不会覆盖它；请导出当前局，或刷新继续新局。",
      );
      return;
    }
    state = mergeState(state, incoming);
    const hasUnsavedProgress =
      ["flags", "seen", "endings"].some((key) =>
        state[key].some((value) => !incoming[key].includes(value)),
      ) ||
      Object.entries(state.hints).some(
        ([key, value]) => value > (incoming.hints[key] || 0),
      );
    // Persist the union after racing writes; do not echo unchanged storage events.
    if (hasUnsavedProgress) persist();
    refresh();
  } catch (error) {
    mayWrite = false;
    notice(`另一标签的存档不能读取：${error.message}`);
  }
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const latest = readSave(stored);
      if (latest.id === state.id) {
        state = mergeState(state, latest);
        refresh();
      } else {
        mayWrite = false;
        notice("返回的是旧一局页面。请先导出要保留的进度，再刷新。");
      }
    }
  } catch (error) {
    mayWrite = false;
    notice(`无法恢复本地进度：${error.message}`);
  }
});
// Refresh hrefs on click as well: opening a link in a new tab must carry the newest in-memory state.
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-route], [data-next]")) updateLinks();
});

function initBoard(levelName, onWin) {
  const level = levels[levelName];
  let board = startBoard(level);
  let history = [];
  let modules = ["move", "bridge", "goal", "undo"];
  let active = levelName !== "jam" && levelName !== "end";
  function render() {
    $("#board").replaceChildren(
      ...level.flatMap((row, y) =>
        [...row].map((cell, x) => {
          const tile = document.createElement("div");
          const names = {
            "#": "墙",
            ".": "地面",
            S: "起点",
            G: "旗帜",
            b: "地面",
            s: "开关",
            "|": "门",
            "~": "缺口",
          };
          let name = names[cell];
          tile.className = "tile";
          const type = {
            "#": "wall",
            G: "goal",
            s: "switch",
            "|": board.powered ? "open" : "gate",
            "~": modules.includes("bridge") ? "open" : "gap",
          }[cell];
          if (type) tile.classList.add(type);
          if (board.box?.[0] === x && board.box[1] === y) {
            tile.classList.add("box");
            name = "木箱";
          }
          if (board.player[0] === x && board.player[1] === y) {
            tile.classList.add("player");
            name = "你";
          }
          tile.setAttribute("role", "img");
          tile.setAttribute("aria-label", `${y + 1} 行 ${x + 1} 列：${name}`);
          return tile;
        }),
      ),
    );
    $("#undo").disabled =
      !active || !history.length || !modules.includes("undo");
  }
  function step(direction) {
    if (!active) {
      $("#board-status").textContent =
        levelName === "jam"
          ? "先点「试玩这个版本」。"
          : "先选两件纪念物，再打开最后一幕。";
      return;
    }
    const result = moveBoard(level, board, direction, modules);
    if (result.board !== board) {
      history.push(board);
      board = result.board;
      tone(board.won ? 784 : 220 + board.player[0] * 22);
    }
    $("#board-status").textContent = result.message;
    render();
    if (board.won) {
      active = false;
      onWin();
    }
  }
  function undo() {
    if (!active || !history.length) return;
    if (!modules.includes("undo")) {
      $("#board-status").textContent =
        "这个版本没带撤销模块。可以重开，或回编辑器加入它。";
      return;
    }
    board = history.pop();
    render();
    $("#board-status").textContent = "退回一步。可以换一种走法。";
  }
  $$("[data-move]").forEach((button) =>
    button.addEventListener("click", () => step(button.dataset.move)),
  );
  $("#board").addEventListener("keydown", (event) => {
    const direction = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    }[event.key];
    if (direction) {
      event.preventDefault();
      step(direction);
    }
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  });
  $("#undo").addEventListener("click", undo);
  $("#restart-board").addEventListener("click", () => {
    board = startBoard(level);
    history = [];
    active = levelName !== "jam" || modules.length > 0;
    render();
    $("#board-status").textContent = "回到这个版本的起点。";
  });
  resetScene = (selected) => {
    modules = selected || ["move", "bridge", "goal", "undo"];
    board = startBoard(level);
    history = [];
    active = true;
    render();
    $("#board-status").textContent = "开始吧。到旗帜那里去。";
  };
  if (levelName === "jam") modules = [];
  render();
}

function initScene() {
  if (scene === "intro") {
    $("#resume-link").hidden = !state.flags.includes("start");
    $("#begin").addEventListener("click", () => {
      finish("start");
      $("#opening").scrollIntoView({ behavior: "instant", block: "start" });
    });
  }
  if (scene === "about") {
    $$("[data-profile]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.profile;
        $("#profile-empty").hidden = true;
        $$("[data-profile-panel]").forEach((panel) => {
          panel.hidden = panel.dataset.profilePanel !== id;
        });
        $$("[data-profile]").forEach((tab) =>
          tab.setAttribute("aria-pressed", String(tab === button)),
        );
        remember(id);
        const count = ["builder", "collector", "observer"].filter((key) =>
          state.seen.includes(key),
        ).length;
        $("#profile-status").textContent = `已看过 ${count} / 3 份介绍。`;
        if (count === 3) finish("profiles");
      }),
    );
  }
  if (scene === "first") initBoard("first", () => finish("first"));
  if (scene === "margins") {
    const answers = {
      reason: ["coexist", "speech"],
      value: ["open", "unknown"],
      detour: ["return", "toy"],
    };
    $$("[data-margin]").forEach((form) => {
      const id = form.dataset.margin;
      const restored = document.createElement("p");
      restored.className = "restored-note";
      restored.hidden = true;
      form.closest("section").querySelector(".old-text").append(restored);
      function restoreNote() {
        const input = form.querySelector(`input[value="${answers[id][0]}"]`);
        input.checked = true;
        form.querySelector("select").value = answers[id][1];
        restored.textContent = `后来补上：${input.closest("label").textContent.trim()}`;
        restored.hidden = false;
        $(`[data-feedback="${id}"]`).textContent =
          "边注已放回。旧文字也保留下来。";
      }
      if (state.seen.includes(id)) restoreNote();
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const correct =
          data.get("annotation") === answers[id][0] &&
          data.get("proof") === answers[id][1];
        const feedback = $(`[data-feedback="${id}"]`);
        if (!correct) {
          feedback.textContent =
            "这组边注和依据还没对上。留意右边具体发生了什么，不要替那段经历补一个它没说过的结论。";
          return;
        }
        remember(id);
        restoreNote();
        if (Object.keys(answers).every((key) => state.seen.includes(key)))
          finish("margins");
      });
    });
  }
  if (scene === "links") {
    const nodes = {
      game: [
        "游戏开发",
        "为了做游戏，碰到不会的内容时，我开始找 AI 帮忙。那时工具的意义很具体：把眼前的问题弄明白。",
      ],
      ai: [
        "AI 工具",
        "寻找模型与资源的时候，接触到了社区。工具原来不只是一张界面，背后还有很多正在折腾的人。",
      ],
      community: [
        "社区",
        "在社区里，别人分享服务器和自建服务的经验。我也开始想要一个可以自己摆东西的地方。",
      ],
      server: [
        "服务器",
        "有了自己的地方，下一步是给它做一个别人能打开的入口。于是开始搭网站，把东西放上去。",
      ],
      web: [
        "网站",
        "后来这条路通向哪里？博客「我是不是又跑偏了」那张边注，记下了一次技术回到表达的时刻。",
      ],
      toy: [
        "小作品",
        "不是所有作品都要先有宏大的计划。有时只想把喜欢的东西变成一个别人也能点两下的小玩具。",
      ],
    };
    let selected = null;
    const connected = new Set(state.flags.includes("network") ? linkPairs : []);
    function draw() {
      $("#connections").replaceChildren(
        ...[...connected].map((pair) => {
          const [from, to] = pair.split(">");
          const li = document.createElement("li");
          li.textContent = `${nodes[from][0]} → ${nodes[to][0]}`;
          return li;
        }),
      );
      $$("[data-node]").forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.node === selected),
        ),
      );
    }
    $$("[data-node]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.node;
        $("#node-title").textContent = nodes[id][0];
        $("#node-note").textContent = nodes[id][1];
        if (!selected) {
          selected = id;
          $("#network-status").textContent =
            `来源：${nodes[id][0]}。现在选它带来的去处。`;
        } else {
          const pair = `${selected}>${id}`;
          if (linkPairs.includes(pair)) {
            connected.add(pair);
            $("#network-status").textContent =
              `接上了。已恢复 ${connected.size} / 5 条连接。`;
            if (connected.size === 5) finish("network");
          } else
            $("#network-status").textContent =
              "现有记录不能支持这个方向。读一读节点记录，再选来源和去处。";
          selected = null;
        }
        draw();
      }),
    );
    $("#clear-node").addEventListener("click", () => {
      selected = null;
      draw();
      $("#network-status").textContent = "已取消。重新选一个来源。";
    });
    draw();
  }
  if (scene === "jam") {
    initBoard("jam", () => finish("jam"));
    const selected = () =>
      $$("input[name=module]:checked").map((input) => input.value);
    $("#modules").addEventListener("change", () => {
      $("#budget").textContent = `${budget(selected())} / 6 格`;
      $("#build-status").textContent =
        "计划已改变；点「试玩这个版本」才会更新棋盘。";
    });
    $("#test-build").addEventListener("click", () => {
      const modules = selected();
      if (budget(modules) > 6) {
        $("#build-status").textContent =
          "超出六格预算。先删减，再试玩；目标只要求跨过缺口抵达旗帜。";
        return;
      }
      resetScene(modules);
      $("#build-label").textContent = `${budget(modules)} / 6 格 · 已构建`;
      $("#build-status").textContent = modules.includes("undo")
        ? "版本已构建；可以撤销，也可以重开。"
        : "版本已构建；没有撤销模块，仍可随时重开。";
    });
  }
  if (scene === "shelf") {
    $("#evidence-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const correct =
        data.get("builder") === "first" &&
        data.get("collector") === "edit" &&
        data.get("observer") === "connections";
      $("#evidence-status").textContent = correct
        ? "三份经历都有了位置。"
        : "还有一份证据没回应那句话。回看线索册：它在问快乐、决定，还是绕路的意义？";
      if (correct) finish("shelf");
    });
  }
  if (scene === "room") {
    const played = new Set();
    const names = ["do", "re", "mi", "fa", "sol", "la", "si", "do↑"];
    function play(index) {
      const key = $(`[data-note="${index}"]`);
      tone([261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25][index]);
      played.add(index);
      key.classList.add("playing");
      $("#sound-visual").classList.add("active");
      setTimeout(() => {
        key.classList.remove("playing");
        $("#sound-visual").classList.remove("active");
      }, 250);
      $("#music-status").textContent =
        `${names[index]}。已经碰过 ${played.size} 个不同的音${sound ? "。" : "（静音中）。"}`;
      if (played.size >= 4 && !state.flags.includes("room")) finish("room");
    }
    $$("[data-note]").forEach((button) =>
      button.addEventListener("click", () => play(Number(button.dataset.note))),
    );
    document.addEventListener("keydown", (event) => {
      if (
        /^[1-8]$/.test(event.key) &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.target.closest("dialog, input, textarea, select")
      )
        play(Number(event.key) - 1);
    });
  }
  if (scene === "end") {
    initBoard("end", () => {
      state = complete(state, "finish");
      state.endings = [...new Set([...state.endings, currentEnding])];
      persist();
      refresh();
      $$("[data-ending]").forEach((letter) => {
        letter.hidden = letter.dataset.ending !== currentEnding;
      });
      $("#ending-results").hidden = false;
      $("#ending-results").focus({ preventScroll: true });
      $("#ending-results").scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    });
    $("#start-ending").addEventListener("click", () => {
      selectedSouvenirs = $$("input[name=souvenir]:checked").map(
        (input) => input.value,
      );
      try {
        currentEnding = endingFor(selectedSouvenirs);
      } catch (error) {
        $("#souvenir-status").textContent = error.message;
        return;
      }
      $("#souvenir-status").textContent = "带好了。最后这段路，慢慢走。";
      $("#final-game").hidden = false;
      $("#ending-results").hidden = true;
      const titles = {
        make: "旗帜与工具箱 · 继续动手",
        share: "旗帜与边注 · 让人看见",
        space: "工具箱与边注 · 留出空白",
      };
      $("#ending-stage").textContent = titles[currentEnding];
      $("#final-game").dataset.keepsakes = selectedSouvenirs.join(" ");
      $("#final-caption").textContent = {
        make: "这条路，留给下一个工程。",
        share: "这条路，通往另一个人的屏幕。",
        space: "这条路，也允许你停一下。",
      }[currentEnding];
      resetScene();
      $("#final-game").scrollIntoView({ behavior: "instant", block: "start" });
      $("#board").focus({ preventScroll: true });
    });
    $("#choose-again").addEventListener("click", () => {
      $("#ending-results").hidden = true;
      $("#final-game").hidden = true;
      $("input[name=souvenir]").focus();
      $(".souvenirs").scrollIntoView({ behavior: "instant", block: "center" });
    });
    $("#download-keepsake").addEventListener("click", () => {
      const letter = $(`[data-ending="${currentEnding}"]`).innerText;
      const text = `Amiya 的未保存版本\n\n${letter}\n\n${state.flags.includes("room") ? "还有四个没有 KPI 的音。\n\n" : ""}这是一份游玩纪念，不包含个人身份。\n携带码：\n${encodeState(state)}\n`;
      download("Amiya-这次游玩的纪念.txt", text, "text/plain;charset=utf-8");
    });
  }
}

refresh();
if (canVisit(state, scene)) initScene();
else {
  $("#main").hidden = true;
  const block = document.createElement("section");
  block.className = "blocked";
  block.innerHTML =
    '<h1>还少一段来路。</h1><p>你可能直接打开了后面的页面，或跨站时没有带上进度。可以导入存档，也可以从当前主线继续。</p><a class="button" data-next href="/unsaved/">回到当前线索</a>';
  $("#main").before(block);
  updateLinks();
}
