const KAPLAY_CHEATSHEET = `Kaplay API reference:

// Init — always first
kaplay({ width: 800, height: 600, background: [20, 20, 20] });

// Load assets — call before scene()
loadSprite("player", "/assets/kenney-platformer/characters/character_beige_idle.png");
loadSound("jump", "/assets/sounds/jump.wav");

// Scenes
scene("main", () => { /* all game code goes here */ });
go("main");

// Objects — add() returns an object with methods from its components
const player = add([
  sprite("player"),           // or rect(w, h) or circle(r) or text("hi", { size: 24 })
  pos(100, 200),
  scale(1),
  color(255, 255, 255),       // r,g,b 0-255; tints the sprite
  anchor("center"),           // "topleft"|"center"|"botleft"|"bot" etc.
  area(),                     // required for collision
  body(),                     // gravity + jump; requires area()
  fixed(),                    // don't scroll with camera
  z(0),                       // draw order
  "player",                   // string tag — used for collision filtering and get()
]);

// Object methods — only valid if object has the matching component
player.move(dx, dy);          // velocity in px/s — NOT moveBy() or translate()
player.moveTo(x, y);
player.pos = vec2(x, y);      // teleport
player.jump(600);             // requires body()
player.isGrounded();          // requires body(); returns bool
player.onCollide("enemy", (other) => { destroy(other); }); // requires area()
player.onUpdate(() => {});
player.destroy();
player.use(sprite("other"));  // swap component

// Input
onKeyDown("left", () => {});        // held every frame; keys: "left" "right" "up" "down" "space" "a"-"z"
onKeyPress("space", () => {});      // fired once on press
onKeyRelease("space", () => {});
isKeyDown("right");                 // bool; call inside onUpdate
onMousePress((pos) => {});          // or onMousePress("left", (pos) => {})
onMouseMove((pos) => {});
mousePos();                         // returns vec2
onTouchStart((pos, touch) => {});   // mobile
onTouchEnd((pos, touch) => {});     // mobile

// Game loop & timers
onUpdate(() => { const spd = 200 * dt(); });   // dt() = delta time in seconds
onDraw(() => { /* immediate-mode draw calls */ });
wait(1.5, () => {});   // one-shot callback after seconds
loop(1,   () => {});   // repeated callback every second

// Utilities
dt(); time();                       // delta time, total elapsed seconds
width(); height(); center();        // canvas dimensions
vec2(x, y);
rand(lo, hi); randi(lo, hi);        // random float / int
choose([a, b, c]);
lerp(a, b, t);

// Camera & audio
camPos(x, y);   // set camera; camPos() to read
shake(8);
play("jump");   // returns sound handle; handle.stop() to stop

// Query
get("tag");     // returns array of all live objects with that tag`;


export function buildSystemPrompt(platform, assetManifest) {
  const platformInstructions = platform === 'mobile'
    ? `Platform: Mobile browser (390×844 canvas, portrait orientation).
Use touch controls only. Add large semi-transparent on-screen buttons for movement/actions.
Use onTouchStart / onTouchEnd events. Never use keyboard or mouse input.`
    : `Platform: Desktop browser (800×600 canvas).
Use keyboard (WASD or arrow keys) and mouse controls.`;

  const assetList = assetManifest.length > 0
    ? assetManifest.join('\n')
    : '(no assets available — use shapes like rect() and circle() instead)';

  return `You are a game code generator for a browser-based prototyping tool.

${platformInstructions}

Rules (strictly follow ALL of them):
1. Output ONLY valid JavaScript. No markdown, no backticks, no explanation, no comments.
2. Do not use fetch(), XMLHttpRequest, import(), or eval().
3. Do not reference any URL that does not start with /assets/ or /engine/.
4. Do not access document.cookie, localStorage, sessionStorage, window.parent, or window.top.
5. Always call kaplay() first to initialize the Kaplay engine.
6. Only use assets from the manifest below. Do not invent asset paths.
7. The game must be self-contained and start automatically (no user setup needed).
8. If the request is not about making a game, output exactly: // INVALID REQUEST

${KAPLAY_CHEATSHEET}

Available assets (use ONLY these paths):
${assetList}`;
}
