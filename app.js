const stage = document.querySelector("#stage");

const DESIGN = { width: 1920, height: 1080 };
const PAINTS = ["paint1.svg", "paint2.svg", "paint3.svg"];
const FAST_MODE = new URLSearchParams(window.location.search).has("fast");
const VOICE_REFERENCE_URL = "./assets/audio/scat1.wav";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBbH555UQXFEOzdsxUmgT08g8iKgHG44uQ",
  authDomain: "uncomfortable-chorus-1d953.firebaseapp.com",
  databaseURL: "https://uncomfortable-chorus-1d953-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "uncomfortable-chorus-1d953",
  storageBucket: "uncomfortable-chorus-1d953.firebasestorage.app",
  messagingSenderId: "944539009089",
  appId: "1:944539009089:web:fdd06bf3aea80a33ca46c0"
};
const FIREBASE_ROOM_ID = "main";
const CLIENT_ID = getClientId();
const IS_SAFARI = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
if (IS_SAFARI) document.documentElement.classList.add("is-safari");
const HAIR_LAYOUTS = {
  1: { x: 170.00, y: -19.00, w: 331.01, h: 109.32 },
  2: { x: 85.64, y: -70.48, w: 503.15, h: 241.62 },
  3: { x: 70.50, y: -84.63, w: 591.80, h: 512.38 },
  4: { x: 76.32, y: -93.52, w: 741.61, h: 827.10 },
  5: { x: 72.04, y: -99.00, w: 1218.51, h: 941.37 },
  6: { x: -62.77, y: -99.00, w: 2105.78, h: 959.90 }
};
const BEARD_LAYOUTS = {
  1: { x: 259.00, y: 201.00, w: 169, h: 135 },
  2: { x: 248.64, y: 200.64, w: 169, h: 175 },
  3: { x: 259.00, y: 201.00, w: 169, h: 274 },
  4: { x: 258.98, y: 201.00, w: 169, h: 475 },
  5: { x: 259.00, y: 201.00, w: 285, h: 593 },
  6: { x: 222.35, y: 201.00, w: 724, h: 641 }
};
const HAIR_CHANNELS = ["Noise", "Air", "Openness", "Massiness"];
const BEARD_CHANNELS = ["Eye Contact", "Social Contact", "No Choice"];
const STORY_TEXTS = [
  "So, this website becomes a small space for experiences that are usually dismissed as “minor complaints” or “not urgent enough.” It is a project that translates everyday discomforts into the visual language of design, so they can be seen, shared, and discussed together.",
  "This project was also inspired by sociologist, critical theorist, and philosopher Nancy Fraser’s idea of “counterpublics”, in which she argued for the need for alternative spaces of conversation outside the dominant public sphere.",
  "After running into the limits of physical solutions a few times, I began to think that the first thing we needed was to make this discomfort visible and share it with others. It was a kind of uneasiness that had not yet been given an official language, something that stayed inside each person without really being named.",
  "But realistically, I was just one person, far too small to bring about any real structural change. There were also so many other issues that seemed more urgent. And at the same time, the space was not so unbearably inconvenient that it was completely unusable.",
  "In March 2026, after the Design Department temporarily lost Building 49 and was replaced with a single room called Wooseok Hall, I began thinking about how to deal with this situation.",
  "In Relational Aesthetics, French critic and curator Nicolas Bourriaud introduces the idea of micro-utopia. Rather than trying to change the whole world through one grand revolution, he focuses on creating small, temporary spaces that feel livable through humor, conversation, and connection."
];

const state = {
  screen: "story",
  storyIndex: 0,
  storyTransitioning: false,
  paintMarks: [],
  micStatus: "unknown",
  micLevel: 0,
  timerTotal: FAST_MODE ? 8 : 600,
  timerLeft: FAST_MODE ? 8 : 600,
  timerRunning: false,
  timerId: null,
  submitted: false,
  sliders: {
    Noise: 4,
    Air: 4,
    "Eye Contact": 4,
    Openness: 4,
    Massiness: 4,
    "Social Contact": 4,
    "No Choice": 4
  },
  chairColor: "#ffffff",
  character: null,
  ready: false,
  readyCount: 0,
  firebaseReady: false,
  firebaseStatus: "loading",
  firebaseError: "",
  chorusVoiceCount: 1,
  chorusInvite: null,
  chorusJoined: false,
  remoteCharacters: [],
  lastChorusSessionId: null,
  chorusEnteredAt: 0,
  player: { x: 865, y: 430 },
  singMoved: false
};

let audioContext = null;
let analyser = null;
let micStream = null;
let micAnimation = null;
let firebaseApi = null;
let firebaseDb = null;
let participantRef = null;
let sessionRef = null;
let participantsUnsubscribe = null;
let sessionUnsubscribe = null;
let voiceReferenceBuffer = null;
let voiceReferencePromise = null;

function resizeStage() {
  const scale = Math.min(window.innerWidth / DESIGN.width, window.innerHeight / DESIGN.height);
  stage.style.setProperty("--stage-scale", scale);
}

window.addEventListener("resize", resizeStage);
resizeStage();
simulateMic();
initFirebase();

function html(strings, ...values) {
  return strings.reduce((acc, str, index) => acc + str + (values[index] ?? ""), "");
}

function getClientId() {
  const key = "p2-chair-client-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function initFirebase() {
  try {
    const [{ initializeApp }, databaseModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    firebaseApi = databaseModule;
    firebaseDb = databaseModule.getDatabase(app);
    state.firebaseReady = true;
    state.firebaseStatus = "connected";
    state.firebaseError = "";
    subscribeChorusRoom();
    if (state.chorusJoined) publishParticipant();
  } catch (error) {
    state.firebaseReady = false;
    state.firebaseStatus = "offline";
    state.firebaseError = error?.message || "Firebase import failed.";
    console.warn("Firebase is unavailable; chorus room will use local mode.", error);
  }
}

function render() {
  document.body.classList.toggle("story-body", state.screen === "story" || state.screen === "sing3");
  stage.innerHTML = "";
  if (state.screen === "story") renderStory();
  if (state.screen === "make1") renderMake1();
  if (state.screen === "make2") renderMake2(false);
  if (state.screen === "make3") renderMake3(false);
  if (state.screen === "make4") renderMake3(true);
  if (state.screen === "make5") renderMake5();
  if (state.screen === "sing1") renderSing(false);
  if (state.screen === "sing2") renderSing(true);
  if (state.screen === "sing3") renderEnding();
}

function screenShell(className = "") {
  const screen = document.createElement("section");
  screen.className = `screen ${className}`;
  stage.appendChild(screen);
  return screen;
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function renderStory() {
  state.storyTransitioning = false;
  const screen = screenShell("story-screen");
  const storyText = STORY_TEXTS[STORY_TEXTS.length - 1 - state.storyIndex];
  screen.innerHTML = html`
    <div class="story-wall-rig" data-wall-rig>
      <div class="story-wheel left"></div>
      <div class="story-wheel right"></div>
      <div class="story-wall" data-wall>
        <div class="story-text">${storyText}</div>
        <div class="story-page">${state.storyIndex + 1}/${STORY_TEXTS.length}</div>
      </div>
    </div>
  `;
  const wall = screen.querySelector("[data-wall]");
  const wallRig = screen.querySelector("[data-wall-rig]");
  screen.addEventListener("click", event => {
    if (state.storyTransitioning) return;
    state.storyTransitioning = true;
    const rect = wall.getBoundingClientRect();
    const scale = rect.width / 1800;
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    if (x >= 0 && x <= 1800 && y >= 0 && y <= 960) {
      const mark = {
        x,
        y,
        storyIndex: state.storyIndex,
        src: PAINTS[state.paintMarks.length % PAINTS.length],
        width: 170 + Math.random() * 170,
        rotation: -26 + Math.random() * 52,
        loudness: state.micLevel,
        faded: false
      };
      state.paintMarks.push(mark);
      persistPaintMarks();
      const markEl = createPaintMark(mark);
      wall.appendChild(markEl);
      window.setTimeout(() => {
        mark.faded = true;
        markEl.classList.add("faded");
      }, 1000);
    }
    window.setTimeout(() => {
      if (state.storyIndex < STORY_TEXTS.length - 1) {
        state.storyIndex += 1;
        render();
      } else {
        wallRig.classList.add("slide-out-left");
        window.setTimeout(() => {
          state.screen = "make1";
          render();
        }, 880);
      }
    }, 430);
  });
}

function createPaintMark(mark) {
  const img = document.createElement("img");
  img.className = `paint-mark ${mark.faded ? "faded" : ""}`;
  img.src = `./assets/${mark.src}`;
  img.alt = "";
  img.style.left = `${mark.x}px`;
  img.style.top = `${mark.y}px`;
  img.style.setProperty("--paint-w", `${mark.width}px`);
  img.style.setProperty("--paint-r", `${mark.rotation}deg`);
  img.style.setProperty("--paint-opacity", String(.18 + Math.min(1, mark.loudness ?? state.micLevel) * .82));
  return img;
}

function renderMake1() {
  const screen = screenShell();
  screen.innerHTML = html`
    <div class="panel" style="left:616px;top:315px;width:687px;height:449px"></div>
    <div class="panel-glow" style="left:677px;top:361px;width:565px;height:71px"></div>
    <div class="mic-copy">
      Please allow microphone access
      <small>*Audio is never recorded or transmitted;<br>it is automatically converted into<br>numerical data and immediately discarded.</small>
    </div>
    <button class="button" data-action="later" style="left:677px;top:644px;width:245px">Do it later</button>
    <button class="button" data-action="accept" style="left:997px;top:644px;width:245px">Accept</button>
  `;
  screen.querySelector("[data-action='later']").addEventListener("click", () => {
    state.micStatus = "later";
    state.screen = "make2";
    render();
  });
  screen.querySelector("[data-action='accept']").addEventListener("click", async () => {
    await requestMic();
    state.screen = "make2";
    render();
  });
}

function renderMake2(showModal) {
  const screen = screenShell();
  screen.innerHTML = timerMarkup("Your portrait<br>will be completed in 10 minutes.") + controlsMarkup() + chairMarkup({ color: currentNoiseColor(), intensity: 0, alignMake: true });
  bindControls(screen);
  screen.querySelector("[data-action='start']").addEventListener("click", async () => {
    if (state.micStatus === "later" || state.micStatus === "unknown") {
      showMicModal(screen, async () => {
        await requestMic();
        startTimer();
        state.screen = "make3";
        render();
      });
      return;
    }
    startTimer();
    state.screen = "make3";
    render();
  }, { once: true });
  if (showModal) showMicModal(screen, requestMic);
}

function renderMake3(locked) {
  const screen = screenShell(locked ? "locked" : "");
  const message = state.timerLeft > 420 ? "Please wait a minute..." : state.timerLeft > 180 ? "The portrait is listening..." : "Almost grown.";
  screen.innerHTML = timerMarkup(message) + controlsMarkup() + chairMarkup({
    color: currentNoiseColor(),
    intensity: 0,
    singing: false,
    alignMake: true
  }) + sliderMarkup(locked);
  bindControls(screen);
  const start = screen.querySelector("[data-action='start']");
  if (start) start.addEventListener("click", startTimer);
  bindSliders(screen, locked);
  const submit = screen.querySelector("[data-action='submit']");
  submit.textContent = locked ? "Submitted" : "Submit";
  submit.disabled = locked;
  submit.classList.toggle("disabled", locked);
  if (!locked) {
    submit.addEventListener("click", () => {
      state.submitted = true;
      state.screen = "make4";
      updateCharacterFromState();
      render();
    });
  }
}

function renderMake5() {
  if (!state.character) updateCharacterFromState();
  const screen = screenShell();
  const date = state.character.date || formatDate(new Date());
  screen.innerHTML = html`
    ${chairMarkup({
      color: state.character.color,
      intensity: state.character.intensity,
      hairLevel: state.character.hairLevel,
      beardLevel: state.character.beardLevel
    })}
    <div class="panel" style="left:60px;top:60px;width:492px;height:358px"></div>
    <div class="complete-title">Your portrait has been completed.</div>
    <label class="name-label">Nickname:</label>
    <label class="date-label">Date Made:</label>
    <input class="name-field" data-name placeholder="|" value="${state.character.nickname || ""}">
    <div class="date-field">${date}</div>
    <button class="button" data-action="reset" style="left:60px;top:445px;width:148px">Reset</button>
    <button class="button green" data-action="enter" style="left:230px;top:445px;width:322px;font-size:28px">Enter the chorus room</button>
  `;
  const name = screen.querySelector("[data-name]");
  name.focus();
  name.addEventListener("input", () => {
    state.character.nickname = name.value.trim();
    persistCharacter();
  });
  screen.querySelector("[data-action='reset']").addEventListener("click", resetMake);
  screen.querySelector("[data-action='enter']").addEventListener("click", () => {
    unlockAudio();
    state.character.nickname = name.value.trim() || "untitled chair";
    state.character.date = date;
    persistCharacter();
    state.player = { x: 865, y: 430 };
    state.ready = false;
    state.singMoved = false;
    state.chorusEnteredAt = Date.now();
    state.chorusInvite = null;
    joinChorusRoom();
    state.screen = "sing1";
    render();
  });
}

function renderSing(singing) {
  const screen = screenShell();
  const characters = getChorusCharacters();
  if (singing) startSyntheticChoir(state.chorusVoiceCount || currentChorusVoiceCount());
  else stopSyntheticChoir();
  screen.classList.toggle("sing-spotlight", !singing && !state.singMoved);
  screen.innerHTML = html`
    <div class="chorus-room">
      ${perspectiveRoomMarkup()}
      ${characters.map((character, index) => miniCharacterMarkup(character, index, singing)).join("")}
      ${!singing ? '<button class="button" data-action="ready" style="left:560px;top:165px;width:320px;z-index:8">Ready to sing <span data-ready-count>+' + state.readyCount + '</span></button><button class="button green" data-action="sing" style="left:1048px;top:165px;width:320px;z-index:8">Let&#39;s sing together</button>' : ""}
      ${!singing && state.chorusInvite ? chorusInviteMarkup() : ""}
    </div>
  `;
  const playerEl = screen.querySelector("[data-player='true']");
  if (playerEl) {
    window.onkeydown = event => movePlayer(event, playerEl);
  }
  const ready = screen.querySelector("[data-action='ready']");
  if (ready) ready.addEventListener("click", () => {
    unlockAudio();
    if (state.ready) return;
    state.ready = true;
    state.readyCount = Math.max(state.readyCount, getChorusCharacters().filter(character => character.id !== CLIENT_ID && character.ready).length + 1);
    publishParticipant({ ready: true });
    ready.querySelector("[data-ready-count]").textContent = `+${state.readyCount}`;
  });
  const sing = screen.querySelector("[data-action='sing']");
  if (sing) sing.addEventListener("click", () => {
    unlockAudio();
    startChorusTogether();
  });
  const acceptInvite = screen.querySelector("[data-action='accept-chorus-invite']");
  if (acceptInvite) acceptInvite.addEventListener("click", acceptChorusInvite);
  const dismissInvite = screen.querySelector("[data-action='dismiss-chorus-invite']");
  if (dismissInvite) dismissInvite.addEventListener("click", dismissChorusInvite);
}

function renderEnding() {
  stopSyntheticChoir();
  const screen = screenShell("story-screen");
  const character = state.character || getChorusCharacters()[0];
  screen.innerHTML = html`
    <div class="photo-zone">
      <div class="placard">CHAIR CHORUS PHOTO ZONE</div>
      <div class="photo-characters">
        ${miniCharacterMarkup(character, 0, true)}
      </div>
      <div class="ending-actions">
        <button class="button replay-chorus" data-action="replay">Play Again</button>
        <button class="button green download-character" data-action="download">Download Character</button>
      </div>
      <a class="copyright" href="https://www.instagram.com/yeonjoookim/" target="_blank" rel="noreferrer">©2026. Yeonjoo Kim All Rights Reserved.</a>
    </div>
  `;
  screen.querySelector("[data-action='replay']").addEventListener("click", () => {
    unlockAudio();
    showChorusPerformance(`${Date.now()}-replay-${CLIENT_ID}`, false, currentChorusVoiceCount());
  });
  screen.querySelector("[data-action='download']").addEventListener("click", downloadCharacterPng);
}

function perspectiveRoomMarkup() {
  const paintMarks = chorusPaintMarksMarkup();
  return html`
    <svg class="perspective-room" viewBox="0 0 1920 1080" aria-hidden="true">
      <defs>
        ${CHORUS_PANELS.map((panel, index) => `<clipPath id="chorusPanel${index}"><polygon points="${panel.points.map(point => point.join(",")).join(" ")}"/></clipPath>`).join("")}
      </defs>
      <path d="M420 80H1500V392H420Z" fill="#fff" stroke="#040000" stroke-width="1"/>
      <path d="M20 1040L420 392V80L20 728Z" fill="#fff" stroke="#040000" stroke-width="1"/>
      <path d="M1900 1040L1500 392V80L1900 728Z" fill="#fff" stroke="#040000" stroke-width="1"/>
      <path d="M20 1040H1900L1500 392H420Z" fill="#fff" stroke="#040000" stroke-width="1"/>
      ${paintMarks}
      <path d="M420 392H1500" fill="none" stroke="#040000" stroke-width="1"/>
      <path d="M220 404L220 716" fill="none" stroke="#040000" stroke-width="1"/>
      <path d="M960 80V392" fill="none" stroke="#040000" stroke-width="1"/>
      <path d="M1700 404L1700 716" fill="none" stroke="#040000" stroke-width="1"/>
      ${chorusWheelsMarkup()}
    </svg>
  `;
}

const CHORUS_PANELS = [
  { points: [[20, 728], [220, 404], [220, 716], [20, 1040]], angle: -58, scale: .18, squeeze: .42 },
  { points: [[220, 404], [420, 80], [420, 392], [220, 716]], angle: -42, scale: .21, squeeze: .64 },
  { points: [[420, 80], [960, 80], [960, 392], [420, 392]], angle: 0, scale: .24, squeeze: 1 },
  { points: [[960, 80], [1500, 80], [1500, 392], [960, 392]], angle: 0, scale: .24, squeeze: 1 },
  { points: [[1500, 80], [1700, 404], [1700, 716], [1500, 392]], angle: 42, scale: .21, squeeze: .64 },
  { points: [[1700, 404], [1900, 728], [1900, 1040], [1700, 716]], angle: 58, scale: .18, squeeze: .42 }
];

function interpolatePoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function panelPoint(panel, u, v) {
  const top = interpolatePoint(panel.points[0], panel.points[1], u);
  const bottom = interpolatePoint(panel.points[3], panel.points[2], u);
  return interpolatePoint(top, bottom, v);
}

function unitVector(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

function panelMatrix(panel, x, y, width, height) {
  const xAxis = unitVector(panel.points[0], panel.points[1]);
  const yAxis = unitVector(panel.points[0], panel.points[3]);
  const a = xAxis[0];
  const b = xAxis[1];
  const c = yAxis[0];
  const d = yAxis[1];
  const e = x - a * width / 2 - c * height / 2;
  const f = y - b * width / 2 - d * height / 2;
  return `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${e.toFixed(2)} ${f.toFixed(2)})`;
}

function chorusPaintMarksMarkup() {
  return state.paintMarks.filter(mark => Number.isFinite(mark.storyIndex)).map((mark, index) => {
    const panelIndex = Math.min(5, Math.max(0, mark.storyIndex));
    const panel = CHORUS_PANELS[panelIndex];
    const localX = Math.min(.82, Math.max(.18, mark.x / 1800));
    const localY = Math.min(.62, Math.max(.18, .18 + (mark.y / 960) * .44));
    const [x, y] = panelPoint(panel, localX, localY);
    const size = mark.width * panel.scale * 3.8 * (1 - localY * .08);
    const opacity = .68 + Math.min(1, mark.loudness ?? state.micLevel) * .24;
    const width = size * panel.squeeze;
    const height = size * .72;
    const transform = panelMatrix(panel, x, y, width, height);
    return `<g class="chorus-paint-group" clip-path="url(#chorusPanel${panelIndex})"><image class="chorus-paint" href="${assetUrl(`./assets/${mark.src}`)}" x="0" y="0" width="${width}" height="${height}" opacity="${opacity}" transform="${transform}" preserveAspectRatio="xMidYMid meet"></image></g>`;
  }).join("");
}

function chorusWheelsMarkup() {
  const positions = [.27, .73];
  const wheels = CHORUS_PANELS.flatMap((panel, panelIndex) => {
    const left = panel.points[3];
    const right = panel.points[2];
    const dx = right[0] - left[0];
    const dy = right[1] - left[1];
    const len = Math.hypot(dx, dy) || 1;
    const normal = [-dy / len, dx / len];
    const scale = panelIndex === 0 || panelIndex === 5 ? .82 : panelIndex === 1 || panelIndex === 4 ? .62 : .46;
    const r = 7.25 * scale;
    return positions.map(u => {
      const [baseX, baseY] = panelPoint(panel, u, 1);
      return {
        x: baseX + normal[0] * r,
        y: baseY + normal[1] * r,
        r,
        inner: 4.5 * scale
      };
    });
  });
  return wheels.map(wheel => {
    return `<g class="chorus-wheel" opacity=".72"><circle cx="${wheel.x.toFixed(2)}" cy="${wheel.y.toFixed(2)}" r="${wheel.r.toFixed(2)}" fill="#040000"/><circle cx="${wheel.x.toFixed(2)}" cy="${wheel.y.toFixed(2)}" r="${wheel.inner.toFixed(2)}" fill="#7e7e7e"/></g>`;
  }).join("");
}

function timerMarkup(message) {
  return html`
    <div class="panel timer-panel"></div>
    <div class="panel-glow timer-shadow"></div>
    <div class="timer-number" data-timer>${formatTime(state.timerLeft)}</div>
    <div class="timer-message">${message}</div>
  `;
}

function controlsMarkup() {
  return html`
    <button class="button" data-action="start" style="left:60px;top:445px;width:148px">Start</button>
    <button class="button" data-action="pause" style="left:232px;top:445px;width:148px">Pause</button>
    <button class="button" data-action="stop" style="left:404px;top:445px;width:148px">Stop</button>
  `;
}

function bindControls(screen) {
  const pause = screen.querySelector("[data-action='pause']");
  const stop = screen.querySelector("[data-action='stop']");
  if (pause) pause.addEventListener("click", pauseTimer);
  if (stop) stop.addEventListener("click", () => {
    pauseTimer();
    state.timerLeft = state.timerTotal;
    state.screen = "make2";
    render();
  });
}

function sliderMarkup(locked) {
  const rows = Object.keys(state.sliders).map((label, index) => {
    const top = 104 + index * 103;
    const value = state.sliders[label];
    const step = (value - 1) / 7;
    const fill = step * 100;
    return html`
      <div class="slider-row" style="top:${top}px;--step:${step};--fill:${fill}%">
        <div class="slider-label ${label.includes(" ") ? "small" : ""}">${label.replace(" ", "<br>")}</div>
        <div class="slider-track">
          <input type="range" min="1" max="8" step="1" value="${value}" data-slider="${label}" ${locked ? "disabled" : ""}>
        </div>
        <div class="slider-knob"></div>
      </div>
    `;
  }).join("");
  return html`
    <div class="slider-panel">
      <div class="panel-glow slider-bg" style="left:0;top:0;width:512px;height:51px"></div>
      <div class="slider-title">How tired are these?</div>
      ${rows}
    </div>
    <button class="button" data-action="submit" style="left:1593px;top:914px;width:260px">Submit</button>
  `;
}

function bindSliders(screen, locked) {
  if (locked) return;
  screen.querySelectorAll("[data-slider]").forEach(input => {
    input.addEventListener("input", () => {
      state.sliders[input.dataset.slider] = Number(input.value);
      const row = input.closest(".slider-row");
      const step = (Number(input.value) - 1) / 7;
      row.style.setProperty("--step", step);
      row.style.setProperty("--fill", `${step * 100}%`);
    });
  });
}

function chairMarkup({ color = "#fff", intensity = 0, hairLevel, beardLevel, singing = false, alignMake = false } = {}) {
  const growth = characterAssetsMarkup({ intensity, hairLevel, beardLevel });
  return html`
    <div class="chair-wrap ${alignMake || state.screen === "make3" || state.screen === "make4" ? "make-wide" : ""}">
      <svg class="chair-svg ${singing ? "singing" : ""}" viewBox="0 0 618 854" role="img" aria-label="chair portrait">
        <g>
          <path d="M39.42 335.93L20 335.96L226.56 137.45L245.98 137.59L39.42 335.93Z" fill="#040000"/>
          <path d="M39.42 335.96H20V371.08H39.42V335.96Z" fill="#040000"/>
          <path d="M96.9 467.69H77.48V767.63H96.9V467.69Z" fill="#fff" stroke="#040000" stroke-width="2"/>
          <path d="M420.64 467.69H401.22V767.63H420.64V467.69Z" fill="#fff" stroke="#040000" stroke-width="2"/>
          <path d="M206.77 357.9H187.35V657.84H206.77V357.9Z" fill="#fff" stroke="#040000" stroke-width="2"/>
          <path d="M530.51 357.9H511.09V657.84H530.51V357.9Z" fill="#fff" stroke="#040000" stroke-width="2"/>
          <g fill="#040000" stroke="#fff" stroke-width="2">
            <ellipse cx="80.14" cy="767.63" rx="19.84" ry="25.73"/>
            <ellipse cx="94.24" cy="767.63" rx="19.84" ry="25.73"/>
            <ellipse cx="403.87" cy="767.63" rx="19.84" ry="25.73"/>
            <ellipse cx="417.98" cy="767.63" rx="19.84" ry="25.73"/>
            <ellipse cx="190.01" cy="657.84" rx="19.84" ry="25.73"/>
            <ellipse cx="204.11" cy="657.84" rx="19.84" ry="25.73"/>
            <ellipse cx="513.75" cy="657.84" rx="19.84" ry="25.73"/>
            <ellipse cx="527.85" cy="657.84" rx="19.84" ry="25.73"/>
          </g>
          <path class="chair-face" d="M132.99 20.64V355.16L21.97 466.1V501.35H446.35L557.36 390.41V20.64H132.99Z" fill="${color}" stroke="#040000" stroke-width="2"/>
          <path d="M537.91 225.98L419.95 335.96V371.08H439.37V335.96L557.33 226.12L537.91 225.98Z" fill="#040000"/>
          <path d="M422.41 91C388.9 91 359.64 109.21 343.99 136.27C359.64 163.33 388.9 181.54 422.41 181.54C455.92 181.54 485.18 163.33 500.83 136.27C485.18 109.21 455.92 91 422.41 91Z" fill="#fff" stroke="#d9d9d9" stroke-width="2"/>
          <path d="M422.15 91.46C415.34 91.46 408.71 92.22 402.33 93.64C386.04 101.15 374.73 117.62 374.73 136.73C374.73 155.85 386.04 172.32 402.34 179.82C408.71 181.25 415.35 182 422.15 182C428.96 182 435.59 181.25 441.97 179.82C458.27 172.32 469.58 155.85 469.58 136.73C469.58 117.62 458.27 101.15 441.98 93.64C435.6 92.22 428.96 91.46 422.15 91.46Z" fill="#040000"/>
          <path d="M265.42 91.46C231.91 91.46 202.65 109.67 187 136.73C202.65 163.79 231.91 182 265.42 182C298.93 182 328.19 163.79 343.84 136.73C328.19 109.67 298.93 91.46 265.42 91.46Z" fill="#fff" stroke="#d9d9d9" stroke-width="2"/>
          <path d="M265.16 91.46C258.35 91.46 251.72 92.22 245.34 93.64C229.05 101.15 217.74 117.62 217.74 136.73C217.74 155.85 229.05 172.32 245.34 179.82C251.72 181.25 258.35 182 265.16 182C271.97 182 278.6 181.25 284.98 179.82C301.28 172.32 312.59 155.85 312.59 136.73C312.59 117.62 301.28 101.15 284.99 93.64C278.61 92.22 271.97 91.46 265.16 91.46Z" fill="#040000"/>
          <g class="growth asset-growth">${growth}</g>
        </g>
        <defs><clipPath id="chairClip"><rect width="538" height="774" fill="#fff" transform="translate(20 20)"/></clipPath></defs>
      </svg>
    </div>
  `;
}

function assetUrl(path) {
  return new URL(path, window.location.href).href;
}

function levelFromAverage(average) {
  return Math.min(6, Math.max(1, Math.ceil(((average - 1) / 7) * 6)));
}

function averageSlider(keys) {
  const values = keys.map(key => Number(state.sliders[key] || 1));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function characterLevelsFromState() {
  return {
    hairLevel: levelFromAverage(averageSlider(HAIR_CHANNELS)),
    beardLevel: levelFromAverage(averageSlider(BEARD_CHANNELS))
  };
}

function levelFromIntensity(intensity) {
  return Math.min(6, Math.max(1, Math.ceil(Math.max(.01, intensity) * 6)));
}

function characterAssetsMarkup({ intensity = 0, hairLevel, beardLevel } = {}) {
  if (intensity <= 0.001 && !hairLevel && !beardLevel) return "";
  const hair = Math.min(6, Math.max(1, Math.round(hairLevel || levelFromIntensity(intensity))));
  const beard = Math.min(6, Math.max(1, Math.round(beardLevel || levelFromIntensity(intensity))));
  const hairBox = HAIR_LAYOUTS[hair];
  const beardBox = BEARD_LAYOUTS[beard];
  return html`
    <image class="beard-asset" href="${assetUrl(`./assets/beard/beard${beard}.svg`)}" x="${beardBox.x}" y="${beardBox.y}" width="${beardBox.w}" height="${beardBox.h}" preserveAspectRatio="none"></image>
    <image class="hair-asset" href="${assetUrl(`./assets/hair/hair${hair}.svg`)}" x="${hairBox.x}" y="${hairBox.y}" width="${hairBox.w}" height="${hairBox.h}" preserveAspectRatio="none"></image>
  `;
}

function growthPaths(intensity) {
  if (intensity <= 0.001) return "";
  const n = Math.max(0, Math.round(3 + intensity * 12));
  const curl = intensity * 72;
  const length = 170 + intensity * 760;
  const hair = Array.from({ length: n }, (_, i) => {
    const x = 282 + i * 10;
    const c = Math.sin(i * 1.35) * curl;
    const shade = i % 3 === 0 ? "#737373" : "#040000";
    const width = 2.2 + intensity * 3.6;
    const startY = 22;
    const topY = -58 - intensity * 80;
    const sweepX = 392 + intensity * 270 + i * 8;
    const floorY = Math.min(804, 255 + length + i * 8);
    const endSpread = (i - n / 2) * (12 + intensity * 14);
    const d = `M${x} ${startY} C${x + 18 + c} ${topY}, ${sweepX - 90 + c} ${topY + 28}, ${sweepX - 20} ${138 + intensity * 92} C${sweepX + 26 + c} ${300 + intensity * 110}, ${sweepX + 8 - c} ${520 + intensity * 120}, ${sweepX + 164 - i * 7 + endSpread} ${floorY}`;
    const dash = i % 4 === 0 ? ` stroke-dasharray="${10 + i} ${7 + intensity * 8}"` : "";
    return `<path d="${d}" stroke="${shade}" stroke-width="${width}"${dash} opacity="${.28 + intensity * .72}"/>`;
  }).join("");
  const beardCount = Math.max(0, Math.round(2 + intensity * 10));
  const beard = Array.from({ length: beardCount }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const x = 338 + side * (8 + rank * 12);
    const c = Math.cos(i * 1.4) * curl * .34;
    const shade = i % 2 === 0 ? "#040000" : "#737373";
    const width = 2 + intensity * 3.2;
    const endX = x + side * (80 + intensity * 180 + rank * 14);
    const endY = Math.min(790, 382 + intensity * 340 + rank * 10);
    const d = `M338 ${286} C${x + side * 24 + c} ${340 + intensity * 42}, ${x + side * 42 - c} ${430 + intensity * 108}, ${endX} ${endY}`;
    const dash = i % 3 === 0 ? ` stroke-dasharray="${8 + rank * 2} ${7 + intensity * 6}"` : "";
    return `<path d="${d}" stroke="${shade}" stroke-width="${width}"${dash} opacity="${.22 + intensity * .72}"/>`;
  }).join("");
  return hair + beard;
}

async function requestMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(micStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    state.micStatus = "accepted";
    monitorMic();
  } catch (error) {
    state.micStatus = "simulated";
    simulateMic();
  }
}

function monitorMic() {
  cancelAnimationFrame(micAnimation);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const average = data.reduce((sum, value) => sum + value, 0) / data.length;
    state.micLevel = Math.min(1, average / 110);
    state.chairColor = currentNoiseColor();
    updateLiveChairColor();
    updateLivePaintOpacity();
    micAnimation = requestAnimationFrame(tick);
  };
  tick();
}

function simulateMic() {
  cancelAnimationFrame(micAnimation);
  const tick = () => {
    const wave = (Math.sin(Date.now() / 410) + 1) / 2;
    state.micLevel = Math.min(1, .02 + wave * .86 + Math.random() * .08);
    state.chairColor = currentNoiseColor();
    updateLiveChairColor();
    updateLivePaintOpacity();
    micAnimation = requestAnimationFrame(tick);
  };
  tick();
}

function showMicModal(screen, onAccept) {
  const modal = document.createElement("div");
  modal.className = "modal-scrim";
  modal.innerHTML = html`
    <div class="modal">
      <div class="panel-glow"></div>
      <div class="mic-copy" style="left:48px;top:60px;width:593px">
        Please allow microphone access
        <small>*Audio is never recorded or transmitted;<br>it is automatically converted into<br>numerical data and immediately discarded.</small>
      </div>
      <button class="button" data-modal="later" style="left:61px;top:329px;width:245px">Do it later</button>
      <button class="button" data-modal="accept" style="left:353px;top:329px;width:245px">Accept</button>
    </div>
  `;
  screen.appendChild(modal);
  modal.querySelector("[data-modal='later']").addEventListener("click", () => modal.remove());
  modal.querySelector("[data-modal='accept']").addEventListener("click", async () => {
    await onAccept();
    modal.remove();
  });
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.timerLeft = Math.max(0, state.timerLeft - 1);
    const timer = document.querySelector("[data-timer]");
    if (timer) timer.textContent = formatTime(state.timerLeft);
    if (state.timerLeft === 0) {
      pauseTimer();
      updateCharacterFromState();
      state.screen = "make5";
      render();
    }
  }, 1000);
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(state.timerId);
}

function resetMake() {
  pauseTimer();
  state.timerLeft = state.timerTotal;
  state.submitted = false;
  state.sliders = Object.fromEntries(Object.keys(state.sliders).map(key => [key, 4]));
  state.character = null;
  state.screen = "make2";
  render();
}

function growthIntensity() {
  const sliderTotal = Object.values(state.sliders).reduce((sum, value) => sum + value, 0);
  return Math.min(1, Math.max(0, (sliderTotal - 7) / 49));
}

function currentNoiseColor() {
  const t = Math.min(1, Math.max(0, (state.micLevel - .04) / .86));
  const r = Math.round(255);
  const gb = Math.round(255 - t * 235);
  return `rgb(${r}, ${gb}, ${gb})`;
}

function updateLiveChairColor() {
  if (!["make2", "make3", "make4"].includes(state.screen)) return;
  document.querySelectorAll(".chair-face").forEach(face => {
    face.setAttribute("fill", currentNoiseColor());
  });
}

function updateLivePaintOpacity() {
  if (state.screen !== "story") return;
  document.querySelectorAll(".paint-mark").forEach(mark => {
    mark.style.setProperty("--paint-opacity", String(.18 + state.micLevel * .82));
  });
}

function currentCharacterColor() {
  const t = Math.max(state.micLevel, growthIntensity() * .72);
  const gb = Math.round(255 - t * 235);
  return `rgb(255, ${gb}, ${gb})`;
}

function updateCharacterFromState() {
  const levels = characterLevelsFromState();
  state.character = {
    color: currentCharacterColor(),
    intensity: growthIntensity(),
    ...levels,
    nickname: state.character?.nickname || "",
    date: state.character?.date || formatDate(new Date())
  };
}

function persistCharacter() {
  if (!state.character) return;
  const existing = loadCharacters().filter(item => item.id !== "mine");
  localStorage.setItem("p2-chair-characters", JSON.stringify([{ ...state.character, id: "mine" }, ...existing].slice(0, 9)));
}

function loadCharacters() {
  try {
    return JSON.parse(localStorage.getItem("p2-chair-characters")) || [];
  } catch {
    return [];
  }
}

function persistPaintMarks() {
  // Paint marks are kept only for the current journey, then exhibited in the chorus room.
}

function loadPaintMarks() {
  return [];
}

function joinChorusRoom() {
  state.chorusJoined = true;
  subscribeChorusRoom();
  publishParticipant({ ready: false });
}

function subscribeChorusRoom() {
  if (!firebaseReadyForUse() || participantsUnsubscribe) return;
  const { ref, onValue } = firebaseApi;
  const participantsRef = ref(firebaseDb, `rooms/${FIREBASE_ROOM_ID}/participants`);
  sessionRef = ref(firebaseDb, `rooms/${FIREBASE_ROOM_ID}/session`);
  participantsUnsubscribe = onValue(participantsRef, snapshot => {
    const data = snapshot.val() || {};
    state.remoteCharacters = Object.entries(data)
      .map(([id, value]) => ({ id, ...value }))
      .filter(character => character && character.nickname)
      .sort((a, b) => {
        if (a.id === CLIENT_ID) return -1;
        if (b.id === CLIENT_ID) return 1;
        return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
      });
    state.readyCount = state.remoteCharacters.filter(character => character.ready).length;
    state.firebaseStatus = "connected";
    state.firebaseError = "";
    if (state.screen === "sing1") render();
  }, error => {
    state.firebaseStatus = "read-failed";
    state.firebaseError = error?.message || "Could not read chorus room.";
    if (state.screen === "sing1") render();
  });
  sessionUnsubscribe = onValue(sessionRef, snapshot => {
    const session = snapshot.val();
    if (!session?.invite || !session.sessionId || session.sessionId === state.lastChorusSessionId) return;
    if (session.startedBy === CLIENT_ID) return;
    if (Number(session.startedAtMs || 0) <= state.chorusEnteredAt) return;
    state.chorusInvite = {
      sessionId: session.sessionId,
      voiceCount: session.voiceCount,
      startedBy: session.startedBy
    };
    if (state.screen === "sing1") render();
  }, error => {
    state.firebaseStatus = "session-read-failed";
    state.firebaseError = error?.message || "Could not read chorus invite.";
    if (state.screen === "sing1") render();
  });
}

function firebaseReadyForUse() {
  return Boolean(firebaseReadyForUseWithoutRefs() && firebaseDb);
}

function firebaseReadyForUseWithoutRefs() {
  return Boolean(state.firebaseReady && firebaseApi);
}

function participantPayload(overrides = {}) {
  if (!state.character) updateCharacterFromState();
  return {
    id: CLIENT_ID,
    nickname: state.character.nickname || "untitled chair",
    date: state.character.date || formatDate(new Date()),
    color: state.character.color,
    intensity: state.character.intensity,
    hairLevel: state.character.hairLevel,
    beardLevel: state.character.beardLevel,
    x: state.player.x,
    y: state.player.y,
    ready: state.ready,
    updatedAt: firebaseApi?.serverTimestamp ? firebaseApi.serverTimestamp() : Date.now(),
    ...overrides
  };
}

function publishParticipant(overrides = {}) {
  if (!firebaseReadyForUse()) return;
  const { ref, set, onDisconnect } = firebaseApi;
  participantRef = participantRef || ref(firebaseDb, `rooms/${FIREBASE_ROOM_ID}/participants/${CLIENT_ID}`);
  set(participantRef, participantPayload(overrides)).catch(error => {
    state.firebaseStatus = "write-failed";
    state.firebaseError = error?.message || "Could not write participant.";
    console.warn("Could not publish participant.", error);
  });
  onDisconnect(participantRef).remove().catch(error => {
    console.warn("Could not attach Firebase disconnect cleanup.", error);
  });
}

function updateParticipant(overrides = {}) {
  if (!firebaseReadyForUse() || !participantRef) return;
  firebaseApi.update(participantRef, {
    ...overrides,
    updatedAt: firebaseApi.serverTimestamp()
  }).catch(error => {
    state.firebaseStatus = "write-failed";
    state.firebaseError = error?.message || "Could not update participant.";
    console.warn("Could not update participant.", error);
  });
}

function startChorusTogether() {
  const sessionId = `${Date.now()}-${CLIENT_ID}`;
  const voiceCount = currentChorusVoiceCount();
  state.lastChorusSessionId = sessionId;
  state.chorusInvite = null;
  publishChorusInvite(sessionId, voiceCount);
  showChorusPerformance(sessionId, true, voiceCount);
}

function publishChorusInvite(sessionId, voiceCount) {
  if (!firebaseReadyForUse() || !sessionRef) return;
  firebaseApi.set(sessionRef, {
    invite: true,
    sessionId,
    voiceCount,
    startedBy: CLIENT_ID,
    startedAtMs: Date.now(),
    startedAt: firebaseApi.serverTimestamp()
  }).catch(error => console.warn("Could not publish chorus invite.", error));
}

function acceptChorusInvite() {
  if (!state.chorusInvite) return;
  unlockAudio();
  const { sessionId, voiceCount } = state.chorusInvite;
  state.lastChorusSessionId = sessionId;
  state.chorusInvite = null;
  showChorusPerformance(sessionId, false, voiceCount);
}

function dismissChorusInvite() {
  state.chorusInvite = null;
  if (state.screen === "sing1") render();
}

function showChorusPerformance(sessionId, shouldCloseRemoteSession, voiceCount = currentChorusVoiceCount()) {
  state.chorusVoiceCount = Math.max(1, Number(voiceCount) || currentChorusVoiceCount());
  state.screen = "sing2";
  render();
  window.setTimeout(() => {
    state.screen = "sing3";
    render();
  }, 10000);
}

function getChorusCharacters() {
  if (state.remoteCharacters.length) return state.remoteCharacters.slice(0, 8);
  const saved = loadCharacters();
  const mine = state.character ? [{ ...state.character, id: "mine" }] : [];
  return [...mine, ...saved.filter(item => item.id !== "mine")].slice(0, 8);
}

function currentChorusVoiceCount() {
  return Math.max(1, Number(state.readyCount) || 0);
}

function chorusInviteMarkup() {
  return html`
    <div class="modal-scrim chorus-invite">
      <div class="modal">
        <div class="chorus-invite-copy">Would you like to sing now with the people in this room?</div>
        <button class="button green" data-action="accept-chorus-invite" style="left:173px;top:329px;width:148px">Yes</button>
        <button class="button" data-action="dismiss-chorus-invite" style="left:366px;top:329px;width:148px">No</button>
      </div>
    </div>
  `;
}

function miniCharacterMarkup(character, index, singing) {
  const initialSing1 = !singing && !state.singMoved;
  const positions = initialSing1
    ? [[state.player.x, state.player.y], [520, 548], [1160, 548], [740, 642], [1035, 650], [420, 675], [1320, 675], [885, 545]]
    : [[state.player.x, state.player.y], [610, 500], [1130, 505], [780, 625], [1030, 635], [430, 650], [1320, 650], [890, 515]];
  const fallback = positions[index % positions.length] || [300 + index * 240, 680];
  const player = character.id === CLIENT_ID || character.id === "mine";
  const x = player && Number.isFinite(character.x) ? character.x : fallback[0];
  const y = player && Number.isFinite(character.y) ? character.y : fallback[1];
  return html`
    <div class="choir-character ${singing ? "singing" : ""}" data-player="${player}" style="left:${x}px;top:${y}px;opacity:${initialSing1 && !player ? .22 : 1}">
      <svg class="mini-chair-svg" viewBox="-100 -110 820 1040" width="260" height="375">
        ${chairMarkup({ color: character.color, intensity: character.intensity, hairLevel: character.hairLevel, beardLevel: character.beardLevel }).match(/<svg[\s\S]*<\/svg>/)[0].replace(/<svg class="chair-svg[^>]*>|<\/svg>/g, "")}
      </svg>
      <div class="character-tag">${character.nickname || "untitled chair"}<br>${character.date || ""}</div>
    </div>
  `;
}

function downloadCharacterSvgString() {
  if (!state.character) return;
  return chairMarkup({
    color: state.character.color,
    intensity: state.character.intensity,
    hairLevel: state.character.hairLevel,
    beardLevel: state.character.beardLevel
  }).match(/<svg[\s\S]*<\/svg>/)[0];
}

function downloadCharacterPng() {
  const svg = downloadCharacterSvgString();
  if (!svg) return;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onerror = () => {
    URL.revokeObjectURL(url);
    console.warn("Could not render character image for download.");
  };
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      if (!pngBlob) {
        console.warn("Could not create PNG download blob.");
        return;
      }
      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `${(state.character.nickname || "chair-character").replace(/\s+/g, "-")}.png`;
      window.__lastCharacterDownload = { filename: link.download, size: pngBlob.size };
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  image.src = url;
}

function movePlayer(event, el) {
  const step = 26;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const shouldRerender = !state.singMoved;
  state.singMoved = true;
  if (event.key === "ArrowUp") state.player.y -= step;
  if (event.key === "ArrowDown") state.player.y += step;
  if (event.key === "ArrowLeft") state.player.x -= step;
  if (event.key === "ArrowRight") state.player.x += step;
  state.player.x = Math.max(0, Math.min(1730, state.player.x));
  state.player.y = Math.max(390, Math.min(690, state.player.y));
  if (shouldRerender) {
    render();
    updateParticipant({ x: state.player.x, y: state.player.y });
    return;
  }
  el.style.left = `${state.player.x}px`;
  el.style.top = `${state.player.y}px`;
  updateParticipant({ x: state.player.x, y: state.player.y });
}

let choirNodes = [];

function unlockAudio() {
  try {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
    ensureVoiceReference();
  } catch (error) {
    console.warn("Could not unlock audio.", error);
  }
}

function ensureVoiceReference() {
  if (voiceReferenceBuffer || voiceReferencePromise) return voiceReferencePromise;
  const ctx = audioContext || new AudioContext();
  audioContext = ctx;
  voiceReferencePromise = fetch(assetUrl(VOICE_REFERENCE_URL))
    .then(response => {
      if (!response.ok) throw new Error(`Voice reference failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then(buffer => ctx.decodeAudioData(buffer))
    .then(decoded => {
      voiceReferenceBuffer = decoded;
      return decoded;
    })
    .catch(error => {
      voiceReferencePromise = null;
      console.warn("Could not load voice reference sample.", error);
      return null;
    });
  return voiceReferencePromise;
}

function startSyntheticChoir(count) {
  stopSyntheticChoir();
  const ctx = audioContext || new AudioContext();
  audioContext = ctx;
  if (ctx.state === "suspended") ctx.resume();
  if (!voiceReferenceBuffer) {
    ensureVoiceReference()?.then(() => startSyntheticChoir(count));
    return;
  }
  const now = ctx.currentTime;
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  master.gain.setValueAtTime(Math.min(.82, .34 + count * .08), now);
  limiter.threshold.setValueAtTime(-6, now);
  limiter.knee.setValueAtTime(18, now);
  limiter.ratio.setValueAtTime(5, now);
  master.connect(limiter).connect(ctx.destination);
  choirNodes = [{ master, limiter }, ...Array.from({ length: Math.max(1, count) }, (_, index) => {
    return scheduleScatVoice(ctx, master, now, index, count);
  })];
}

function stopSyntheticChoir() {
  choirNodes.forEach(node => {
    try { node.osc?.stop(); } catch {}
    try { node.sub?.stop(); } catch {}
    try { node.sample?.stop(); } catch {}
    try { node.mod?.stop(); } catch {}
    try { node.lfo?.stop(); } catch {}
    try { node.noise?.stop(); } catch {}
  });
  choirNodes = [];
}

function scheduleScatVoice(ctx, destination, start, index, count) {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const delay = index * .62;
  source.buffer = voiceReferenceBuffer;
  source.playbackRate.setValueAtTime(1 + index * .018, start);
  gain.gain.setValueAtTime(0, start + delay);
  gain.gain.linearRampToValueAtTime(Math.max(.18, .42 - count * .025), start + delay + .18);
  gain.gain.setTargetAtTime(Math.max(.14, .34 - count * .02), start + delay + .7, .5);
  gain.gain.linearRampToValueAtTime(0, start + delay + Math.min(10, voiceReferenceBuffer.duration) - .15);
  pan.pan.setValueAtTime(count <= 1 ? 0 : -0.7 + (1.4 * index) / Math.max(1, count - 1), start);
  source.connect(gain).connect(pan).connect(destination);
  source.start(start + delay, 0, Math.min(10, voiceReferenceBuffer.duration));
  source.stop(start + delay + Math.min(10.1, voiceReferenceBuffer.duration + .1));
  return { sample: source, voiceGain: gain };
}

const CHORALE_MELODY = [
  { note: 0, dur: 1.2, vowel: "ah" },
  { note: 2, dur: 1.15, vowel: "ah" },
  { note: 4, dur: 1.15, vowel: "ah" },
  { note: 7, dur: 1.35, vowel: "ah" },
  { note: 5, dur: 1.15, vowel: "ah" },
  { note: 4, dur: 1.1, vowel: "ah" },
  { note: 2, dur: 1.25, vowel: "ah" },
  { note: 0, dur: 1.65, vowel: "ah" }
];

const VOICE_PROFILES = [
  { name: "helium", type: "sawtooth", octave: 1.96, sampleRate: 2.08, vibrato: 7.2, wobble: 9, formantShift: 1.34, breath: .003, gain: .16 },
  { name: "minion", type: "sawtooth", octave: 1.78, sampleRate: 2.34, vibrato: 10.8, wobble: 14, formantShift: 1.55, breath: .004, gain: .145 },
  { name: "parallel-bars", type: "triangle", octave: 1.34, sampleRate: 1.62, vibrato: 5.2, wobble: 7, formantShift: 1.18, ring: 32, breath: .003, gain: .136 },
  { name: "chair-voice", type: "sawtooth", octave: 1.12, sampleRate: 1.28, vibrato: 6.3, wobble: 11, formantShift: .98, breath: .01, scrape: true, gain: .128 },
  { name: "thin-chorister", type: "triangle", octave: 1.52, sampleRate: 1.78, vibrato: 5.2, wobble: 7, formantShift: 1.22, breath: .003, gain: .14 }
];

const VOWEL_FORMANTS = {
  ah: [[790, 80, .34], [1180, 110, .2], [2850, 190, .09]],
  eh: [[560, 70, .3], [1760, 130, .18], [2550, 190, .08]],
  ee: [[330, 55, .22], [2180, 150, .26], [3060, 210, .1]],
  oh: [[500, 70, .3], [930, 95, .18], [2600, 190, .07]],
  oo: [[320, 55, .22], [760, 90, .17], [2300, 180, .07]]
};

function scheduleChoirVoice(ctx, destination, start, index, count) {
  const profile = VOICE_PROFILES[index % VOICE_PROFILES.length];
  const osc = ctx.createOscillator();
  const sub = ctx.createOscillator();
  const sample = voiceReferenceBuffer ? ctx.createBufferSource() : null;
  const sampleGain = ctx.createGain();
  const voiceGain = ctx.createGain();
  const sourceGain = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const base = 155.56 * profile.octave * Math.pow(2, (index % 4 - 1.5) * .035);
  const offset = index * .07;
  let cursor = start + .18 + offset;

  osc.type = profile.type;
  sub.type = "triangle";
  sourceGain.gain.setValueAtTime(sample ? 2.1 : 1.2, start);
  sampleGain.gain.setValueAtTime(sample ? 3.2 : 0, start);
  shaper.curve = softVoiceCurve();
  shaper.oversample = "2x";
  pan.pan.setValueAtTime(count <= 1 ? 0 : -0.76 + (1.52 * index) / Math.max(1, count - 1), start);
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(profile.vibrato, start);
  lfoGain.gain.setValueAtTime(profile.wobble, start);
  lfo.connect(lfoGain).connect(osc.frequency);
  lfoGain.connect(sub.frequency);
  const formantBank = createFormantBank(ctx, profile, start);
  sourceGain._formants = formantBank;

  CHORALE_MELODY.forEach((step, stepIndex) => {
    const freq = base * Math.pow(2, step.note / 12);
    const end = cursor + step.dur;
    const slide = profile.scrape ? 1.018 + Math.sin(stepIndex * 1.7) * .012 : 1;
    const vowel = VOWEL_FORMANTS[step.vowel];
    osc.frequency.setTargetAtTime(freq * slide, cursor, .08);
    sub.frequency.setTargetAtTime(freq * .5 * slide, cursor, .08);
    if (sample) sample.playbackRate.setTargetAtTime(profile.sampleRate * Math.pow(2, step.note / 12) * slide, cursor, .08);
    updateFormants(ctx, sourceGain._formants, vowel, profile.formantShift, cursor);
    voiceGain.gain.setValueAtTime(.0001, cursor);
    voiceGain.gain.exponentialRampToValueAtTime(profile.gain, cursor + .18);
    voiceGain.gain.setTargetAtTime(profile.gain * (.82 + Math.sin(stepIndex + index) * .08), cursor + .24, .24);
    voiceGain.gain.exponentialRampToValueAtTime(.0001, end - .12);
    cursor = end;
  });

  osc.connect(sourceGain);
  sub.connect(sourceGain);
  if (sample) {
    sample.buffer = voiceReferenceBuffer;
    sample.loop = true;
    sample.loopStart = 0;
    sample.loopEnd = Math.min(Math.max(.32, voiceReferenceBuffer.duration * .24), voiceReferenceBuffer.duration);
    sample.connect(sampleGain).connect(sourceGain);
  }
  sourceGain.connect(shaper);
  formantBank.forEach(({ filter, gain }) => {
    shaper.connect(filter).connect(gain).connect(voiceGain);
  });
  const nodes = { osc, sub, lfo, sample, voiceGain };
  if (profile.ring) {
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type = "sine";
    mod.frequency.setValueAtTime(profile.ring + index * 9, start);
    modGain.gain.setValueAtTime(.006, start);
    mod.connect(modGain).connect(voiceGain.gain);
    nodes.mod = mod;
    mod.start(start);
    mod.stop(cursor + .2);
  }
  if (profile.breath || profile.scrape) {
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = makeNoiseBuffer(ctx, cursor - start + .5);
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(profile.scrape ? 1280 + index * 80 : 2900 + index * 70, start);
    noiseFilter.Q.setValueAtTime(profile.scrape ? 16 : 6, start);
    noiseGain.gain.setValueAtTime(profile.breath, start);
    noise.connect(noiseFilter).connect(noiseGain).connect(voiceGain);
    noise.start(start + offset);
    noise.stop(cursor + .12);
    nodes.noise = noise;
  }
  voiceGain.connect(pan).connect(destination);
  osc.start(start + offset);
  sub.start(start + offset);
  if (sample) sample.start(start + offset);
  lfo.start(start + offset);
  osc.stop(cursor + .2);
  sub.stop(cursor + .2);
  if (sample) sample.stop(cursor + .2);
  lfo.stop(cursor + .2);
  return nodes;
}

function createFormantBank(ctx, profile, start) {
  return [0, 1, 2].map(() => {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900 * profile.formantShift, start);
    filter.Q.setValueAtTime(10, start);
    gain.gain.setValueAtTime(.12, start);
    return { filter, gain };
  });
}

function updateFormants(ctx, formants, vowel, shift, time) {
  if (!formants) return;
  vowel.forEach(([frequency, bandwidth, gainValue], index) => {
    const node = formants[index];
    node.filter.frequency.setTargetAtTime(frequency * shift, time, .09);
    node.filter.Q.setTargetAtTime(Math.max(1, frequency / bandwidth), time, .09);
    node.gain.gain.setTargetAtTime(gainValue, time, .09);
  });
}

function softVoiceCurve() {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) * .72;
  }
  return curve;
}

function makeNoiseBuffer(ctx, duration) {
  const length = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, .25);
  }
  return buffer;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatDate(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${yy}/${month}/${day}/${hour}:${minute}:${second}`;
}

render();
