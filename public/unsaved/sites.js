// Both production origins are already owned; change these together for approved previews.
export const origins = {
  home: "https://sayori.org",
  blog: "https://blog.sayori.org",
};
export const routes = {
  intro: ["blog", "/unsaved/"],
  about: ["home", "/unsaved/"],
  first: ["home", "/unsaved/first/"],
  margins: ["blog", "/unsaved/margins/"],
  links: ["home", "/unsaved/links/"],
  jam: ["home", "/unsaved/jam/"],
  shelf: ["blog", "/unsaved/shelf/"],
  end: ["home", "/unsaved/end/"],
  room: ["home", "/unsaved/room/"],
};

export function sceneUrl(scene, location) {
  const [site, path] = routes[scene];
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const origin = local
    ? `http://${location.hostname}:${site === "blog" ? 4321 : 4322}`
    : origins[site];
  return origin + path;
}
