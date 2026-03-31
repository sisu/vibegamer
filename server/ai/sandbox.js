import vm from 'vm';

const KAPLAY_GLOBALS = [
  'kaboom','scene','go','add','make','readd','get','query','destroy','destroyAll',
  'pos','scale','rotate','color','opacity','sprite','text','polygon','rect','circle','uvquad',
  'area','anchor','z','layer','outline','body','offscreen','follow',
  'health','lifespan','named','state','timer','fixed','stay','textInput','tile',
  'particles','shader','mask','fadeIn','animate',
  'loadSprite','loadSpriteAtlas','loadSound','loadFont','loadBitmapFont','loadShader','loadAseprite',
  'on','onLoad','onLoadError','onLoading','onError','onResize','onCleanup',
  'onUpdate','onFixedUpdate','onDraw','onAdd','onDestroy','onUse','onUnuse','onTag','onUntag',
  'onKeyDown','onKeyPress','onKeyPressRepeat','onKeyRelease',
  'onCharInput','onMouseDown','onMousePress','onMouseRelease','onMouseMove','onScroll',
  'onTouchStart','onTouchMove','onTouchEnd',
  'onCollide','onCollideUpdate','onCollideEnd',
  'onClick','onHover','onHoverUpdate','onHoverEnd',
  'onGamepadButtonDown','onGamepadButtonPress','onGamepadButtonRelease','onGamepadStick',
  'onGamepadConnect','onGamepadDisconnect','onHide','onShow',
  'isKeyDown','isKeyPressed','isKeyReleased','isKeyJustPressed',
  'isMouseDown','isMousePressed','isMouseReleased','isMouseMoved',
  'mousePos','mouseDeltaPos','mouseButtons',
  'vec2','rgb','hsl2rgb','quad','rng','rand','randi','randSeed','choose','chance',
  'lerp','map','mapc','clamp','step','dt','time','isFocused',
  'width','height','center','camPos','camScale','camRot','camFlash','shake',
  'setCamPos','setCamScale','setCamRot','getBackground','setBackground',
  'setGravity','getGravity','addLevel',
  'drawSprite','drawText','drawRect','drawLine','drawLines','drawTriangle',
  'drawCircle','drawEllipse','drawPolygon','drawCurve',
  'pushTransform','popTransform','pushTranslate','pushScale','pushRotate',
  'play','burp','volume','setVolume',
  'wait','loop','tween','easings','cancel',
  'testAabb','testCirclePolygon','testLineLine','testLinePoint',
  'debug','quit','focus',
];

// Returns a Proxy that absorbs any property access or call, enabling chaining.
// Target must be a function so that apply/construct traps are valid in V8.
function makeProxy() {
  return new Proxy(function () {}, {
    get:       () => makeProxy(),
    apply:     () => makeProxy(),
    construct: () => makeProxy(),
  });
}

function buildContext() {
  const ctx = {
    console, Math, JSON,
    Array, Object, String, Number, Boolean,
    parseInt, parseFloat, isNaN, isFinite,
    Date, RegExp, Error, Map, Set, Promise,
    setTimeout: () => {}, clearTimeout: () => {},
    setInterval: () => {}, clearInterval: () => {},
  };
  for (const name of KAPLAY_GLOBALS) ctx[name] = makeProxy();
  return vm.createContext(ctx);
}

// Returns { valid: true } or { valid: false, error: string }.
export function sandboxTest(code) {
  let script;
  try {
    script = new vm.Script(code);                        // syntax check
  } catch (err) {
    return { valid: false, error: err.message.split('\n')[0] };
  }
  try {
    script.runInContext(buildContext(), { timeout: 500 }); // execution check
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message.split('\n')[0] };
  }
}
