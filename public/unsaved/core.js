export const VERSION = 1;
export const STORAGE_KEY = "amiya.unsaved.v1";
export const prerequisites = {
  start: [],
  profiles: ["start"],
  first: ["profiles"],
  margins: ["first"],
  network: ["margins"],
  jam: ["network"],
  shelf: ["jam"],
  finish: ["shelf"],
  room: ["profiles"],
};
export const scenes = [
  "intro",
  "about",
  "first",
  "margins",
  "links",
  "jam",
  "shelf",
  "end",
  "room",
];
export const records = [
  "builder",
  "collector",
  "observer",
  "reason",
  "value",
  "detour",
];
export const endings = ["make", "share", "space"];
const maxSaveLength = 8192;

export function freshState(id = crypto.randomUUID()) {
  return { version: VERSION, id, flags: [], seen: [], hints: {}, endings: [] };
}

function stringList(value, allowed) {
  return (
    Array.isArray(value) &&
    value.length <= allowed.length &&
    value.every((item) => typeof item === "string" && allowed.includes(item)) &&
    new Set(value).size === value.length
  );
}

export function validateState(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "endings,flags,hints,id,seen,version" ||
    value.version !== VERSION ||
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9-]{8,64}$/.test(value.id) ||
    !stringList(value.flags, Object.keys(prerequisites)) ||
    !stringList(value.seen, records) ||
    !stringList(value.endings, endings) ||
    !value.hints ||
    typeof value.hints !== "object" ||
    Array.isArray(value.hints) ||
    Object.entries(value.hints).some(
      ([key, n]) =>
        !scenes.includes(key) || !Number.isInteger(n) || n < 0 || n > 3,
    )
  ) {
    throw new Error("这份存档格式不符或版本不支持；当前进度未被替换。");
  }
  for (const flag of value.flags) {
    if (
      !prerequisites[flag].every((required) => value.flags.includes(required))
    ) {
      throw new Error("存档缺少前置线索；请使用完整导出的存档。");
    }
  }
  if (value.endings.length && !value.flags.includes("finish"))
    throw new Error("结尾记录缺少通关进度。");
  return structuredClone(value);
}

export function readSave(text) {
  if (typeof text !== "string" || text.length > maxSaveLength)
    throw new Error("存档过长；请导入本作导出的 JSON 文件。");
  return validateState(JSON.parse(text));
}

export function encodeState(state) {
  return btoa(JSON.stringify(validateState(state)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeState(token) {
  if (!/^[A-Za-z0-9_-]{1,8192}$/.test(token))
    throw new Error("携带码损坏；请从上一页重新打开链接，或导入存档。");
  return readSave(atob(token.replaceAll("-", "+").replaceAll("_", "/")));
}

export function mergeState(local, incoming) {
  validateState(local);
  validateState(incoming);
  if (local.id !== incoming.id)
    throw new Error("这是另一局进度，需要先选择保留哪一局。");
  return validateState({
    ...local,
    flags: [...new Set([...local.flags, ...incoming.flags])],
    seen: [...new Set([...local.seen, ...incoming.seen])],
    endings: [...new Set([...local.endings, ...incoming.endings])],
    hints: Object.fromEntries(
      scenes
        .filter((key) => local.hints[key] || incoming.hints[key])
        .map((key) => [
          key,
          Math.max(local.hints[key] || 0, incoming.hints[key] || 0),
        ]),
    ),
  });
}

export function complete(state, flag) {
  if (
    !Object.hasOwn(prerequisites, flag) ||
    !prerequisites[flag].every((item) => state.flags.includes(item))
  ) {
    throw new Error(`不能完成 ${flag}：尚未走到这个节点。`);
  }
  return validateState({
    ...state,
    flags: [...new Set([...state.flags, flag])],
  });
}

export function nextScene(state) {
  for (const [flag, scene] of [
    ["start", "intro"],
    ["profiles", "about"],
    ["first", "first"],
    ["margins", "margins"],
    ["network", "links"],
    ["jam", "jam"],
    ["shelf", "shelf"],
    ["finish", "end"],
  ]) {
    if (!state.flags.includes(flag)) return scene;
  }
  return "end";
}

export function canVisit(state, scene) {
  const required = {
    intro: null,
    about: "start",
    first: "profiles",
    margins: "first",
    links: "margins",
    jam: "network",
    shelf: "jam",
    end: "shelf",
    room: "profiles",
  }[scene];
  return required === null || state.flags.includes(required);
}

export const levels = {
  first: [
    "#########",
    "#S..#..G#",
    "#...#...#",
    "#.b.s.|.#",
    "#.......#",
    "#########",
  ],
  jam: [
    "#########",
    "#S..~..G#",
    "###.#.###",
    "#...#...#",
    "#...#...#",
    "#########",
  ],
  end: [
    "#########",
    "#S......#",
    "###.###.#",
    "#...#...#",
    "#.###.G.#",
    "#########",
  ],
};

export function startBoard(level) {
  let player,
    box = null;
  level.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell === "S") player = [x, y];
      if (cell === "b") box = [x, y];
    }),
  );
  if (!player) throw new Error("关卡缺少出生点。");
  return { player, box, powered: false, won: false, moves: 0 };
}

export function moveBoard(
  level,
  board,
  direction,
  modules = ["move", "bridge", "goal"],
) {
  if (board.won) return { board, message: "已经抵达。可以重玩，也可以继续。" };
  if (!modules.includes("move"))
    return {
      board,
      message: "角色还没有移动模块。返回编辑器，把移动放进计划。",
    };
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[
    direction
  ];
  if (!delta) throw new Error("未知移动方向。");
  const [dx, dy] = delta;
  const [x, y] = [board.player[0] + dx, board.player[1] + dy];
  const cell = level[y]?.[x];
  if (!cell || cell === "#")
    return { board, message: "前面是墙。换条路，或撤销上一步。" };
  if (cell === "|" && !board.powered)
    return { board, message: "门没通电。把箱子推到圆形开关；开关会保持开启。" };
  if (cell === "~" && !modules.includes("bridge"))
    return {
      board,
      message: "这里少一座桥。增加桥模块，不需要再增加一个世界。",
    };
  let box = board.box;
  if (box && box[0] === x && box[1] === y) {
    const next = level[y + dy]?.[x + dx];
    if (!next || ["#", "|", "~", "G"].includes(next))
      return { board, message: "箱子推不过去。撤销后，从另一侧接近。" };
    box = [x + dx, y + dy];
  }
  const powered =
    board.powered || Boolean(box && level[box[1]][box[0]] === "s");
  const atGoal = cell === "G";
  const won =
    atGoal && modules.includes("goal") && (level !== levels.first || powered);
  const message =
    atGoal && !modules.includes("goal")
      ? "走到了旗子，但还没写结束条件。回编辑器添加终点。"
      : atGoal && !won
        ? "先让箱子触发开关，才算把这件小东西做完。"
        : won
          ? "到了。这个小小的世界，确实可以走完。"
          : !board.powered && powered
            ? "咔哒。灯亮了，门会一直开着。"
            : `走了 ${board.moves + 1} 步。`;
  return {
    board: { player: [x, y], box, powered, won, moves: board.moves + 1 },
    message,
  };
}

export const moduleCosts = {
  move: 2,
  bridge: 2,
  goal: 1,
  undo: 1,
  boss: 4,
  shop: 3,
  daily: 2,
};
export const budget = (modules) =>
  modules.reduce((sum, id) => sum + moduleCosts[id], 0);
export const linkPairs = [
  "game>ai",
  "ai>community",
  "community>server",
  "server>web",
  "web>toy",
];

export function endingFor(items) {
  if (
    items.length !== 2 ||
    new Set(items).size !== 2 ||
    items.some((x) => !["flag", "tool", "margin"].includes(x))
  ) {
    throw new Error("请选择两件不同的纪念物。");
  }
  if (!items.includes("margin")) return "make";
  return items.includes("flag") ? "share" : "space";
}
