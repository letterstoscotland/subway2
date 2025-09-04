// --- CONFIGURATION --- //
const SUBWAY_CONFIG = {
  timeZone: "Europe/London",
  operatingHours: {
    // [startHour, endHour] in 24h format for each day (0=Sunday)
    0: [6.5, 18.5],    // Sunday: 06:30 - 18:30
    1: [6.5, 23.5],    // Monday: 06:30 - 23:30
    2: [6.5, 23.5],    // Tuesday: 06:30 - 23:30
    3: [6.5, 23.5],    // Wednesday: 06:30 - 23:30
    4: [6.5, 23.5],    // Thursday: 06:30 - 23:30
    5: [6.5, 23.5],    // Friday: 06:30 - 23:30
    6: [6.5, 23.5],    // Saturday: 06:30 - 23:30
    // Termination times: [hour, min] for last service (for each day, 0=Sunday)
    endTimes: {
      0: [18, 21],     // Sunday: 18:21
      1: [23, 21],     // Monday: 23:21
      2: [23, 21],     // Tuesday: 23:21
      3: [23, 21],     // Wednesday: 23:21
      4: [23, 21],     // Thursday: 23:21
      5: [23, 21],     // Friday: 23:21
      6: [23, 21],     // Saturday: 23:21
    }
  },
  headlines: {
    inner: [
      "Inner next arrival 8min", "Inner next arrival 7min", "Inner next arrival 6min",
      "Inner next arrival 5min", "Inner next arrival 4min", "Inner next arrival 3min",
      "Inner next arrival 2min", "Inner next arrival 1min", "INNER APPROACHING"
    ],
    outer: [
      "Outer next arrival 8min", "Outer next arrival 7min", "Outer next arrival 6min",
      "Outer next arrival 5min", "Outer next arrival 4min", "Outer next arrival 3min",
      "Outer next arrival 2min", "Outer next arrival 1min", "OUTER APPROACHING"
    ]
  },
  advisories: {
    base: [
      "Keep your belongings with you",
      "Please Mind the Gap",
      "Report anything suspicious"
    ],
    inserts: [
      { text: "NEXT INNER TERMINATES AT GOVAN", when: "inner_termination", line: "A" },
      { text: "NEXT OUTER TERMINATES AT IBROX", when: "outer_termination", line: "B" },
      { text: "Football- system busy 1-6pm", when: "football", line: "both" }
    ]
  },
  advisoryCycleSeconds: 25,
  marqueeSpeed: 60,
  approachingFlash: true
};

// --- UTILITY FUNCTIONS --- //
function getUKTime() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: SUBWAY_CONFIG.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = fmt.formatToParts(new Date());
  const obj = {};
  parts.forEach(p => { obj[p.type] = p.value; });
  return new Date(`${obj.year}-${obj.month}-${obj.day}T${obj.hour}:${obj.minute}:${obj.second}`);
}

function pad(num, len = 2) {
  return num.toString().padStart(len, "0");
}

// --- FONT SCALING LOGIC FOR PANELS --- //
// Headlines and clock: font-size based on longest message in planned rotation.
// Advisories: font-size based only on panel height (can always marquee).
function scalePanelFonts() {
  // Minimum font size for readability
  const MIN_FONT_SIZE = 14;

  // For headline splits: calculate separately for left and right
  const headlineA_left_span = document.getElementById("headlineA-left");
  const headlineA_right_span = document.getElementById("headlineA-right");
  const headlineB_left_span = document.getElementById("headlineB-left");
  const headlineB_right_span = document.getElementById("headlineB-right");

  // Panel containers for measuring available width/height
  const headlineA_panel = headlineA_left_span.parentNode;
  const headlineB_panel = headlineB_left_span.parentNode;

  // Calculate longest LEFT and RIGHT messages
  // For first service, split "First inner due O633" → left: "First inner due", right: "O633"
  // For countdowns, left: "Inner next arrival", right: "8min" etc
  const innerLeftMessages = [
    "First inner due", // for first service
    ...SUBWAY_CONFIG.headlines.inner.map(msg => {
      let match = msg.match(/^(.+?)(\d+min)$/);
      return match ? match[1].trim() : msg; // left part or whole msg
    })
  ];
  const innerRightMessages = [
    "O633", // for first service
    ...SUBWAY_CONFIG.headlines.inner.map(msg => {
      let match = msg.match(/^(.+?)(\d+min)$/);
      return match ? match[2] : (msg.endsWith("APPROACHING") ? "APPROACHING" : "");
    })
  ];

  const outerLeftMessages = [
    "First outer due",
    ...SUBWAY_CONFIG.headlines.outer.map(msg => {
      let match = msg.match(/^(.+?)(\d+min)$/);
      return match ? match[1].trim() : msg;
    })
  ];
  const outerRightMessages = [
    "O638",
    ...SUBWAY_CONFIG.headlines.outer.map(msg => {
      let match = msg.match(/^(.+?)(\d+min)$/);
      return match ? match[2] : (msg.endsWith("APPROACHING") ? "APPROACHING" : "");
    })
  ];

  // Helper to find widest message
  function widest(messages, span) {
    const testSpan = document.createElement("span");
    const computed = window.getComputedStyle(span);
    testSpan.style.position = "absolute";
    testSpan.style.visibility = "hidden";
    testSpan.style.whiteSpace = "nowrap";
    testSpan.style.fontFamily = computed.fontFamily;
    testSpan.style.fontWeight = computed.fontWeight;
    testSpan.style.letterSpacing = computed.letterSpacing;
    testSpan.style.fontStyle = computed.fontStyle;
    testSpan.style.textTransform = computed.textTransform;
    document.body.appendChild(testSpan);

    let widestMsg = "", maxWidth = 0;
    for (let msg of messages) {
      testSpan.textContent = msg;
      testSpan.style.fontSize = "24px";
      let w = testSpan.scrollWidth;
      if (w > maxWidth) {
        maxWidth = w;
        widestMsg = msg;
      }
    }
    document.body.removeChild(testSpan);
    return widestMsg;
  }

  // Scale font for given span/panel and message
  function fitFont(panel, span, message, maxHeightPct = 0.97, minFontSize = MIN_FONT_SIZE) {
    const testSpan = document.createElement("span");
    const computed = window.getComputedStyle(span);
    testSpan.style.position = "absolute";
    testSpan.style.visibility = "hidden";
    testSpan.style.whiteSpace = "nowrap";
    testSpan.style.fontFamily = computed.fontFamily;
    testSpan.style.fontWeight = computed.fontWeight;
    testSpan.style.letterSpacing = computed.letterSpacing;
    testSpan.style.fontStyle = computed.fontStyle;
    testSpan.style.textTransform = computed.textTransform;
    testSpan.textContent = message;
    document.body.appendChild(testSpan);

    const panelHeight = panel.clientHeight;
    const panelWidth = span.classList.contains("headline-left") || span.classList.contains("headline-right")
      ? panel.clientWidth / 2
      : panel.clientWidth;

    let fontSize = panelHeight * maxHeightPct;
    testSpan.style.fontSize = fontSize + "px";
    let fits = testSpan.scrollWidth <= panelWidth;

    while (!fits && fontSize > minFontSize) {
      fontSize -= 1;
      testSpan.style.fontSize = fontSize + "px";
      fits = testSpan.scrollWidth <= panelWidth;
    }

    if (fontSize <= minFontSize && !fits) {
      console.warn(`Font-size for panel ${panel.className} reached minimum for message: "${message}". Consider widening the panel or shortening the message.`);
      fontSize = minFontSize;
    }
    span.style.fontSize = fontSize + "px";
    document.body.removeChild(testSpan);
  }

  // Apply scaling for headlines (split spans)
  const innerLeftWidest = widest(innerLeftMessages, headlineA_left_span);
  const innerRightWidest = widest(innerRightMessages, headlineA_right_span);
  fitFont(headlineA_panel, headlineA_left_span, innerLeftWidest, 0.97, MIN_FONT_SIZE);
  fitFont(headlineA_panel, headlineA_right_span, innerRightWidest, 0.97, MIN_FONT_SIZE);

  const outerLeftWidest = widest(outerLeftMessages, headlineB_left_span);
  const outerRightWidest = widest(outerRightMessages, headlineB_right_span);
  fitFont(headlineB_panel, headlineB_left_span, outerLeftWidest, 0.97, MIN_FONT_SIZE);
  fitFont(headlineB_panel, headlineB_right_span, outerRightWidest, 0.97, MIN_FONT_SIZE);

  // Clock panel: use max possible string
  const clockPanel = document.querySelector('.clock');
  if (clockPanel) {
    const clockSpan = clockPanel.querySelector('span');
    if (clockSpan) {
      fitFont(clockPanel, clockSpan, "Time Now 23:59:59", 0.97, MIN_FONT_SIZE);
      clockSpan.style.whiteSpace = 'nowrap';
      clockSpan.style.overflow = 'hidden';
      clockSpan.style.textOverflow = 'ellipsis';
    }
  }

  // Advisories: font-size based on panel height only (no length calculation)
  ['.advisoryA', '.advisoryB'].forEach(selector => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    const span = panel.querySelector('span');
    if (!span) return;
    const panelHeight = panel.clientHeight;
    span.style.fontSize = `${panelHeight * 0.97}px`;
    span.style.whiteSpace = 'nowrap';
    span.style.overflow = '';
    span.style.textOverflow = '';
  });
}

// Run scaling at startup and on resize
window.addEventListener('resize', scalePanelFonts);
window.addEventListener('DOMContentLoaded', () => {
  scalePanelFonts();
  new SubwayBoard(SUBWAY_CONFIG);
});

// --- BOARD LOGIC --- //
class SubwayBoard {
  constructor(config) {
    this.config = config;
    this.innerOffset = 3;
    this.outerOffset = 8;
    this.cycleMinutes = 8;
    this.advisoryAIndex = 0;
    this.advisoryBIndex = 1;
    this.lastAdvisoryAChange = 0;
    this.lastAdvisoryBChange = 0;
    this.el = {
      headlineA_left: document.getElementById("headlineA-left"),
      headlineA_right: document.getElementById("headlineA-right"),
      headlineB_left: document.getElementById("headlineB-left"),
      headlineB_right: document.getElementById("headlineB-right"),
      advisoryA: document.getElementById("advisoryA-text"),
      advisoryB: document.getElementById("advisoryB-text"),
      clock: document.getElementById("clockText")
    };
    this.innerIsApproaching = false;
    this.outerIsApproaching = false;
    this.innerApproachStart = null;
    this.outerApproachStart = null;
    this.start();
  }
  
  start() {
    this.updateAll();
    setInterval(() => this.updateAll(), 1000);
  }

  updateAll() {
    const now = getUKTime();
    this.updateClock(now);
    this.updateHeadlines(now);
    this.updateAdvisories(now);
  }

  isOperating(now) {
    const day = now.getDay();
    const hours = now.getHours() + now.getMinutes()/60;
    const [start, end] = this.config.operatingHours[day];
    return hours >= start && hours < end;
  }

  isServiceTerminated(now) {
    const day = now.getDay();
    const endHour = this.config.operatingHours.endTimes[day][0];
    const endMin = this.config.operatingHours.endTimes[day][1];
    const endTime = endHour + endMin/60;
    const hours = now.getHours() + now.getMinutes()/60;
    return hours >= endTime;
  }

  updateClock(now) {
    this.el.clock.textContent = `Time Now ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  updateHeadlines(now) {
    let innerLeft, innerRight, outerLeft, outerRight;
    let flashingA = false, flashingB = false;

    const hour = now.getHours();
    const min = now.getMinutes();

    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    // For first service, split into left/right
    if (!isOperating || isTerminated) {
      innerLeft = "First inner due";
      innerRight = "O633";
      outerLeft = "First outer due";
      outerRight = "O638";
    } else if (isFirstInner) {
      innerLeft = "First inner due";
      innerRight = "O633";
      outerLeft = "First outer due";
      outerRight = "O638";
    } else if (!isFirstInner && isFirstOuter) {
      // Inner uses countdown, outer uses first
      innerLeft = "Inner next arrival";
      innerRight = "8min";
      outerLeft = "First outer due";
      outerRight = "O638";
    } else {
      // Normal countdown logic
      const secondsToday = hour*3600 + min*60 + now.getSeconds();

      // INNER
      let innerCyclePosition = ((secondsToday / 60 - this.innerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let innerMinRemain = this.cycleMinutes - Math.floor(innerCyclePosition);
      let innerSecRemain = 60 - (secondsToday % 60);

      // OUTER
      let outerCyclePosition = ((secondsToday / 60 - this.outerOffset) % this.cycleMinutes + this.cycleMinutes) % this.cycleMinutes;
      let outerMinRemain = this.cycleMinutes - Math.floor(outerCyclePosition);
      let outerSecRemain = 60 - (secondsToday % 60);

      // For "APPROACHING" (last 10 seconds)
      if (innerMinRemain === 1 && innerSecRemain <= 10) {
        innerLeft = "INNER";
        innerRight = "APPROACHING";
        flashingA = this.config.approachingFlash;
        if (!this.innerIsApproaching) this.innerApproachStart = Date.now();
        this.innerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - innerMinRemain));
        let msg = this.config.headlines.inner[index];
        let match = msg.match(/^(.+?)(\d+min)$/);
        if (match) {
          innerLeft = match[1].trim();
          innerRight = match[2];
        } else {
          innerLeft = msg;
          innerRight = "";
        }
        flashingA = false;
        this.innerIsApproaching = false;
        this.innerApproachStart = null;
      }

      if (outerMinRemain === 1 && outerSecRemain <= 10) {
        outerLeft = "OUTER";
        outerRight = "APPROACHING";
        flashingB = this.config.approachingFlash;
        if (!this.outerIsApproaching) this.outerApproachStart = Date.now();
        this.outerIsApproaching = true;
      } else {
        let index = Math.max(0, Math.min(7, this.cycleMinutes - outerMinRemain));
        let msg = this.config.headlines.outer[index];
        let match = msg.match(/^(.+?)(\d+min)$/);
        if (match) {
          outerLeft = match[1].trim();
          outerRight = match[2];
        } else {
          outerLeft = msg;
          outerRight = "";
        }
        flashingB = false;
        this.outerIsApproaching = false;
        this.outerApproachStart = null;
      }
    }

    this.setHeadlineSplit(this.el.headlineA_left, this.el.headlineA_right, innerLeft, innerRight, flashingA);
    this.setHeadlineSplit(this.el.headlineB_left, this.el.headlineB_right, outerLeft, outerRight, flashingB);
  }

  setHeadlineSplit(leftEl, rightEl, leftMsg, rightMsg, flashing=false) {
    leftEl.textContent = leftMsg;
    rightEl.textContent = rightMsg;
    leftEl.classList.toggle("flashing", flashing);
    rightEl.classList.remove("flashing");
  }

  updateAdvisories(now) {
    const day = now.getDay();
    const hour = now.getHours();
    const min = now.getMinutes();
    const month = now.getMonth();

    const isFootballSeason = (month >= 7 && month <= 10) || (month === 11 && hour < 18);
    const isOperating = this.isOperating(now);
    const isTerminated = this.isServiceTerminated(now);

    const isFirstInner = (hour === 6 && min < 25);
    const isFirstOuter = (hour === 6 && min < 30);

    let advisoryAMessages = [...this.config.advisories.base];
    let advisoryBMessages = [...this.config.advisories.base];

    if (
      isFootballSeason &&
      day === 6 &&
      hour >= 6 && hour < 18
    ) {
      advisoryAMessages.push("Football- system busy 1-6pm");
      advisoryBMessages.push("Football- system busy 1-6pm");
    }

    if (
      (hour >= 9 && hour < 11) ||
      (day !== 0 && hour >= 22 && hour < 23) ||
      (day === 0 && hour >= 17 && hour < 18)
    ) {
      advisoryAMessages.push("NEXT INNER TERMINATES AT GOVAN");
      advisoryBMessages.push("NEXT OUTER TERMINATES AT IBROX");
    }

    // Show "not in service" only during first service and terminated periods
    if (!isOperating || isTerminated || isFirstInner || isFirstOuter) {
      this.el.advisoryA.textContent = "Inner not in service";
      this.el.advisoryB.textContent = "Outer not in service";
      return;
    }

    // Advisory cycling resumes when countdown starts
    const nowMs = Date.now();
    if (!this.lastAdvisoryAChange || (nowMs - this.lastAdvisoryAChange) > this.config.advisoryCycleSeconds * 1000) {
      this.advisoryAIndex = (this.advisoryAIndex + 1) % advisoryAMessages.length;
      this.lastAdvisoryAChange = nowMs;
      let nextB = (this.advisoryBIndex + 1) % advisoryBMessages.length;
      if (advisoryBMessages[nextB] === advisoryAMessages[this.advisoryAIndex]) {
        nextB = (nextB + 1) % advisoryBMessages.length;
      }
      this.advisoryBIndex = nextB;
      this.lastAdvisoryBChange = nowMs + this.config.advisoryCycleSeconds * 500;
    }

    this.showAdvisory(this.el.advisoryA, advisoryAMessages[this.advisoryAIndex]);
    this.showAdvisory(this.el.advisoryB, advisoryBMessages[this.advisoryBIndex]);
  }

  showAdvisory(el, msg) {
    el.classList.remove("marqueeing");
    el.style.transform = "";
    el.textContent = msg;

    setTimeout(() => {
      const parent = el.parentNode;
      if (el.scrollWidth > parent.offsetWidth) {
        el.classList.add("marqueeing");
        let duration = (el.scrollWidth + parent.offsetWidth) / SUBWAY_CONFIG.marqueeSpeed;
        el.animate([
          { transform: "translateX(0)" },
          { transform: `translateX(-${el.scrollWidth + 24}px)` }
        ], {
          duration: duration*1000,
          iterations: Infinity,
          easing: "linear"
        });
      }
    }, 50);
  }
}
